import { ENV } from "./env";
import { reportUsage } from "../aiMeter";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  /** true면 GEMINI_MODEL_STRONG 모델 사용(긴 문서 생성·심사 등 품질이 중요한 작업) */
  strong?: boolean;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const resolveApiUrl = () =>
  `${ENV.geminiApiUrl.replace(/\/$/, "")}/chat/completions`;

const assertApiKey = () => {
  if (!ENV.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, process.env.NODE_ENV === "test" ? 0 : ms));

export class LlmError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** 사용자에게 보여줄 실패 사유(원인별 안내). */
export function llmFailureMessage(e: unknown): string {
  const st = e instanceof LlmError ? e.status : -1;
  if (st === 429) return "AI 사용량이 일시적으로 몰렸습니다. 1분쯤 뒤에 다시 시도해 주세요.";
  if (st === 503 || st === 500 || st === 502 || st === 504) return "AI 서버가 일시적으로 바쁩니다. 잠시 후 다시 시도해 주세요.";
  if (st === 0) return "AI 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  return "AI 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.";
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  assertApiKey();

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    maxTokens,
    max_tokens,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    strong,
  } = params;

  // Normalize messages. file_url is converted to text note (PDF text is already extracted upstream).
  const normalizedMessages = messages.map((msg) => {
    const n = normalizeMessage(msg);
    if (Array.isArray(n.content)) {
      const parts = n.content.flatMap((part: any) => {
        if (part?.type === "file_url") {
          const url = part.file_url?.url ?? "";
          const mime = part.file_url?.mime_type ?? "file";
          return [{ type: "text", text: `[첨부 파일 (${mime}): ${url}]` }];
        }
        return [part];
      });
      return { ...n, content: parts };
    }
    return n;
  });

  const payload: Record<string, unknown> = {
    model: strong ? ENV.geminiModelStrong : ENV.geminiModel,
    messages: normalizedMessages,
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  const maxTokensValue = maxTokens ?? max_tokens ?? 4096;
  payload.max_tokens = maxTokensValue;

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  // 일시 과부하(503)·요청 한도(429)·서버 오류·네트워크 끊김은 잠깐 뒤 자동 재시도한다.
  // 그래도 안 되면 예비 모델(GEMINI_MODEL_FALLBACK)이 있을 때 한 번 더 시도한다.
  const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
  const MAX_ATTEMPTS = 3;
  const models = [payload.model as string];
  if (ENV.geminiModelFallback && ENV.geminiModelFallback !== payload.model) models.push(ENV.geminiModelFallback);
  let response: Response | null = null;
  let netErr: unknown = null;
  for (let m = 0; m < models.length; m++) {
    const body = JSON.stringify({ ...payload, model: models[m] });
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      netErr = null;
      try {
        response = await fetch(resolveApiUrl(), {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${ENV.geminiApiKey}` },
          body,
        });
      } catch (e) {
        netErr = e;
        response = null;
        if (attempt < MAX_ATTEMPTS) await sleep(1500 * attempt);
        continue;
      }
      if (response.ok || !RETRY_STATUS.has(response.status)) break;
      if (attempt < MAX_ATTEMPTS) await sleep(1500 * attempt);
    }
    if (response?.ok) break;
    if (response && !RETRY_STATUS.has(response.status)) break; // 400/401/404 등은 예비 모델로도 해결되지 않음
  }
  if (!response && netErr) throw new LlmError(`Gemini LLM network error: ${String(netErr)}`, 0);

  if (!response || !response.ok) {
    const errorText = response ? await response.text() : "";
    throw new LlmError(
      `Gemini LLM invoke failed: ${response?.status} ${response?.statusText} – ${errorText}`,
      response?.status ?? 0
    );
  }

  const result = (await response.json()) as InvokeResult;
  reportUsage(String((result as any).model ?? payload.model ?? ""), (result as any).usage);
  return result;
}
