// 출석부 공용 로직 (서버·클라이언트 공통)
export const ATTENDANCE_STATUSES = ["present", "late", "absent", "excused"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const STATUS_META: Record<AttendanceStatus, { label: string; mark: string }> = {
  present: { label: "출석", mark: "○" },
  late: { label: "지각", mark: "△" },
  absent: { label: "결석", mark: "✕" },
  excused: { label: "사유", mark: "□" },
};

export const isDateStr = (s: unknown): s is string => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

export type AttRecord = { participantId: number; date: string; status: AttendanceStatus };
export type Tally = { present: number; late: number; absent: number; excused: number; recorded: number; rate: number | null };

const emptyTally = (): Tally => ({ present: 0, late: 0, absent: 0, excused: 0, recorded: 0, rate: null });

/** 출석률 = (출석+지각) ÷ (출석+지각+결석). 사유(공결)는 계산에서 제외. 기록이 없으면 null */
export function finishTally(t: Tally): Tally {
  const denom = t.present + t.late + t.absent;
  t.recorded = t.present + t.late + t.absent + t.excused;
  t.rate = denom === 0 ? null : Math.round(((t.present + t.late) / denom) * 1000) / 10;
  return t;
}

/** 참여자별·날짜별 집계 */
export function summarize(records: AttRecord[], participantIds: number[]) {
  const ids = new Set(participantIds);
  const byParticipant = new Map<number, Tally>(participantIds.map((id) => [id, emptyTally()]));
  const byDate = new Map<string, Tally>();
  const all = emptyTally();
  for (const r of records) {
    if (!ids.has(r.participantId)) continue;
    for (const t of [byParticipant.get(r.participantId)!, byDate.get(r.date) ?? (byDate.set(r.date, emptyTally()), byDate.get(r.date)!), all]) {
      t[r.status] += 1;
    }
  }
  byParticipant.forEach(finishTally);
  byDate.forEach(finishTally);
  finishTally(all);
  return { byParticipant, byDate, all, dates: Array.from(byDate.keys()).sort() };
}

/** 'YYYY-MM' 의 첫날·다음 달 첫날 */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { from: `${month}-01`, to: `${next}-01` };
}
