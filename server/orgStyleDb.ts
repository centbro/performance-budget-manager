import { eq } from "drizzle-orm";
import { orgStyles } from "../drizzle/schema";
import { getDb } from "./db";
import { sanitizeStyle, type OrgStyle } from "./orgStyle";

export async function getOrgStyle(userId: number): Promise<OrgStyle | null> {
  const db = await getDb();
  if (!db) return null;
  const r = await db.select().from(orgStyles).where(eq(orgStyles.userId, userId)).limit(1);
  return r[0] ? { orgName: r[0].orgName, tone: r[0].tone, sampleText: r[0].sampleText } : null;
}

export async function saveOrgStyle(userId: number, input: Partial<OrgStyle>): Promise<OrgStyle> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const s = sanitizeStyle(input);
  await db.insert(orgStyles).values({ userId, ...s }).onDuplicateKeyUpdate({ set: s });
  return s;
}
