import { getProjectEvalData } from "./db";
import { classMembersOf, getRecords, listClasses } from "./attendanceDb";
import { listCaseRecords } from "./caseRecordDb";
import { computeCaseStats } from "./caseRecord";
import { resolveEvaluationPeriod, type EvaluationPeriod } from "./evaluationPeriod";
import { ATTENDANCE_STATUSES, summarize, type AttendanceStatus } from "../shared/attendance";
import type { ReportFacts } from "./resultReport";

const pad = (n: number) => String(n).padStart(2, "0");

/** 선택한 월 범위를 [from, to) 날짜 문자열로 */
export function monthsToRange(year: number, months: number[]) {
  const lo = Math.min(...months);
  const hi = Math.max(...months);
  return { from: `${year}-${pad(lo)}-01`, to: hi === 12 ? `${year + 1}-01-01` : `${year}-${pad(hi + 1)}-01`, lastDay: new Date(year, hi, 0).getDate(), lo, hi };
}

/** 큰 사업 1건의 실적·출석·사례·예산을 한곳에 모은다(결과보고서·미리보기 공용). */
export async function gatherReportFacts(p: {
  parentId: number; userId: number; year: number;
  period: EvaluationPeriod; customStartMonth?: number; customEndMonth?: number;
  includeAttendance: boolean; includeCases: boolean;
}): Promise<ReportFacts | null> {
  const data = await getProjectEvalData(p.parentId, p.userId, p.year);
  if (!data) return null;
  const { months, label } = resolveEvaluationPeriod(p.period, p.customStartMonth, p.customEndMonth);
  const recs = data.records.filter((r) => months.includes(parseInt(r.date.slice(5, 7), 10)));

  const subs = data.subList.map((s) => {
    const mine = recs.filter((r) => r.projectId === s.id);
    const people = new Set<number>();
    const male = new Set<number>();
    const female = new Set<number>();
    let extended = 0;
    let count = 0;
    for (const r of mine) {
      count += r.count;
      for (const id of r.allParticipantIds) { people.add(id); extended += r.count; }
      r.malePeople.forEach((id) => male.add(id));
      r.femalePeople.forEach((id) => female.add(id));
    }
    const notes = Array.from(new Set(mine.map((r) => r.note.trim()).filter(Boolean)));
    return {
      name: s.name, plannedPeople: s.plannedPeople, plannedExtended: s.plannedExtended, plannedCount: s.plannedCount,
      actualPeople: people.size, actualExtended: extended, actualCount: count, male: male.size, female: female.size, isAdHoc: s.isAdHoc, notes,
    };
  });
  const unique = new Set<number>();
  for (const r of recs) for (const id of r.allParticipantIds) unique.add(id);

  const range = monthsToRange(p.year, months);

  let attendance: ReportFacts["attendance"] = null;
  if (p.includeAttendance) {
    const classes = await listClasses(p.parentId, p.userId);
    attendance = await Promise.all(classes.map(async (c) => {
      const [members, rows] = await Promise.all([classMembersOf(c.id), getRecords(c.id, range.from, range.to)]);
      const sum = summarize(
        rows.filter((r) => (ATTENDANCE_STATUSES as readonly string[]).includes(r.status)) as { participantId: number; date: string; status: AttendanceStatus }[],
        members.map((m) => m.id),
      );
      return { className: c.name, members: members.length, people: sum.people, extended: sum.extended, sessions: sum.dates.length, rate: sum.all.rate };
    }));
    if (attendance.every((a) => a.sessions === 0)) attendance = null;
  }

  let cases: ReportFacts["cases"] = null;
  if (p.includeCases) {
    const list = await listCaseRecords(p.userId, { from: range.from, to: `${p.year}-${pad(range.hi)}-${pad(range.lastDay)}` });
    if (list.length) {
      const st = computeCaseStats(list.map((r: any) => ({ recordDate: String(r.recordDate).slice(0, 10), subject: r.subject ?? "", category: r.category ?? "", templateName: r.templateName ?? "" })));
      cases = { total: st.total, people: st.people, byCategory: st.byCategory };
    }
  }

  const b = data.budget;
  return {
    projectName: data.parent.projectName, year: p.year, periodLabel: label, subs, uniquePeople: unique.size, attendance, cases,
    budget: b ? { total: b.totalBudget, spent: b.totalSpent, remaining: b.remaining, rate: b.totalBudget > 0 ? Math.round((b.totalSpent / b.totalBudget) * 1000) / 10 : 0 } : null,
  };
}
