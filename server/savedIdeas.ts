import { and, desc, eq } from "drizzle-orm";
import { savedIdeas } from "../drizzle/schema";
import { getDb } from "./db";
import type { ProgramIdea } from "../shared/workTools";

export const MAX_SAVED_IDEAS = 100;
export type SavedCtx = { targetGroup: string; region: string; budget: number; goal: string; extra?: string };
export type SavedIdea = { id: number; idea: ProgramIdea; ctx: SavedCtx; createdAt: Date };

const safeParse = <T,>(s: string, fallback: T): T => { try { return JSON.parse(s) as T; } catch { return fallback; } };

export async function listSavedIdeas(userId: number): Promise<SavedIdea[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(savedIdeas).where(eq(savedIdeas.userId, userId)).orderBy(desc(savedIdeas.id)).limit(MAX_SAVED_IDEAS);
  return rows.map((r) => ({
    id: r.id,
    idea: safeParse<ProgramIdea>(r.ideaJson, { name: r.name, summary: "", activities: [], outcome: "", indicator: "", budgetEstimate: "" }),
    ctx: safeParse<SavedCtx>(r.ctxJson, { targetGroup: "", region: "", budget: 0, goal: "" }),
    createdAt: r.createdAt,
  }));
}

/** 같은 이름·같은 목표로 이미 저장했으면 새로 만들지 않고 기존 건을 갱신한다. */
export async function saveIdea(userId: number, idea: ProgramIdea, ctx: SavedCtx): Promise<{ id: number; duplicated: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db.select().from(savedIdeas).where(eq(savedIdeas.userId, userId)).orderBy(desc(savedIdeas.id)).limit(MAX_SAVED_IDEAS);
  const dup = existing.find((r) => r.name === idea.name && safeParse<SavedCtx>(r.ctxJson, {} as SavedCtx).goal === ctx.goal);
  if (dup) {
    await db.update(savedIdeas).set({ ideaJson: JSON.stringify(idea), ctxJson: JSON.stringify(ctx) }).where(and(eq(savedIdeas.id, dup.id), eq(savedIdeas.userId, userId)));
    return { id: dup.id, duplicated: true };
  }
  if (existing.length >= MAX_SAVED_IDEAS) throw new Error(`저장은 최대 ${MAX_SAVED_IDEAS}개까지 가능합니다. 안 쓰는 아이디어를 삭제해 주세요.`);
  const r: any = await db.insert(savedIdeas).values({ userId, name: idea.name.slice(0, 200), ideaJson: JSON.stringify(idea), ctxJson: JSON.stringify(ctx) });
  return { id: Number(r[0]?.insertId ?? r.insertId ?? 0), duplicated: false };
}

export async function deleteSavedIdea(userId: number, id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(savedIdeas).where(and(eq(savedIdeas.id, id), eq(savedIdeas.userId, userId)));
}

