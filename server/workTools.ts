import { SCALE_CATALOG } from "../shared/businessPlanData";
import { DOC_TYPES, type DocInput, type IdeaInput, type ProgramIdea } from "../shared/workTools";

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

function extractJson(raw: string): any | null {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s === -1 || e <= s) return null;
  try {
    return JSON.parse(text.slice(s, e + 1));
  } catch {
    return null;
  }
}

// ── 프로그램 아이디어 ─────────────────────────────────────────────────────────

export function buildIdeasPrompt(input: IdeaInput, references: string[]) {
  const system = `당신은 사회복지 프로그램 기획 전문가입니다. 대상·예산·목표에 맞는 서로 다른 프로그램 아이디어를 제안합니다.

[원칙]
- 아이디어끼리 접근 방식이 달라야 합니다(예: 교육형, 관계형, 참여·활동형).
- 참고 사례는 '구조와 성과지표 설계'만 참고하고 내용을 베끼지 않습니다.
- 성과지표의 측정도구는 아래 척도집에서 고릅니다. 맞는 것이 없으면 "자체 설문"이라고 씁니다.
- 예산은 총예산을 넘지 않는 범위에서 항목별로 어림잡아 적습니다. 모르는 단가는 지어내지 말고 "[단가 확인 필요]"로 표시합니다.

[척도집 목차]
${SCALE_CATALOG}

[출력] JSON 객체 하나만(코드블록 금지):
{"ideas":[{"name":"프로그램명","summary":"한두 문장","activities":["세부 활동 3~5개"],"outcome":"기대 변화","indicator":"성과지표와 측정도구","budgetEstimate":"항목별 어림 예산"}]}`;
  const user = `${input.count}개의 프로그램 아이디어를 제안해 주세요.
- 대상: ${input.targetGroup}
- 지역: ${input.region || "(미지정)"}
- 총예산: ${won(input.budget)}
- 달성하고 싶은 목표: ${input.goal}
${input.extra ? `- 추가 정보: ${input.extra}\n` : ""}${references.length ? `\n[참고 사례(구조·지표 설계만 참고)]\n${references.map((r, i) => `${i + 1}. ${r}`).join("\n")}` : ""}`;
  return { system, user };
}

export function parseIdeas(raw: string): ProgramIdea[] {
  const obj = extractJson(raw);
  const arr = Array.isArray(obj?.ideas) ? obj.ideas : [];
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return arr
    .map((i: any) => ({
      name: str(i?.name),
      summary: str(i?.summary),
      activities: Array.isArray(i?.activities) ? i.activities.map(String) : [],
      outcome: str(i?.outcome),
      indicator: str(i?.indicator),
      budgetEstimate: str(i?.budgetEstimate),
    }))
    .filter((i: ProgramIdea) => i.name);
}

// ── 행정 서식 ────────────────────────────────────────────────────────────────

const FORMAT_GUIDE: Record<string, string> = {
  draft: `내부기안 형식: 제목 / 1. 관련(근거) / 2. 목적 / 3. 추진내용(일시, 장소, 대상, 세부내용) / 4. 소요예산(산출근거 표) / 5. 기대효과 / 붙임. 끝맺음은 "위와 같이 추진하고자 하오니 결재하여 주시기 바랍니다."`,
  report: `결과보고서 형식: 제목 / 1. 개요(일시, 장소, 대상, 목적) / 2. 추진 경과 / 3. 결과(참여 현황 수치, 주요 내용) / 4. 성과 및 평가 / 5. 문제점 및 개선사항 / 6. 향후계획 / 7. 예산 집행 내역 / 붙임(사진·명단 등).`,
  business: `업무보고서 형식: 제목(기간) / 1. 주요 업무 실적 / 2. 진행 중 업무와 일정 / 3. 이슈 및 건의사항 / 4. 차기 계획.`,
  official: `공문 시행문 형식: 수신 / (경유) / 제목 / 본문(1. 관련 2. 협조 요청 내용 3. 일시·장소 등) / 붙임 / 끝. 문체는 "~하오니 협조하여 주시기 바랍니다."`,
};

export function buildDocPrompt(input: DocInput) {
  const typeInfo = DOC_TYPES.find((d) => d.id === input.type);
  const system = `당신은 사회복지기관 행정 문서 작성 전문가입니다. 한국 공공·복지기관 문서 관행에 맞는 초안을 작성합니다.

[원칙]
- 사용자가 준 사실(일시·장소·인원·금액 등)만 사용합니다. 주어지지 않은 수치·날짜·기관명·법령 근거는 지어내지 말고 "[확인 필요: 항목]"으로 표시합니다.
- 개조식(~함, ~임)과 간결한 문장을 쓰고, 표가 필요하면 마크다운 표를 씁니다.
- 예산이 주어지면 합계가 총액과 정확히 일치하게 합니다.
- 문서 본문만 출력합니다(설명, 인사말, 코드블록 금지).

[서식]
${FORMAT_GUIDE[input.type]}`;
  const user = `${typeInfo?.label ?? ""} 초안을 작성해 주세요.
- 제목/주제: ${input.title}
- 기관: ${input.org || "(미지정)"}
- 알고 있는 사실: ${input.facts}
${input.budget ? `- 예산: ${input.budget}\n` : ""}${input.extra ? `- 추가 요청: ${input.extra}\n` : ""}`;
  return { system, user };
}

export function cleanDocOutput(raw: string): string {
  let t = raw.trim();
  const fence = t.match(/^```(?:markdown|md)?\s*([\s\S]*?)```$/i);
  if (fence) t = fence[1].trim();
  return t;
}
