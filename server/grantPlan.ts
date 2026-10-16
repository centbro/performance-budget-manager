import { PLAN_SECTIONS, SCALE_CATALOG } from "../shared/businessPlanData";
import { CASEBOOK_STRUCTURE, REVIEW_CRITERIA, type QuickPlanInput } from "../shared/grantGuide";
import type { GeneratedSection } from "./businessPlanDb";

/** 빠른 생성 입력을 검증하고 정리한다. 문제가 있으면 Error를 던진다. */
export function normalizeQuickInput(input: QuickPlanInput): QuickPlanInput {
  const clean = (s: string | undefined) => (s ?? "").trim();
  const out: QuickPlanInput = {
    ...input,
    title: clean(input.title),
    field: clean(input.field),
    region: clean(input.region),
    targetDescription: clean(input.targetDescription),
    period: clean(input.period) || `${input.year}. 1. 1. ~ 12. 31.`,
    desiredEffect: clean(input.desiredEffect),
    extra: clean(input.extra),
  };
  if (!out.title) throw new Error("사업명이 필요합니다.");
  if (!out.targetDescription) throw new Error("대상 설명이 필요합니다.");
  if (!out.desiredEffect) throw new Error("원하는 효과가 필요합니다.");
  if (!Number.isFinite(out.budget) || out.budget <= 0) throw new Error("예산은 0보다 커야 합니다.");
  if (!Number.isFinite(out.targetCount) || out.targetCount <= 0) throw new Error("대상 인원은 0보다 커야 합니다.");
  return out;
}

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

export function buildGeneratePrompt(input: QuickPlanInput) {
  const sectionSpec = PLAN_SECTIONS.map(
    (s) => `- "${s.id}": ${s.title} (포함 항목: ${s.fields.join(", ")})`
  ).join("\n");

  const system = `당신은 사회복지 현장의 공동모금회(사랑의열매) 배분사업 사업계획서 작성 전문가입니다.
입력된 대상·예산·원하는 효과만으로 공동모금회 양식에 맞는 사업계획서 초안을 작성합니다.

[양식 구조 참고]
${CASEBOOK_STRUCTURE}

[작성 원칙]
- 사례집은 '서식·논리 구조·지표 설계 방식'만 참고하고, 특정 사례의 프로그램 내용이나 문장을 베끼지 않습니다. 입력된 대상과 지역에 맞는 독창적 프로그램을 설계합니다.
- 입력되지 않은 통계·수치·기관 정보는 지어내지 말고 "[확인 필요: 출처/수치]" 처럼 표시합니다.
- 산출목표(활동량)와 성과목표(대상의 변화)를 구분합니다.
- 성과목표마다 측정지표, 측정도구(아래 척도집에서 선택), 측정시기, 달성기준을 명시합니다.
- 세부사업의 실인원·연인원·횟수는 산출목표와 일치시키고, 예산표의 합계는 총예산과 정확히 일치시킵니다.
- 세출 항목은 "단가 × 수량 = 금액" 산출근거를 표로 작성합니다.

[척도집 목차]
${SCALE_CATALOG}

[출력 형식]
반드시 JSON 객체 하나만 출력합니다(코드블록 금지). 키는 아래 섹션 id이고 값은 마크다운 문자열입니다.
${sectionSpec}`;

  const user = `다음 조건으로 ${input.year}년 사업계획서를 작성하세요.

- 사업명: ${input.title}
- 배분분야: ${input.field || "(미지정)"}
- 지역: ${input.region || "(미지정)"}
- 사업기간: ${input.period}
- 대상: ${input.targetDescription}
- 실인원(목표): ${input.targetCount}명
- 총예산: ${won(input.budget)}
- 원하는 효과: ${input.desiredEffect}
${input.extra ? `- 추가 정보: ${input.extra}` : ""}`;

  return { system, user };
}

/** LLM 응답(JSON 문자열, 코드펜스 허용)을 섹션 배열로 변환한다. */
export function parseGeneratedSections(raw: string): GeneratedSection[] {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  let obj: Record<string, unknown> = {};
  if (start !== -1 && end > start) {
    try {
      obj = JSON.parse(text.slice(start, end + 1));
    } catch {
      obj = {};
    }
  }
  const sections = PLAN_SECTIONS.map((s) => {
    const v = obj[s.id];
    const content = typeof v === "string" ? v.trim() : Array.isArray(v) ? v.join("\n") : "";
    return { sectionId: s.id, title: s.title, content };
  });
  // JSON 파싱 실패 시 원문을 첫 섹션에 보존해 내용이 사라지지 않게 한다.
  if (!sections.some((s) => s.content)) sections[0].content = raw.trim();
  return sections;
}

/** 빠른 생성 입력을 대화형 입력(inputData)과 호환되는 형태로 보관한다. */
export function quickInputToInputData(input: QuickPlanInput): Record<string, string[]> {
  return {
    overview: [
      input.title,
      input.period,
      input.region || "",
      input.targetDescription,
      won(input.budget),
      "",
    ],
    goal: ["", "", input.desiredEffect],
    _quick: [JSON.stringify(input)],
  };
}

/** 심사기준 자가진단 프롬프트 */
export function buildSelfCheckPrompt(sections: GeneratedSection[]) {
  const rubric = REVIEW_CRITERIA.map(
    (c) => `### ${c.id} · ${c.title}\n${c.checks.map((x) => `- ${x}`).join("\n")}`
  ).join("\n\n");
  const body = sections.map((s) => `## ${s.title}\n${s.content || "(미작성)"}`).join("\n\n");
  const system = `당신은 공동모금회 배분사업 심사위원입니다. 아래 심사 관점으로 사업계획서를 엄격하게 진단합니다.
점수는 0~100 정수이며, 근거 없이 후하게 주지 않습니다. 반드시 JSON 객체 하나만 출력합니다(코드블록 금지).

[심사 관점]
${rubric}

[출력 JSON 스키마]
{"overall": 정수, "summary": "한두 문장", "criteria": [{"id": "necessity|goal_validity|budget|consistency", "score": 정수, "strengths": ["..."], "improvements": ["구체적 수정 제안"]}], "missing": ["비어있거나 [확인 필요]로 남은 항목"]}`;
  return { system, user: body };
}

export type SelfCheckResult = {
  overall: number;
  summary: string;
  criteria: { id: string; score: number; strengths: string[]; improvements: string[] }[];
  missing: string[];
};

export function parseSelfCheck(raw: string): SelfCheckResult {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("진단 결과를 해석할 수 없습니다.");
  const o = JSON.parse(text.slice(start, end + 1));
  const clamp = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  return {
    overall: clamp(o.overall),
    summary: String(o.summary ?? ""),
    criteria: (Array.isArray(o.criteria) ? o.criteria : []).map((c: any) => ({
      id: String(c.id ?? ""),
      score: clamp(c.score),
      strengths: arr(c.strengths),
      improvements: arr(c.improvements),
    })),
    missing: arr(o.missing),
  };
}
