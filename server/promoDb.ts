import { and, desc, eq } from "drizzle-orm";
import { promoSamples } from "../drizzle/schema";
import { getDb } from "./db";

export const MAX_PROMO_SAMPLES = 30;

export async function listPromoSamples(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(promoSamples).where(eq(promoSamples.userId, userId)).orderBy(desc(promoSamples.createdAt));
}

export async function createPromoSample(p: { userId: number; name: string; channel: string; body: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await listPromoSamples(p.userId);
  if (existing.length >= MAX_PROMO_SAMPLES) throw new Error(`샘플은 최대 ${MAX_PROMO_SAMPLES}개까지 보관할 수 있습니다.`);
  const r = await db.insert(promoSamples).values(p);
  return (r[0] as { insertId: number }).insertId;
}

export async function deletePromoSample(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(promoSamples).where(and(eq(promoSamples.id, id), eq(promoSamples.userId, userId)));
}

/** 본인 소유 샘플만 골라 온다. */
export async function getPromoSamples(userId: number, ids: number[]) {
  if (!ids.length) return [];
  const all = await listPromoSamples(userId);
  return all.filter((s) => ids.includes(s.id));
}
