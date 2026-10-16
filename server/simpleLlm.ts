import { TRPCError } from "@trpc/server";
import { invokeLLM } from "./_core/llm";

/** system+user 한 번 호출로 텍스트를 받는 공용 헬퍼 */
export async function simpleLLM(system: string, user: string, json: boolean, maxTokens: number, strong = false): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: maxTokens,
      strong,
      ...(json ? { response_format: { type: "json_object" as const } } : {}),
    });
    const c = response.choices[0]?.message?.content;
    return typeof c === "string" ? c : "";
  } catch (e) {
    console.error("[workTools] LLM failed", e);
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI 생성에 실패했습니다. 잠시 후 다시 시도해 주세요." });
  }
}
