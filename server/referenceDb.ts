import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { referenceChunks, referenceDocs } from "../drizzle/schema";
import { getDb } from "./db";

export async function createReferenceDoc(p: {
  userId: number;
  name: string;
  pageCount: number;
  chunks: { page: number; text: string }[];
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const r = await db.insert(referenceDocs).values({ userId: p.userId, name: p.name, pageCount: p.pageCount });
  const docId = (r[0] as { insertId: number }).insertId;
  // 큰 자료도 한 번에 넣지 않도록 나누어 저장
  for (let i = 0; i < p.chunks.length; i += 200) {
    await db.insert(referenceChunks).values(
      p.chunks.slice(i, i + 200).map((c) => ({ docId, userId: p.userId, page: c.page, text: c.text }))
    );
  }
  return docId;
}

export async function countUserDocs(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const r = await db.select({ n: sql<number>`count(*)` }).from(referenceDocs).where(eq(referenceDocs.userId, userId));
  return Number(r[0]?.n ?? 0);
}

export async function listReferenceDocs(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ id: referenceDocs.id, name: referenceDocs.name, pageCount: referenceDocs.pageCount, createdAt: referenceDocs.createdAt })
    .from(referenceDocs)
    .where(eq(referenceDocs.userId, userId))
    .orderBy(desc(referenceDocs.createdAt));
}

/** 본인 자료의 조각만 가져온다(검색용). */
export async function getUserChunks(userId: number, docIds?: number[]) {
  const db = await getDb();
  if (!db) return [];
  const where = docIds && docIds.length
    ? and(eq(referenceChunks.userId, userId), inArray(referenceChunks.docId, docIds))
    : eq(referenceChunks.userId, userId);
  return db
    .select({ docId: referenceChunks.docId, docName: referenceDocs.name, page: referenceChunks.page, text: referenceChunks.text })
    .from(referenceChunks)
    .innerJoin(referenceDocs, eq(referenceDocs.id, referenceChunks.docId))
    .where(where)
    .limit(8000);
}

export async function deleteReferenceDoc(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(referenceChunks).where(and(eq(referenceChunks.docId, id), eq(referenceChunks.userId, userId)));
  await db.delete(referenceDocs).where(and(eq(referenceDocs.id, id), eq(referenceDocs.userId, userId)));
}
