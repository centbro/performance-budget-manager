import { desc, eq } from "drizzle-orm";
import { pcAgentLogs, pcAgentTokens } from "../drizzle/schema";
import { getDb } from "./db";
import { PcAgentHub } from "./pcAgent";

export async function setTokenHash(userId: number, tokenHash: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(pcAgentTokens).where(eq(pcAgentTokens.userId, userId));
  await db.insert(pcAgentTokens).values({ userId, tokenHash });
}
export async function deleteToken(userId: number) {
  const db = await getDb();
  if (db) await db.delete(pcAgentTokens).where(eq(pcAgentTokens.userId, userId));
}
export async function hasToken(userId: number) {
  const db = await getDb();
  if (!db) return false;
  return (await db.select().from(pcAgentTokens).where(eq(pcAgentTokens.userId, userId)).limit(1)).length > 0;
}
export async function findUserByTokenHash(hash: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const r = await db.select().from(pcAgentTokens).where(eq(pcAgentTokens.tokenHash, hash)).limit(1);
  return r[0]?.userId ?? null;
}
export async function addLog(userId: number, summary: string, ok: boolean) {
  const db = await getDb();
  if (db) await db.insert(pcAgentLogs).values({ userId, summary: summary.slice(0, 300), ok: ok ? 1 : 0 }).catch(() => {});
}
export async function recentLogs(userId: number, n = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pcAgentLogs).where(eq(pcAgentLogs.userId, userId)).orderBy(desc(pcAgentLogs.id)).limit(n);
}

export const pcHub = new PcAgentHub(findUserByTokenHash);
