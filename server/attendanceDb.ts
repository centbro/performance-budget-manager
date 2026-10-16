import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { attendanceRecords, classMembers, participants, programClasses } from "../drizzle/schema";
import type { AttendanceStatus } from "../shared/attendance";
import { getDb } from "./db";

async function db() {
  const d = await getDb();
  if (!d) throw new Error("DB not available");
  return d;
}

export async function listClasses(projectId: number, userId: number) {
  const d = await db();
  const classes = await d.select().from(programClasses).where(and(eq(programClasses.projectId, projectId), eq(programClasses.userId, userId)));
  if (classes.length === 0) return [];
  const counts = await d
    .select({ classId: classMembers.classId, n: sql<number>`count(*)` })
    .from(classMembers)
    .where(inArray(classMembers.classId, classes.map((c) => c.id)))
    .groupBy(classMembers.classId);
  const m = new Map(counts.map((c) => [c.classId, Number(c.n)]));
  return classes.map((c) => ({ ...c, memberCount: m.get(c.id) ?? 0 }));
}

export async function getClass(id: number, userId: number) {
  const d = await db();
  const r = await d.select().from(programClasses).where(and(eq(programClasses.id, id), eq(programClasses.userId, userId))).limit(1);
  return r[0];
}

export async function createClass(projectId: number, userId: number, name: string): Promise<number> {
  const d = await db();
  const r: any = await d.insert(programClasses).values({ projectId, userId, name });
  return Number((Array.isArray(r) ? r[0] : r).insertId);
}

/** 같은 이름의 반이 있으면 그 id, 없으면 새로 만든다 */
export async function findOrCreateClass(projectId: number, userId: number, name: string, cache?: Map<string, number>): Promise<number> {
  const key = name.trim();
  if (cache?.has(key)) return cache.get(key)!;
  const d = await db();
  const found = await d.select().from(programClasses).where(and(eq(programClasses.projectId, projectId), eq(programClasses.userId, userId), eq(programClasses.name, key))).limit(1);
  const id = found[0]?.id ?? (await createClass(projectId, userId, key));
  cache?.set(key, id);
  return id;
}

export async function renameClass(id: number, userId: number, name: string) {
  const d = await db();
  await d.update(programClasses).set({ name }).where(and(eq(programClasses.id, id), eq(programClasses.userId, userId)));
}

export async function deleteClass(id: number, userId: number) {
  const d = await db();
  const c = await getClass(id, userId);
  if (!c) return;
  await d.delete(attendanceRecords).where(eq(attendanceRecords.classId, id));
  await d.delete(classMembers).where(eq(classMembers.classId, id));
  await d.delete(programClasses).where(eq(programClasses.id, id));
}

/** 반 소속 참여자(참여자 정보 포함) */
export async function classMembersOf(classId: number) {
  const d = await db();
  return d
    .select({ id: participants.id, name: participants.name, gender: participants.gender, kind: participants.kind, nationality: participants.nationality, phone: participants.phone })
    .from(classMembers)
    .innerJoin(participants, eq(classMembers.participantId, participants.id))
    .where(eq(classMembers.classId, classId));
}

/** 이 사용자의 이 사업 참여자만 골라낸다(권한·소속 검증) */
async function ownedParticipantIds(projectId: number, userId: number, ids: number[]): Promise<number[]> {
  if (ids.length === 0) return [];
  const d = await db();
  const rows = await d.select({ id: participants.id }).from(participants).where(and(eq(participants.projectId, projectId), eq(participants.userId, userId), inArray(participants.id, ids)));
  return rows.map((r) => r.id);
}

