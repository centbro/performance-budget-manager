import { and, desc, eq } from "drizzle-orm";
import { docTemplates } from "../drizzle/schema";
import { getDb } from "./db";

export async function createTemplate(p: { userId: number; name: string; analysis: string; sampleText: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const r = await db.insert(docTemplates).values(p);
  return (r[0] as { insertId: number }).insertId;
}

export async function listTemplates(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ id: docTemplates.id, name: docTemplates.name, createdAt: docTemplates.createdAt })
    .from(docTemplates)
    .where(eq(docTemplates.userId, userId))
    .orderBy(desc(docTemplates.createdAt));
}

/** 본인 소유 양식만 조회한다. */
export async function getTemplate(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(docTemplates)
    .where(and(eq(docTemplates.id, id), eq(docTemplates.userId, userId)));
  return rows[0] ?? null;
}

export async function deleteTemplate(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(docTemplates).where(and(eq(docTemplates.id, id), eq(docTemplates.userId, userId)));
}
