import { and, eq } from "drizzle-orm";
import { todos } from "../drizzle/schema";
import { getDb } from "./db";

async function db() {
  const d = await getDb();
  if (!d) throw new Error("DB not available");
  return d;
}

export async function listTodos(userId: number) {
  const d = await db();
  return d.select().from(todos).where(eq(todos.userId, userId)).orderBy(todos.id);
}

export async function addTodo(userId: number, data: { title: string; memo: string; dueDate: string | null }) {
  const d = await db();
  const [r] = await d.insert(todos).values({ userId, ...data });
  return Number((r as { insertId: number }).insertId);
}

export async function updateTodo(userId: number, id: number, data: { title?: string; memo?: string; dueDate?: string | null; done?: boolean }) {
  const d = await db();
  const set: Record<string, unknown> = { ...data };
  if (data.done !== undefined) set.doneAt = data.done ? new Date() : null;
  await d.update(todos).set(set).where(and(eq(todos.id, id), eq(todos.userId, userId)));
}

export async function deleteTodo(userId: number, id: number) {
  const d = await db();
  await d.delete(todos).where(and(eq(todos.id, id), eq(todos.userId, userId)));
}

export async function deleteDoneTodos(userId: number) {
  const d = await db();
  await d.delete(todos).where(and(eq(todos.userId, userId), eq(todos.done, true)));
}