export async function setClassMembers(classId: number, userId: number, participantIds: number[]) {
  const d = await db();
  const c = await getClass(classId, userId);
  if (!c) throw new Error("NOT_FOUND");
  const want = new Set(await ownedParticipantIds(c.projectId, userId, participantIds));
  const cur = await d.select().from(classMembers).where(eq(classMembers.classId, classId));
  const have = new Set(cur.map((m) => m.participantId));
  const toAdd = Array.from(want).filter((id) => !have.has(id));
  const toRemove = cur.filter((m) => !want.has(m.participantId)).map((m) => m.id);
  if (toRemove.length) await d.delete(classMembers).where(inArray(classMembers.id, toRemove));
  if (toAdd.length) await d.insert(classMembers).values(toAdd.map((participantId) => ({ classId, participantId, userId })));
}

export async function setParticipantClasses(participantId: number, userId: number, classIds: number[]) {
  const d = await db();
  const p = (await d.select().from(participants).where(and(eq(participants.id, participantId), eq(participants.userId, userId))).limit(1))[0];
  if (!p) throw new Error("NOT_FOUND");
  const valid = classIds.length
    ? (await d.select({ id: programClasses.id }).from(programClasses).where(and(eq(programClasses.projectId, p.projectId), eq(programClasses.userId, userId), inArray(programClasses.id, classIds)))).map((c) => c.id)
    : [];
  const projectClassIds = (await d.select({ id: programClasses.id }).from(programClasses).where(and(eq(programClasses.projectId, p.projectId), eq(programClasses.userId, userId)))).map((c) => c.id);
  if (projectClassIds.length) await d.delete(classMembers).where(and(eq(classMembers.participantId, participantId), inArray(classMembers.classId, projectClassIds)));
  if (valid.length) await d.insert(classMembers).values(valid.map((classId) => ({ classId, participantId, userId })));
}

/** 참여자 → 소속 반 목록 (사업 단위) */
export async function participantClassMap(projectId: number, userId: number) {
  const d = await db();
  const rows = await d
    .select({ participantId: classMembers.participantId, classId: programClasses.id, name: programClasses.name })
    .from(classMembers)
    .innerJoin(programClasses, eq(classMembers.classId, programClasses.id))
    .where(and(eq(programClasses.projectId, projectId), eq(programClasses.userId, userId)));
  const map: Record<number, { id: number; name: string }[]> = {};
  for (const r of rows) (map[r.participantId] ??= []).push({ id: r.classId, name: r.name });
  return map;
}

export async function addToClass(classId: number, participantId: number, userId: number) {
  const d = await db();
  const ex = await d.select().from(classMembers).where(and(eq(classMembers.classId, classId), eq(classMembers.participantId, participantId))).limit(1);
  if (!ex.length) await d.insert(classMembers).values({ classId, participantId, userId });
}

export async function getRecords(classId: number, from: string, to: string) {
  const d = await db();
  return d
    .select({ participantId: attendanceRecords.participantId, date: attendanceRecords.attendDate, status: attendanceRecords.status })
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.classId, classId), gte(attendanceRecords.attendDate, from), lt(attendanceRecords.attendDate, to)));
}

/** 출결 저장(status null = 기록 삭제). 반 소속이 아닌 참여자는 무시 */
export async function saveMarks(classId: number, userId: number, date: string, entries: { participantId: number; status: AttendanceStatus | null }[]) {
  const d = await db();
  const members = new Set((await d.select({ id: classMembers.participantId }).from(classMembers).where(eq(classMembers.classId, classId))).map((m) => m.id));
  const ok = entries.filter((e) => members.has(e.participantId));
  const del = ok.filter((e) => e.status === null).map((e) => e.participantId);
  if (del.length) await d.delete(attendanceRecords).where(and(eq(attendanceRecords.classId, classId), eq(attendanceRecords.attendDate, date), inArray(attendanceRecords.participantId, del)));
  for (const e of ok) {
    if (e.status === null) continue;
    await d
      .insert(attendanceRecords)
      .values({ classId, participantId: e.participantId, userId, attendDate: date, status: e.status })
      .onDuplicateKeyUpdate({ set: { status: e.status } });
  }
  return { saved: ok.length };
}
