// 이용 기간(남은 기간) 계산 — 서버·클라이언트 공용
const DAY = 86400000;
const KST = 9 * 3600 * 1000;

/** YYYY-MM-DD(한국 날짜)의 마지막 순간(23:59:59 KST) */
export function endOfDayKst(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59+09:00`);
}

/** Date → 한국 날짜 YYYY-MM-DD */
export function kstDateString(d: Date): string {
  return new Date(d.getTime() + KST).toISOString().slice(0, 10);
}

/** 현재 만료일(없으면 오늘)과 지금 중 더 늦은 날을 기준으로 days일 연장한 만료일 */
export function extendAccess(current: Date | null, days: number, now: Date = new Date()): Date {
  const base = current && current.getTime() > now.getTime() ? current : now;
  return endOfDayKst(kstDateString(new Date(base.getTime() + days * DAY)));
}

export type AccessInfo =
  | { state: "unlimited" }
  | { state: "active"; daysLeft: number; until: string; warn: boolean }
  | { state: "expired"; daysAgo: number; until: string };

/** 남은 일수: 만료일(한국 날짜) 기준 오늘 포함 D-day. 만료일 당일은 D-0. */
export function accessInfo(accessUntil: Date | string | null | undefined, now: Date = new Date()): AccessInfo {
  if (!accessUntil) return { state: "unlimited" };
  const end = new Date(accessUntil);
  const until = kstDateString(end);
  const todayMs = new Date(`${kstDateString(now)}T00:00:00Z`).getTime();
  const untilMs = new Date(`${until}T00:00:00Z`).getTime();
  const diff = Math.round((untilMs - todayMs) / DAY);
  if (end.getTime() < now.getTime()) return { state: "expired", daysAgo: Math.max(1, -diff), until };
  return { state: "active", daysLeft: diff, until, warn: diff <= 7 };
}
