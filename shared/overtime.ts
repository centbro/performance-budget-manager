/** 스케줄 관리의 '야근' 개인 일정을 월별로 합산한다. 시간은 일정 설명 첫 줄 "시간: 18:00~21:30"에서 읽는다. */

export type OvertimeSource = {
  projectId: number;
  title: string;
  description?: string | null;
  startDate: Date | string;
  endDate: Date | string;
};

export type OvertimeDay = { dateKey: string; day: number; dow: number; minutes: number | null; range: string; title: string };
export type OvertimeSummary = { days: OvertimeDay[]; totalMinutes: number; dayCount: number; untimedDays: number };

const TIME_LINE = /^시간:\s*(.+)$/m;
const HM = /^(\d{1,2}):(\d{2})$/;

export const isOvertime = (s: { projectId: number; title: string }) => s.projectId === 0 && /^야근/.test(s.title.trim());

/** "18:00~21:30" → 210분. 끝 시각이 없거나 읽을 수 없으면 null. 자정을 넘기면(끝 ≤ 시작) 다음 날로 본다. */
export function minutesOfRange(range: string): number | null {
  const [a, b] = range.split("~").map((x) => x.trim());
  const ma = a?.match(HM);
  const mb = b?.match(HM);
  if (!ma || !mb) return null;
  const start = Number(ma[1]) * 60 + Number(ma[2]);
  const end = Number(mb[1]) * 60 + Number(mb[2]);
  if (start > 24 * 60 || end > 24 * 60 || Number(ma[2]) > 59 || Number(mb[2]) > 59) return null;
  const diff = end > start ? end - start : end + 24 * 60 - start;
  return diff;
}

export function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h && r) return `${h}시간 ${r}분`;
  if (h) return `${h}시간`;
  return `${r}분`;
}

function crossesMidnight(range: string): boolean {
  const [a, b] = range.split("~").map((x) => x.trim());
  const ma = a?.match(HM);
  const mb = b?.match(HM);
  if (!ma || !mb) return false;
  return Number(mb[1]) * 60 + Number(mb[2]) <= Number(ma[1]) * 60 + Number(ma[2]);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** year/month(1~12)에 속한 날짜만 합산. 같은 날 야근이 둘 이상이면 각각 더한다. */
export function summarizeOvertime(items: OvertimeSource[], year: number, month: number): OvertimeSummary {
  const days: OvertimeDay[] = [];
  for (const s of items) {
    if (!isOvertime(s)) continue;
    const range = s.description?.match(TIME_LINE)?.[1]?.trim() ?? "";
    const minutes = range ? minutesOfRange(range) : null;
    const cur = new Date(s.startDate);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(s.endDate);
    end.setHours(0, 0, 0, 0);
    // 밤샘 야근(시작일 22:00 ~ 다음 날 01:00)은 한 번의 야근이므로 시작일에만 세고, 그 외 여러 날 일정은 날마다 센다
    if (end.getTime() - cur.getTime() === 24 * 60 * 60 * 1000 && range && crossesMidnight(range)) end.setTime(cur.getTime());
    while (cur <= end) {
      if (cur.getFullYear() === year && cur.getMonth() + 1 === month) {
        days.push({ dateKey: `${year}-${pad(month)}-${pad(cur.getDate())}`, day: cur.getDate(), dow: cur.getDay(), minutes, range, title: s.title });
      }
      cur.setDate(cur.getDate() + 1);
    }
  }
  days.sort((a, b) => a.day - b.day);
  const totalMinutes = days.reduce((t, d) => t + (d.minutes ?? 0), 0);
  return { days, totalMinutes, dayCount: new Set(days.map((d) => d.day)).size, untimedDays: days.filter((d) => d.minutes === null).length };
}
