import { and, eq, inArray } from "drizzle-orm";
import { participants, userVaults } from "../drizzle/schema";
import { getDb } from "./db";
import { maskBirth, maskName, maskPhone } from "../shared/maskPii";

export type VaultRow = { salt: string; iterations: number; verifier: string };

export async function getVault(userId: number): Promise<VaultRow | null> {
  const db = await getDb();
  if (!db) return null;
  const r = await db.select().from(userVaults).where(eq(userVaults.userId, userId)).limit(1);
  return r[0] ? { salt: r[0].salt, iterations: r[0].iterations, verifier: r[0].verifier } : null;
}

export async function createVaultRow(userId: number, v: VaultRow): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (await getVault(userId)) return false;
  await db.insert(userVaults).values({ userId, ...v });
  return true;
}

/** 비밀번호를 잊었을 때: 잠금을 지우고 암호문을 모두 버린다. 이름·전화는 가려진 값만 남는다. */
export async function resetVault(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const mine = await db.select({ id: participants.id }).from(participants).where(and(eq(participants.userId, userId)));
  await db.update(participants).set({ encPayload: null }).where(eq(participants.userId, userId));
  await db.delete(userVaults).where(eq(userVaults.userId, userId));
  return mine.length;
}

export type LockItem = { id: number; encPayload: string; name: string; phone?: string | null; birthDate?: string | null };

/** 기존(가려지지 않은) 데이터를 암호문으로 바꾸고 원문을 가린 값으로 덮어쓴다. 내 데이터만. */
export async function lockExisting(userId: number, items: LockItem[]): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (!(await getVault(userId))) throw new Error("먼저 잠금 비밀번호를 설정해 주세요.");
  const ids = items.map((i) => i.id);
  if (!ids.length) return 0;
  const owned = new Set(
    (await db.select({ id: participants.id }).from(participants).where(and(eq(participants.userId, userId), inArray(participants.id, ids)))).map((r) => r.id)
  );
  let n = 0;
  for (const it of items) {
    if (!owned.has(it.id)) continue;
    await db
      .update(participants)
      .set({
        encPayload: it.encPayload,
        name: maskName(it.name) || "*",
        phone: it.phone ? maskPhone(it.phone) : null,
        birthDate: it.birthDate ? maskBirth(it.birthDate) : null,
      })
      .where(and(eq(participants.id, it.id), eq(participants.userId, userId)));
    n++;
  }
  return n;
}

/** 잠금이 켜진 사용자는 원문(가려지지 않은 값)을 서버에 보낼 수 없다. */
export function assertMaskedInput(d: { name?: string | null; phone?: string | null; birthDate?: string | null; encPayload?: string | null }, partial = false) {
  const fail = (m: string): never => { throw new Error(m); };
  if (!d.encPayload && !partial) fail("잠금을 해제한 뒤 다시 시도해 주세요.");
  if (d.name && Array.from(d.name).length >= 2 && !d.name.includes("*")) fail("개인정보는 암호화되어야 합니다.");
  if (d.phone && !d.phone.includes("*")) fail("개인정보는 암호화되어야 합니다.");
  if (d.birthDate && !/\*/.test(d.birthDate)) fail("개인정보는 암호화되어야 합니다.");
}
