import { extractJson } from "./docTemplate";
import { normalizeDate } from "./caseRecord";

export const SCHEDULE_COLORS = ["blue", "green", "red", "orange", "purple", "pink"] as const;
const WD = ["일", "월", "화", "수", "목", "금", "토"];

export type ParsedSchedule = {
  title: string;
  startDate: string;
  endDate: string;
  time: string;
  description: string;
  projectId: number | null;
  color: string;
};

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** 상대 날짜("다음주 화요일")를 AI가 틀리지 않도록 앞으로 4주 달력을 만들어 준다. today는 YYYY-MM-DD(KST). */
export function buildCalendarRef(today: string, days = 28): string {
  const base = new Date(`${today}T00:00:00Z`);
  const lines: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(base.getTime() + i * 86400000);
    lines.push(`${ymd(d)}(${WD[d.getUTCDay()]})`);
  }
  return lines.join(" ");
}

export function buildSchedulePrompt(text: string, today: string, projects: { id: number; name: string }[]) {
  const base = new Date(`${today}T00:00:00Z`);
  const system = `당신은 사회복지기관 담당자의 일정 비서입니다. 담당자가 편하게 쓴 말에서 등록할 일정을 모두 찾아 구조화합니다.

[오늘] ${today}(${WD[base.getUTCDay()]}요일). 주는 월요일~일요일 기준이며 "이번 주"는 오늘이 속한 주, "다음 주 X요일"은 그 다음 주의 X요일입니다.
[앞으로 4주 달력] ${buildCalendarRef(today)}

[원칙]
- 한 문장에 일정이 여러 개면 각각 분리합니다. 일정이 아닌 말(인사, 질문)은 무시합니다.
- 날짜는 YYYY-MM-DD. 기간이면 startDate~endDate, 하루면 둘을 같게. "~까지"만 있으면 마감일 하루짜리로 두고 title에 "마감"을 붙입니다.
- 연도가 없으면 오늘 이후 가장 가까운 날짜로 해석합니다. 날짜를 알 수 없으면 그 일정은 만들지 않습니다.
- 시간(오후 2시 등)이 있으면 time에 "14:00" 또는 "14:00~16:00"로, 없으면 빈 문자열.
- projectId는 아래 사업 목록에서 이름이 분명히 맞는 것만 고릅니다. 사업과 무관한 개인·일반 업무 일정(연차, 병원, 개인 약속, 일반 사무 등)은 0, 어느 쪽인지 애매하면 null.
- title은 간결하게(예: "명랑운동회 준비회의"), description에는 장소·준비물·참석자 등 부가 내용.
- color는 blue/green/red/orange/purple/pink 중 하나(행사=orange, 회의=blue, 마감·보고=red, 교육=green 정도로 구분).

[등록된 사업 목록]
${projects.length ? projects.map((p) => `- ${p.id}: ${p.name}`).join("\n") : "(없음)"}

JSON 객체 하나만 출력(코드블록 금지): {"items":[{"title":"","startDate":"","endDate":"","time":"","description":"","projectId":null,"color":"blue"}]}`;
  return { system, user: text };
}

export function parseScheduleItems(raw: string, projectIds: number[], today: string): ParsedSchedule[] {
  const o = extractJson(raw);
  const arr: any[] = Array.isArray(o?.items) ? o.items : [];
  const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  const out: ParsedSchedule[] = [];
  for (const it of arr.slice(0, 20)) {
    const title = str(it?.title, 200);
    const start = normalizeDate(it?.startDate);
    if (!title || !start) continue;
    let end = normalizeDate(it?.endDate, start);
    if (end < start) end = start;
    const rawPid = it?.projectId;
    const pid = typeof rawPid === "number" ? rawPid : typeof rawPid === "string" && /^\d+$/.test(rawPid) ? Number(rawPid) : NaN;
    out.push({
      title,
      startDate: start,
      endDate: end,
      time: str(it?.time, 30),
      description: str(it?.description, 1000),
      projectId: Number.isInteger(pid) && (pid === 0 || projectIds.includes(pid)) ? pid : null,
      color: (SCHEDULE_COLORS as readonly string[]).includes(it?.color) ? it.color : "blue",
    });
  }
  return out;
}

/** 시간 정보를 설명 앞에 붙인다(일정 테이블에는 시간 칸이 없음). */
export function withTime(description: string, time: string) {
  return [time ? `시간: ${time}` : "", description].filter(Boolean).join("\n");
}
