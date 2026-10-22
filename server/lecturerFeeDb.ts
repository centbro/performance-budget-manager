import { and, desc, eq } from "drizzle-orm";
import { lecturerFeeSets } from "../drizzle/schema";
import { getDb } from "./db";
import { parseRows, sumRows, type FeeRow } from "../shared/lecturerFee";

export const MAX_FEE_SETS = 100;

export async function listFeeSets(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(lecturerFeeSets).where(eq(lecturerFeeSets.userId, userId)).orderBy(desc(lecturerFeeSets.id)).limit(MAX_FEE_SETS);
  return rows.map((r) => {
    const list = parseRows(r.rowsJson);
    return { id: r.id, title: r.title, rows: list, totals: sumRows(list), updatedAt: r.updatedAt };
  });
}

/** id가 있으면 내 것만 갱신, 없으면 새로 저장 */
export async function saveFeeSet(userId: number, input: { id?: number; title: string; rows: FeeRow[] }): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const rowsJson = JSON.stringify(input.rows);
  if (input.id) {
    const r: any = await db.update(lecturerFeeSets).set({ title: input.title, rowsJson }).where(and(eq(lecturerFeeSets.id, input.id), eq(lecturerFeeSets.userId, userId)));
    const affected = r?.[0]?.affectedRows ?? r?.affectedRows ?? 1;
    if (!affected) throw new Error("저장본을 찾을 수 없습니다.");
    return input.id;
  }
  const mine = await db.select({ id: lecturerFeeSets.id }).from(lecturerFeeSets).where(eq(lecturerFeeSets.userId, userId));
  if (mine.length >= MAX_FEE_SETS) throw new Error(`저장은 최대 ${MAX_FEE_SETS}개까지 가능합니다. 안 쓰는 저장본을 삭제해 주세요.`);
  const r: any = await db.insert(lecturerFeeSets).values({ userId, title: input.title, rowsJson });
  return Number(r[0]?.insertId ?? r.insertId ?? 0);
}

export async function deleteFeeSet(userId: number, id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(lecturerFeeSets).where(and(eq(lecturerFeeSets.id, id), eq(lecturerFeeSets.userId, userId)));
}
