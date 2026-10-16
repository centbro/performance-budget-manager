import { and, desc, eq, gte, sql } from "drizzle-orm";
import { boardPosts } from "../drizzle/schema";
import { getDb } from "./db";

export const BOARD_CATEGORIES = ["건의", "오류 제보", "문의", "기타"] as const;
export const BOARD_STATUSES = ["접수", "확인중", "답변완료"] as const;

/** 관리자는 전체, 일반 사용자는 본인 글만 */
export async function listBoardPosts(viewer: { id: number; isAdmin: boolean }) {
  const db = await getDb();
  if (!db) return [];
  const q = db.select().from(boardPosts);
  const rows = viewer.isAdmin
    ? await q.orderBy(desc(boardPosts.createdAt)).limit(300)
    : await q.where(eq(boardPosts.userId, viewer.id)).orderBy(desc(boardPosts.createdAt)).limit(100);
  // 일반 사용자에게는 작성자 정보 외 추가 노출 없음(본인 글뿐)
  return rows;
}

export async function countRecentPosts(userId: number, hours = 24) {
  const db = await getDb();
  if (!db) return 0;
  const since = new Date(Date.now() - hours * 3600 * 1000);
  const r = await db
    .select({ n: sql<number>`count(*)` })
    .from(boardPosts)
    .where(and(eq(boardPosts.userId, userId), gte(boardPosts.createdAt, since)));
  return Number(r[0]?.n ?? 0);
}

export async function createBoardPost(p: { userId: number; authorName: string; authorEmail: string; category: string; title: string; content: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const r = await db.insert(boardPosts).values(p);
  return (r[0] as { insertId: number }).insertId;
}

export async function getBoardPost(id: number) {
  const db = await getDb();
  if (!db) return null;
  const r = await db.select().from(boardPosts).where(eq(boardPosts.id, id)).limit(1);
  return r[0] ?? null;
}

export async function replyBoardPost(id: number, adminReply: string, status: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(boardPosts).set({ adminReply: adminReply || null, status, repliedAt: adminReply ? new Date() : null }).where(eq(boardPosts.id, id));
}

export async function deleteBoardPost(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(boardPosts).where(eq(boardPosts.id, id));
}

export async function countOpenPosts() {
  const db = await getDb();
  if (!db) return 0;
  const r = await db.select({ n: sql<number>`count(*)` }).from(boardPosts).where(eq(boardPosts.status, "접수"));
  return Number(r[0]?.n ?? 0);
}
