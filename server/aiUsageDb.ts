import { and, eq, gte, sql } from "drizzle-orm";
import { aiUsage } from "../drizzle/schema";
import { getDb } from "./db";

export async function logAiUsage(e: { userId: number; feature: string; model: string; promptTokens: number; completionTokens: number }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(aiUsage).values(e);
}

/** 이번 달 기능별 호출 수 */
export async function getMonthlyCounts(userId: number, since: Date): Promise<Record<string, number>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db
    .select({ feature: aiUsage.feature, n: sql<number>`count(*)` })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), gte(aiUsage.createdAt, since)))
    .groupBy(aiUsage.feature);
  return Object.fromEntries(rows.map((r) => [r.feature, Number(r.n)]));
}

/** 관리자: 이번 달 기능별·사용자별 호출·토큰 합계 */
export async function getUsageSummary(since: Date) {
  const db = await getDb();
  if (!db) return { byFeature: [], byUser: [] };
  const byFeature = await db
    .select({ feature: aiUsage.feature, calls: sql<number>`count(*)`, inTok: sql<number>`sum(${aiUsage.promptTokens})`, outTok: sql<number>`sum(${aiUsage.completionTokens})` })
    .from(aiUsage).where(gte(aiUsage.createdAt, since)).groupBy(aiUsage.feature);
  const byUser = await db
    .select({ userId: aiUsage.userId, calls: sql<number>`count(*)`, inTok: sql<number>`sum(${aiUsage.promptTokens})`, outTok: sql<number>`sum(${aiUsage.completionTokens})` })
    .from(aiUsage).where(gte(aiUsage.createdAt, since)).groupBy(aiUsage.userId).orderBy(sql`count(*) desc`).limit(50);
  const num = (v: unknown) => Number(v ?? 0);
  return {
    byFeature: byFeature.map((r) => ({ feature: r.feature, calls: num(r.calls), inTok: num(r.inTok), outTok: num(r.outTok) })),
    byUser: byUser.map((r) => ({ userId: r.userId, calls: num(r.calls), inTok: num(r.inTok), outTok: num(r.outTok) })),
  };
}
