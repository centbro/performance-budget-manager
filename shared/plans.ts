// 요금제·AI 사용 정책 — 서버·클라이언트 공용. 숫자는 여기서만 바꾼다.
export const PLANS = {
  pro: { label: "프로", price: 9900 },
  premium: { label: "프리미엄", price: 15000 },
} as const;
export type PlanId = keyof typeof PLANS;
export const isPlanId = (v: unknown): v is PlanId => v === "pro" || v === "premium";

/** 모든 사용자 공통: 한 달 AI 호출 총량 상한(비용 폭주·자동화 남용 방지). 관리자는 제외. */
export const FAIR_USE_MONTHLY_CALLS = 800;

export type AiFeatureKey =
  | "plan_chat" | "plan_generate" | "grant_review"
  | "ideas" | "idea_eval" | "doc" | "template_fill" | "template_upload"
  | "case_record" | "promo" | "schedule" | "evaluation" | "result_report" | "translate" | "bot_chat";

type Policy = { label: string; premiumOnly: boolean; monthly: { pro?: number; premium?: number } };

/** monthly에 값이 없는 요금제는 무제한 */
export const AI_FEATURES: Record<AiFeatureKey, Policy> = {
  plan_chat: { label: "사업계획서 대화형 작성", premiumOnly: true, monthly: {} },
  plan_generate: { label: "사업계획서 생성", premiumOnly: true, monthly: { premium: 60 } },
  grant_review: { label: "공모사업 점수 평가·자가진단", premiumOnly: true, monthly: { premium: 80 } },
  ideas: { label: "프로그램 아이디어", premiumOnly: false, monthly: { pro: 20 } },
  idea_eval: { label: "아이디어 점수 평가", premiumOnly: false, monthly: { pro: 30 } },
  doc: { label: "행정 문서 초안", premiumOnly: false, monthly: {} },
  template_fill: { label: "기관 양식으로 문서 작성", premiumOnly: false, monthly: {} },
  template_upload: { label: "기관 양식 등록(분석)", premiumOnly: false, monthly: {} },
  case_record: { label: "사례 기록 정리", premiumOnly: false, monthly: {} },
  promo: { label: "홍보·소식글", premiumOnly: false, monthly: {} },
  schedule: { label: "대화로 일정 추가", premiumOnly: false, monthly: {} },
  evaluation: { label: "평가서 생성", premiumOnly: false, monthly: {} },
  result_report: { label: "결과보고서 생성", premiumOnly: false, monthly: { pro: 10 } },
  translate: { label: "다국어 안내문", premiumOnly: false, monthly: {} },
  bot_chat: { label: "텔레그램 대화 해석", premiumOnly: false, monthly: {} },
};

export const BLOCK_PREFIX = "[이용제한] ";

export type AiDecision = { ok: true } | { ok: false; reason: "expired" | "premium_only" | "limit" | "fair_use"; message: string };

/** AI 기능 사용 가능 여부. 관리자는 항상 허용. */
export function checkAiAccess(p: {
  role: string;
  plan: string;
  accessUntil: Date | string | null | undefined;
  feature: AiFeatureKey;
  usedThisFeature: number;
  usedTotal: number;
  now?: Date;
}): AiDecision {
  if (p.role === "admin") return { ok: true };
  const now = p.now ?? new Date();
  const plan: PlanId = isPlanId(p.plan) ? p.plan : "pro";
  const pol = AI_FEATURES[p.feature];
  if (p.accessUntil && new Date(p.accessUntil).getTime() < now.getTime()) {
    return { ok: false, reason: "expired", message: `${BLOCK_PREFIX}이용 기간이 만료되어 AI 기능을 사용할 수 없습니다. 만들어 둔 기록·일정은 계속 볼 수 있습니다. 연장은 의견 게시판으로 문의해 주세요.` };
  }
  if (pol.premiumOnly && plan !== "premium") {
    return { ok: false, reason: "premium_only", message: `${BLOCK_PREFIX}'${pol.label}'은(는) 프리미엄 요금제 전용 기능입니다. 변경은 의견 게시판으로 문의해 주세요.` };
  }
  const limit = pol.monthly[plan];
  if (limit !== undefined && p.usedThisFeature >= limit) {
    return { ok: false, reason: "limit", message: `${BLOCK_PREFIX}'${pol.label}'을(를) 이번 달 ${limit}회 모두 사용했습니다.${plan === "pro" ? " 프리미엄 요금제는 제한 없이 쓸 수 있습니다." : ""} 다음 달 1일에 초기화됩니다.` };
  }
  if (p.usedTotal >= FAIR_USE_MONTHLY_CALLS) {
    return { ok: false, reason: "fair_use", message: `${BLOCK_PREFIX}이번 달 AI 사용량이 공정 사용 한도(${FAIR_USE_MONTHLY_CALLS}회)에 도달했습니다. 필요하시면 의견 게시판으로 문의해 주세요.` };
  }
  return { ok: true };
}

/** 한국 시간 기준 이번 달 1일 00:00 */
export function monthStartKst(now: Date = new Date()): Date {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 7);
  return new Date(`${kst}-01T00:00:00+09:00`);
}
