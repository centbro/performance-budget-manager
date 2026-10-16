import { getDb } from "./db";
import { businessPlans } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sectionId?: string;
  timestamp: number;
};

export type InputData = Record<string, string[]>; // sectionId -> answers[]

export type GeneratedSection = {
  sectionId: string;
  title: string;
  content: string;
};

export async function createBusinessPlan(params: {
  userId: number;
  projectId?: number;
  year: number;
  title: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(businessPlans).values({
    userId: params.userId,
    projectId: params.projectId ?? null,
    year: params.year,
    title: params.title,
    status: "draft",
    inputData: JSON.stringify({}),
    chatHistory: JSON.stringify([]),
    generatedContent: JSON.stringify([]),
  });
  return (result[0] as { insertId: number }).insertId;
}

export async function listBusinessPlans(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(businessPlans)
    .where(eq(businessPlans.userId, userId))
    .orderBy(desc(businessPlans.updatedAt));
}

export async function getBusinessPlanById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(businessPlans)
    .where(and(eq(businessPlans.id, id), eq(businessPlans.userId, userId)));
  return rows[0] ?? null;
}

export async function updateBusinessPlanChat(
  id: number,
  userId: number,
  chatHistory: ChatMessage[],
  inputData: InputData
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(businessPlans)
    .set({
      chatHistory: JSON.stringify(chatHistory),
      inputData: JSON.stringify(inputData),
      status: "in_progress",
    })
    .where(and(eq(businessPlans.id, id), eq(businessPlans.userId, userId)));
}

export async function saveGeneratedContent(
  id: number,
  userId: number,
  sections: GeneratedSection[]
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(businessPlans)
    .set({
      generatedContent: JSON.stringify(sections),
      status: "completed",
    })
    .where(and(eq(businessPlans.id, id), eq(businessPlans.userId, userId)));
}

export async function updateGeneratedSection(
  id: number,
  userId: number,
  sectionId: string,
  content: string
) {
  const db = await getDb();
  if (!db) return;
  // 기존 generatedContent를 불러와 해당 섹션만 업데이트
  const rows = await db
    .select()
    .from(businessPlans)
    .where(and(eq(businessPlans.id, id), eq(businessPlans.userId, userId)));
  const plan = rows[0];
  if (!plan) return;
  const sections: GeneratedSection[] = JSON.parse(plan.generatedContent as string ?? "[]");
  const updated = sections.map((s) =>
    s.sectionId === sectionId ? { ...s, content } : s
  );
  await db
    .update(businessPlans)
    .set({ generatedContent: JSON.stringify(updated) })
    .where(and(eq(businessPlans.id, id), eq(businessPlans.userId, userId)));
}

/** inputData의 특정 키만 갱신한다(상태·대화기록은 건드리지 않음). */
export async function setInputDataKey(id: number, userId: number, key: string, values: string[]) {
  const db = await getDb();
  if (!db) return;
  const rows = await db
    .select()
    .from(businessPlans)
    .where(and(eq(businessPlans.id, id), eq(businessPlans.userId, userId)));
  const plan = rows[0];
  if (!plan) return;
  const data: InputData = JSON.parse(plan.inputData ?? "{}");
  data[key] = values;
  await db
    .update(businessPlans)
    .set({ inputData: JSON.stringify(data) })
    .where(and(eq(businessPlans.id, id), eq(businessPlans.userId, userId)));
}

/** 빠른 생성: 입력·생성 결과를 한 번에 저장한다. */
export async function saveQuickPlan(
  id: number,
  userId: number,
  inputData: InputData,
  sections: GeneratedSection[]
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(businessPlans)
    .set({
      inputData: JSON.stringify(inputData),
      generatedContent: JSON.stringify(sections),
      status: "completed",
    })
    .where(and(eq(businessPlans.id, id), eq(businessPlans.userId, userId)));
}

export async function deleteBusinessPlan(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(businessPlans)
    .where(and(eq(businessPlans.id, id), eq(businessPlans.userId, userId)));
}
