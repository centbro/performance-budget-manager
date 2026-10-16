import { and, eq, gt, lt } from "drizzle-orm";
import { telegramLinkCodes, telegramLinks } from "../drizzle/schema";
import { getDb } from "./db";
import { LINK_CODE_MINUTES, makeLinkCode } from "./telegram";

async function db() {
  const d = await getDb();
  if (!d) throw new Error("DB not available");
  return d;
}

export async function getLinkByChat(chatId: string) {
  const d = await db();
  return (await d.select().from(telegramLinks).where(eq(telegramLinks.chatId, chatId)).limit(1))[0];
}

export async function getLinkByUser(userId: number) {
  const d = await db();
  return (await d.select().from(telegramLinks).where(eq(telegramLinks.userId, userId)).limit(1))[0];
}

/** 연결 코드 발급: 이전 코드는 모두 폐기하고 새 코드 1개만 유효 */
export async function createLinkCode(userId: number): Promise<{ code: string; minutes: number }> {
  const d = await db();
  await d.delete(telegramLinkCodes).where(eq(telegramLinkCodes.userId, userId));
  await d.delete(telegramLinkCodes).where(lt(telegramLinkCodes.expiresAt, new Date()));
  for (let i = 0; i < 5; i++) {
    const code = makeLinkCode();
    try {
      await d.insert(telegramLinkCodes).values({ userId, code, expiresAt: new Date(Date.now() + LINK_CODE_MINUTES * 60_000) });
      return { code, minutes: LINK_CODE_MINUTES };
    } catch {
      /* 코드 중복 — 다시 뽑는다 */
    }
  }
  throw new Error("연결 코드를 만들지 못했습니다.");
}

/** 코드를 소비하고 연결을 만든다. 성공 시 userId, 실패 시 null */
export async function consumeLinkCode(code: string, chatId: string, username: string | null): Promise<number | null> {
  const d = await db();
  const row = (await d.select().from(telegramLinkCodes).where(and(eq(telegramLinkCodes.code, code), gt(telegramLinkCodes.expiresAt, new Date()))).limit(1))[0];
  if (!row) return null;
  await d.delete(telegramLinkCodes).where(eq(telegramLinkCodes.id, row.id));
  // 한 사용자 = 한 대화, 한 대화 = 한 사용자
  await d.delete(telegramLinks).where(eq(telegramLinks.userId, row.userId));
  await d.delete(telegramLinks).where(eq(telegramLinks.chatId, chatId));
  await d.insert(telegramLinks).values({ userId: row.userId, chatId, username });
  return row.userId;
}

export async function unlinkUser(userId: number) {
  const d = await db();
  await d.delete(telegramLinks).where(eq(telegramLinks.userId, userId));
  await d.delete(telegramLinkCodes).where(eq(telegramLinkCodes.userId, userId));
}
