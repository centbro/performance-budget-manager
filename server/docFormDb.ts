import { and, desc, eq } from "drizzle-orm";
import { docForms } from "../drizzle/schema";
import { getDb } from "./db";
import { detectKind } from "./templateFile";

export const MAX_DOC_FORMS = 20;
export const MAX_DOC_FORM_BYTES = 3 * 1024 * 1024;

export class DocFormError extends Error {}

/** 저장할 양식 이름 정리(경로 문자·제어 문자 제거) */
export const cleanFormName = (raw: string) => raw.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);

/** 올린 파일이 고칠 수 있는 hwpx·docx인지 확인하고 확장자를 돌려준다 */
export async function checkFormFile(buf: Buffer): Promise<"hwpx" | "docx"> {
  if (buf.length > MAX_DOC_FORM_BYTES) throw new DocFormError("파일이 너무 큽니다(3MB 이하만 저장할 수 있습니다).");
  const kind = await detectKind(buf);
  if (kind === "legacy") throw new DocFormError("옛 .hwp 형식 파일은 저장할 수 없습니다. 한글에서 '한글 문서(*.hwpx)'로 저장한 파일을 올려 주세요.");
  if (kind !== "hwpx" && kind !== "docx") throw new DocFormError("hwpx 또는 docx 파일만 저장할 수 있습니다.");
  return kind;
}

export async function listForms(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: docForms.id, name: docForms.name, ext: docForms.ext, size: docForms.size, createdAt: docForms.createdAt })
    .from(docForms).where(eq(docForms.userId, userId)).orderBy(desc(docForms.id)).limit(MAX_DOC_FORMS);
}

export async function getFormFile(userId: number, id: number): Promise<{ name: string; ext: string; data: Buffer } | null> {
  const db = await getDb();
  if (!db) return null;
  const [r] = await db.select().from(docForms).where(and(eq(docForms.id, id), eq(docForms.userId, userId))).limit(1);
  return r ? { name: r.name, ext: r.ext, data: Buffer.from(r.dataB64, "base64") } : null;
}

export async function saveForm(userId: number, name: string, buf: Buffer): Promise<number> {
  const db = await getDb();
  if (!db) throw new DocFormError("저장소에 연결하지 못했습니다.");
  const ext = await checkFormFile(buf);
  const clean = cleanFormName(name);
  if (!clean) throw new DocFormError("양식 이름을 입력해 주세요.");
  const mine = await db.select({ id: docForms.id }).from(docForms).where(eq(docForms.userId, userId));
  if (mine.length >= MAX_DOC_FORMS) throw new DocFormError(`자주 쓰는 문서는 최대 ${MAX_DOC_FORMS}개까지 저장할 수 있습니다. 안 쓰는 것을 삭제해 주세요.`);
  const r: any = await db.insert(docForms).values({ userId, name: clean, ext, size: buf.length, dataB64: buf.toString("base64") });
  return Number(r[0]?.insertId ?? r.insertId ?? 0);
}

export async function deleteForm(userId: number, id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(docForms).where(and(eq(docForms.id, id), eq(docForms.userId, userId)));
}
