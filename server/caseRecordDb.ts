import { and, desc, eq, gte, lte } from "drizzle-orm";
import { caseRecords } from "../drizzle/schema";
import { getDb } from "./db";

export type CaseRecordInput = {
  userId: number;
  templateId: number;
  templateName: string;
  recordDate: string;
  subject: string;
  category: string;
  summary: string;
  fields: { heading: string; content: string }[];
};

export async function createCaseRecord(p: CaseRecordInput) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const r = await db.insert(caseRecords).values({ ...p, fields: JSON.stringify(p.fields) });
  return (r[0] as { insertId: number }).insertId;
}

export async function listCaseRecords(userId: number, f: { from?: string; to?: string } = {}) {
  const db = await getDb();
  if (!db) return [];
  const conds = [eq(caseRecords.userId, userId)];
  if (f.from) conds.push(gte(caseRecords.recordDate, f.from));
  if (f.to) conds.push(lte(caseRecords.recordDate, f.to));
  const rows = await db
    .select()
    .from(caseRecords)
    .where(and(...conds))
    .orderBy(desc(caseRecords.recordDate), desc(caseRecords.id))
    .limit(3000);
  return rows.map((r) => ({ ...r, fields: safeFields(r.fields) }));
}

function safeFields(s: string): { heading: string; content: string }[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export async function updateCaseRecord(
  id: number,
  userId: number,
  p: Partial<Pick<CaseRecordInput, "recordDate" | "subject" | "category" | "summary" | "fields">>
) {
  const db = await getDb();
  if (!db) return;
  const { fields, ...rest } = p;
  await db
    .update(caseRecords)
    .set({ ...rest, ...(fields ? { fields: JSON.stringify(fields) } : {}) })
    .where(and(eq(caseRecords.id, id), eq(caseRecords.userId, userId)));
}

export async function deleteCaseRecord(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(caseRecords).where(and(eq(caseRecords.id, id), eq(caseRecords.userId, userId)));
}
