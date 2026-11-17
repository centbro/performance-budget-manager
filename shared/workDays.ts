/** 사용자별 근무 요일. 0=일 … 6=토. 저장 형식은 "1,2,3,4,5". */
export const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5];

export function parseWorkDays(raw: string | null | undefined): number[] {
  const days = Array.from(
    new Set(
      (raw ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s !== "")
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    )
  ).sort((a, b) => a - b);
  return days.length ? days : [...DEFAULT_WORK_DAYS];
}

export function serializeWorkDays(days: number[]): string {
  return parseWorkDays(days.join(",")).join(",");
}

/** 오늘(또는 지정일)이 쉬는 요일이면 가장 가까운 다음 근무일을 돌려준다. 근무일이면 그대로. */
export function onOrAfterWorkday(from: Date, workDays: number[]): Date {
  const set = new Set(parseWorkDays(workDays.join(",")));
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < 7; i++) {
    if (set.has(d.getDay())) return d;
    d.setDate(d.getDate() + 1);
  }
  return new Date(from.getFullYear(), from.getMonth(), from.getDate());
}
