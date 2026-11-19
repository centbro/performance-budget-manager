// 대한민국 관공서 공휴일(대체공휴일·임시공휴일 포함). 우주항공청 월력요항·관보 기준.
// 설날·추석처럼 음력으로 정해지는 날이 있어 해마다 표를 직접 갱신해야 한다. (현재 2025~2027년)
// 2027년부터 노동절(5/1)·제헌절(7/17)이 공휴일이 됐고, 현충일(6/6)에는 대체공휴일이 없다.
export const HOLIDAY_YEARS = [2025, 2026, 2027] as const;

export const HOLIDAYS: Record<string, string> = {
  // 2025
  "2025-01-01": "신정",
  "2025-01-27": "임시공휴일",
  "2025-01-28": "설날 연휴",
  "2025-01-29": "설날",
  "2025-01-30": "설날 연휴",
  "2025-03-01": "삼일절",
  "2025-03-03": "대체공휴일",
  "2025-05-05": "어린이날·부처님오신날",
  "2025-05-06": "대체공휴일",
  "2025-06-03": "대통령선거일",
  "2025-06-06": "현충일",
  "2025-08-15": "광복절",
  "2025-10-03": "개천절",
  "2025-10-05": "추석 연휴",
  "2025-10-06": "추석",
  "2025-10-07": "추석 연휴",
  "2025-10-08": "대체공휴일",
  "2025-10-09": "한글날",
  "2025-12-25": "성탄절",
  // 2026
  "2026-01-01": "신정",
  "2026-02-16": "설날 연휴",
  "2026-02-17": "설날",
  "2026-02-18": "설날 연휴",
  "2026-03-01": "삼일절",
  "2026-03-02": "대체공휴일",
  "2026-05-05": "어린이날",
  "2026-05-24": "부처님오신날",
  "2026-05-25": "대체공휴일",
  "2026-06-03": "지방선거",
  "2026-06-06": "현충일",
  "2026-08-15": "광복절",
  "2026-08-17": "대체공휴일",
  "2026-09-24": "추석 연휴",
  "2026-09-25": "추석",
  "2026-09-26": "추석 연휴",
  "2026-10-03": "개천절",
  "2026-10-05": "대체공휴일",
  "2026-10-09": "한글날",
  "2026-12-25": "성탄절",
  // 2027
  "2027-01-01": "신정",
  "2027-02-06": "설날 연휴",
  "2027-02-07": "설날",
  "2027-02-08": "설날 연휴",
  "2027-02-09": "대체공휴일",
  "2027-03-01": "삼일절",
  "2027-05-01": "노동절",
  "2027-05-03": "대체공휴일",
  "2027-05-05": "어린이날",
  "2027-05-13": "부처님오신날",
  "2027-06-06": "현충일",
  "2027-07-17": "제헌절",
  "2027-07-19": "대체공휴일",
  "2027-08-15": "광복절",
  "2027-08-16": "대체공휴일",
  "2027-09-14": "추석 연휴",
  "2027-09-15": "추석",
  "2027-09-16": "추석 연휴",
  "2027-10-03": "개천절",
  "2027-10-04": "대체공휴일",
  "2027-10-09": "한글날",
  "2027-10-11": "대체공휴일",
  "2027-12-25": "성탄절",
  "2027-12-27": "대체공휴일",
};

/** 'YYYY-MM-DD' → 공휴일 이름(공휴일이 아니면 undefined) */
export const holidayName = (dateStr: string): string | undefined => HOLIDAYS[dateStr];

/** 표에 들어 있는 연도인가 (아니면 공휴일이 표시되지 않는다) */
export const hasHolidayData = (year: number) => (HOLIDAY_YEARS as readonly number[]).includes(year);

const pad = (n: number) => String(n).padStart(2, "0");
const toStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));

/**
 * 기간(start~end, 양끝 포함)에서 쉬는 날을 뺀 연속 구간들을 돌려준다.
 * 쉬는 날 = 공휴일, 또는 내 근무 요일이 아닌 요일(주말 등).
 */
export function workingSegments(start: string, end: string, workDays: number[]) {
  const work = new Set(workDays);
  const segments: { start: string; end: string; days: number }[] = [];
  let total = 0;
  let excluded = 0;
  let cur: { start: string; end: string; days: number } | null = null;
  for (let d = parse(start); toStr(d) <= end; d.setDate(d.getDate() + 1)) {
    total++;
    const s = toStr(d);
    const off = !work.has(d.getDay()) || holidayName(s) !== undefined;
    if (off) {
      excluded++;
      if (cur) { segments.push(cur); cur = null; }
    } else if (cur) {
      cur.end = s; cur.days++;
    } else {
      cur = { start: s, end: s, days: 1 };
    }
    if (total > 400) break; // 비정상 기간 방지
  }
  if (cur) segments.push(cur);
  return { segments, total, excluded, workdays: total - excluded };
}
