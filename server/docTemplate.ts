import { invokeLLM } from "./_core/llm";
import { OFFICIAL_NOTATION_RULES } from "./officialStyle";
import { formatReferences, type RefChunk } from "./referenceLib";
import { extractPdfTextFromBuffer } from "./pdfExtract";
import { createTemplate } from "./templateDb";

export type TemplateSection = { heading: string; guide: string; format: string };
export type TemplateAnalysis = { docKind: string; tone: string; sections: TemplateSection[] };

const MAX_SAMPLE_CHARS = 12000;

/** 전화번호·주민번호·이메일·계좌 같은 개인정보를 가린다(저장·AI 전송 전). */
export function maskPersonalInfo(text: string): string {
  return text
    .replace(/\b\d{6}[-\s]?[1-4]\d{6}\b/g, "[주민번호]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[이메일]")
    .replace(/\b0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g, "[전화번호]")
    .replace(/\b\d{2,6}-\d{2,6}-\d{2,8}(?:-\d{1,4})?\b/g, "[번호]");
}

export function extractJson(raw: string): any | null {
  let t = raw.trim();
  const f = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (f) t = f[1].trim();
  const s = t.indexOf("{");
  const e = t.lastIndexOf("}");
  if (s === -1 || e <= s) return null;
  try {
    return JSON.parse(t.slice(s, e + 1));
  } catch {
    return null;
  }
}

export function buildAnalyzePrompt(sample: string) {
  const system = `당신은 한국 사회복지기관 문서 서식 분석가입니다. 샘플 문서에서 '항목 구조'를 뽑아냅니다.
- 샘플의 구체적 내용(이름, 수치, 날짜 등)은 버리고, 문서가 어떤 항목(제목·목차)을 어떤 순서로 쓰는지만 추출합니다.
- 각 항목마다 heading(샘플에 쓰인 항목명 그대로), guide(그 항목에 무엇을 쓰는지 한 문장), format(개조식/서술/표 중 하나)을 적습니다.
- 항목은 샘플 순서대로 최대 25개. 표지·결재란·페이지 번호는 제외합니다.
- tone에는 문체(예: 개조식 ~함/~임, 합쇼체)를 적고, docKind에는 문서 종류(기안서/결과보고서/사업계획서 등)를 적습니다.
JSON 객체 하나만 출력(코드블록 금지): {"docKind":"","tone":"","sections":[{"heading":"","guide":"","format":""}]}`;
  return { system, user: `다음은 기관 서식 샘플의 텍스트입니다.\n\n${sample}` };
}

export function parseAnalysis(raw: string): TemplateAnalysis | null {
  const o = extractJson(raw);
  if (!o || !Array.isArray(o.sections)) return null;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const sections: TemplateSection[] = o.sections
    .map((s: any) => ({ heading: str(s?.heading), guide: str(s?.guide), format: str(s?.format) || "서술" }))
    .filter((s: TemplateSection) => s.heading)
    .slice(0, 25);
  if (sections.length === 0) return null;
  return { docKind: str(o.docKind), tone: str(o.tone), sections };
}

export class TemplateError extends Error {}

/** PDF 샘플 → 항목 구조 분석 → 저장. 실패하면 TemplateError(사용자에게 보여줄 메시지). */
export async function registerTemplateFromPdf(userId: number, name: string, buffer: Buffer): Promise<number> {
  const rawText = await extractPdfTextFromBuffer(buffer);
  if (rawText.replace(/\s/g, "").length < 200) {
    throw new TemplateError("PDF에서 글자를 읽지 못했습니다. 스캔한 이미지 PDF는 지원하지 않으니, 한글/워드에서 직접 PDF로 저장한 파일을 올려 주세요.");
  }
  const sample = maskPersonalInfo(rawText).slice(0, MAX_SAMPLE_CHARS);
  const { system, user } = buildAnalyzePrompt(sample);
  let raw = "";
  try {
    const r = await invokeLLM({
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      max_tokens: 3000,
      response_format: { type: "json_object" },
    });
    const c = r.choices[0]?.message?.content;
    raw = typeof c === "string" ? c : "";
  } catch (e) {
    console.error("[template] analyze failed", e);
    throw new TemplateError("양식 분석에 실패했습니다. 잠시 후 다시 시도해 주세요.");
  }
  const analysis = parseAnalysis(raw);
  if (!analysis) throw new TemplateError("양식에서 항목 구조를 찾지 못했습니다. 항목(제목)이 뚜렷한 샘플로 다시 시도해 주세요.");
  return createTemplate({ userId, name, analysis: JSON.stringify(analysis), sampleText: sample });
}

export function buildFillPrompt(analysis: TemplateAnalysis, input: { title: string; facts: string; extra?: string }, sampleText?: string | null, refs?: RefChunk[]) {
  const spec = analysis.sections
    .map((s, i) => `${i + 1}. ${s.heading} — ${s.guide} (${s.format})`)
    .join("\n");
  const system = `당신은 사회복지기관 행정 문서 작성자입니다. 아래 '기관 양식'의 항목 순서와 이름을 그대로 지켜 내용을 작성합니다.

[원칙]
- 항목명(heading)은 양식과 한 글자도 바꾸지 않고 순서도 유지합니다. 항목을 추가하거나 빼지 않습니다.
- 사용자가 준 사실만 사용합니다. 주어지지 않은 수치·날짜·기관명·근거는 지어내지 말고 "[확인 필요: 항목]"으로 표시합니다.
- 문체는 "${analysis.tone || "개조식"}"에 맞춥니다. 항목 형식이 '표'이면 마크다운 표로 씁니다.
- 각 항목의 content는 그 항목 칸에 그대로 붙여넣을 수 있게 항목명 없이 본문만 씁니다.
- 해당 내용이 없는 항목은 content를 "[확인 필요]"로 둡니다.

[기관 양식: ${analysis.docKind || "문서"}]
${spec}
${sampleText ? `\n[샘플 문체 참고(내용은 옮기지 말 것)]\n${sampleText.slice(0, 1500)}\n` : ""}
(항목 구성과 문체는 위 기관 양식이 우선하고, 날짜·시간·금액 표기와 표현은 아래 규칙을 따른다)
${OFFICIAL_NOTATION_RULES}${formatReferences(refs)}

JSON 객체 하나만 출력(코드블록 금지): {"sections":[{"heading":"","content":""}]}`;
  const user = `제목/주제: ${input.title}\n알고 있는 내용:\n${input.facts}${input.extra ? `\n추가 요청: ${input.extra}` : ""}`;
  return { system, user };
}

/** 모델 응답을 양식의 항목 순서에 맞춰 정렬한다. 항목명이 어긋나면 순서(인덱스)로 대응. */
export function alignFilled(analysis: TemplateAnalysis, raw: string): { heading: string; content: string }[] {
  const o = extractJson(raw);
  const arr: any[] = Array.isArray(o?.sections) ? o.sections : [];
  const norm = (s: string) => s.replace(/\s+/g, "");
  const used = new Set<number>();
  return analysis.sections.map((sec, i) => {
    let idx = arr.findIndex((a, j) => !used.has(j) && typeof a?.heading === "string" && norm(a.heading) === norm(sec.heading));
    if (idx === -1 && arr[i] && !used.has(i)) idx = i;
    if (idx !== -1) used.add(idx);
    const c = idx !== -1 ? arr[idx]?.content : "";
    return { heading: sec.heading, content: typeof c === "string" ? c.trim() : "" };
  });
}
