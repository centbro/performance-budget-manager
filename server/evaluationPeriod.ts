export type EvaluationPeriod = "q1" | "q2" | "q3" | "q4" | "h1" | "h2" | "annual" | "custom";

const PREDEFINED_PERIODS: Record<Exclude<EvaluationPeriod, "custom">, { label: string; months: number[] }> = {
  q1: { label: "1분기(1~3월)", months: [1, 2, 3] },
  q2: { label: "2분기(4~6월)", months: [4, 5, 6] },
  q3: { label: "3분기(7~9월)", months: [7, 8, 9] },
  q4: { label: "4분기(10~12월)", months: [10, 11, 12] },
  h1: { label: "상반기(1~6월)", months: [1, 2, 3, 4, 5, 6] },
  h2: { label: "하반기(7~12월)", months: [7, 8, 9, 10, 11, 12] },
  annual: { label: "연간(1~12월)", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
};

export function resolveEvaluationPeriod(
  period: EvaluationPeriod,
  customStartMonth?: number,
  customEndMonth?: number,
): { label: string; months: number[] } {
  if (period !== "custom") return PREDEFINED_PERIODS[period];
  if (
    customStartMonth === undefined ||
    customEndMonth === undefined ||
    customStartMonth < 1 ||
    customEndMonth > 12 ||
    customStartMonth > customEndMonth
  ) {
    throw new Error("사용자 지정 평가 기간의 월 범위가 올바르지 않습니다.");
  }
  return {
    label: `${customStartMonth}~${customEndMonth}월`,
    months: Array.from(
      { length: customEndMonth - customStartMonth + 1 },
      (_, index) => customStartMonth + index,
    ),
  };
}
