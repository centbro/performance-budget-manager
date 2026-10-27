import { and, asc, desc, eq } from "drizzle-orm";
import { acctBudgets, acctItems, acctExpenses } from "../drizzle/schema";
import { getDb } from "./db";
import { monthlySpent, normalizeItem, summarize, type AcctItem, type AcctExpense } from "../shared/acct";

export class AcctError extends Error {}
const need = async () => {
  const db = await getDb();
  if (!db) throw new AcctError("저장소에 연결하지 못했습니다.");
  return db;
};
const toItem = (r: typeof acctItems.$inferSelect): AcctItem => ({ id: r.id, name: r.name, amount: Number(r.amount), q: [Number(r.q1), Number(r.q2), Number(r.q3), Number(r.q4)] });
const toExp = (r: typeof acctExpenses.$inferSelect): AcctExpense => ({ id: r.id, itemId: r.itemId, expenseDate: r.expenseDate, amount: Number(r.amount), description: r.description });

export async function listBudgets(userId: number, year: number) {
  const db = await getDb();
  if (!db) return [];
  const bs = await db.select().from(acctBudgets).where(and(eq(acctBudgets.userId, userId), eq(acctBudgets.year, year))).orderBy(asc(acctBudgets.id));
  const out = [];
  for (const b of bs) {
    const s = summarize(b.splitQuarter, (await db.select().from(acctItems).where(eq(acctItems.budgetId, b.id))).map(toItem), (await db.select().from(acctExpenses).where(eq(acctExpenses.budgetId, b.id))).map(toExp));
    out.push({ id: b.id, name: b.name, splitQuarter: b.splitQuarter, total: s.total, spent: s.spent, remaining: s.remaining, rate: s.rate });
  }
  return out;
}

async function ownBudget(userId: number, id: number) {
  const db = await need();
  const [b] = await db.select().from(acctBudgets).where(and(eq(acctBudgets.id, id), eq(acctBudgets.userId, userId))).limit(1);
  if (!b) throw new AcctError("예산을 찾을 수 없습니다.");
  return b;
}

export async function getBudgetDetail(userId: number, id: number) {
  const b = await ownBudget(userId, id);
  const db = await need();
  const items = (await db.select().from(acctItems).where(eq(acctItems.budgetId, id)).orderBy(asc(acctItems.id))).map(toItem);
  const expenses = (await db.select().from(acctExpenses).where(eq(acctExpenses.budgetId, id)).orderBy(desc(acctExpenses.expenseDate), desc(acctExpenses.id))).map(toExp);
  return { id: b.id, year: b.year, name: b.name, splitQuarter: b.splitQuarter, expenses, summary: summarize(b.splitQuarter, items, expenses) };
}

export async function createBudget(userId: number, year: number, name: string, splitQuarter: boolean): Promise<number> {
  const db = await need();
  const [r]: any = await db.insert(acctBudgets).values({ userId, year, name: name.trim().slice(0, 120), splitQuarter });
  return Number(r.insertId);
}

export async function updateBudget(userId: number, id: number, patch: { name?: string; splitQuarter?: boolean }) {
  const b = await ownBudget(userId, id);
  const db = await need();
  const set: Partial<typeof acctBudgets.$inferInsert> = {};
  if (patch.name !== undefined) set.name = patch.name.trim().slice(0, 120);
  if (patch.splitQuarter !== undefined) set.splitQuarter = patch.splitQuarter;
  if (Object.keys(set).length) await db.update(acctBudgets).set(set).where(eq(acctBudgets.id, id));
  // 분기 나눔을 바꾸면 세부항목 금액을 새 설정에 맞게 다시 정리(총액은 유지)
  if (patch.splitQuarter !== undefined && patch.splitQuarter !== b.splitQuarter) {
    for (const it of (await db.select().from(acctItems).where(eq(acctItems.budgetId, id))).map(toItem)) {
      const n = normalizeItem(patch.splitQuarter, it.amount);
      await db.update(acctItems).set({ amount: String(n.amount), q1: String(n.q[0]), q2: String(n.q[1]), q3: String(n.q[2]), q4: String(n.q[3]) }).where(eq(acctItems.id, it.id));
    }
  }
}

export async function deleteBudget(userId: number, id: number) {
  await ownBudget(userId, id);
  const db = await need();
  await db.delete(acctExpenses).where(eq(acctExpenses.budgetId, id));
  await db.delete(acctItems).where(eq(acctItems.budgetId, id));
  await db.delete(acctBudgets).where(eq(acctBudgets.id, id));
}

export async function saveItem(userId: number, budgetId: number, input: { id?: number; name: string; amount: number; q?: number[] }) {
  const b = await ownBudget(userId, budgetId);
  const db = await need();
  const n = normalizeItem(b.splitQuarter, input.amount, input.q);
  const vals = { name: input.name.trim().slice(0, 120), amount: String(n.amount), q1: String(n.q[0]), q2: String(n.q[1]), q3: String(n.q[2]), q4: String(n.q[3]) };
  if (input.id) {
    await db.update(acctItems).set(vals).where(and(eq(acctItems.id, input.id), eq(acctItems.budgetId, budgetId)));
  } else {
    await db.insert(acctItems).values({ ...vals, budgetId, userId });
  }
}

export async function deleteItem(userId: number, budgetId: number, id: number) {
  await ownBudget(userId, budgetId);
  const db = await need();
  await db.delete(acctExpenses).where(and(eq(acctExpenses.itemId, id), eq(acctExpenses.budgetId, budgetId)));
  await db.delete(acctItems).where(and(eq(acctItems.id, id), eq(acctItems.budgetId, budgetId)));
}

export async function saveExpense(userId: number, budgetId: number, input: { id?: number; itemId: number; expenseDate: string; amount: number; description: string }) {
  await ownBudget(userId, budgetId);
  const db = await need();
  const [it] = await db.select().from(acctItems).where(and(eq(acctItems.id, input.itemId), eq(acctItems.budgetId, budgetId))).limit(1);
  if (!it) throw new AcctError("세부항목을 찾을 수 없습니다.");
  const vals = { itemId: input.itemId, expenseDate: input.expenseDate, amount: String(Math.round(input.amount)), description: input.description.trim().slice(0, 300) };
  if (input.id) await db.update(acctExpenses).set(vals).where(and(eq(acctExpenses.id, input.id), eq(acctExpenses.budgetId, budgetId)));
  else await db.insert(acctExpenses).values({ ...vals, budgetId, userId });
}

export async function deleteExpense(userId: number, budgetId: number, id: number) {
  await ownBudget(userId, budgetId);
  const db = await need();
  await db.delete(acctExpenses).where(and(eq(acctExpenses.id, id), eq(acctExpenses.budgetId, budgetId)));
}

type DashExpense = AcctExpense & { budgetName: string; itemName: string };
type DashBudget = { id: number; name: string; splitQuarter: boolean; total: number; spent: number; remaining: number; rate: number; q: { budget: number; spent: number }[]; items: { id: number; name: string; amount: number; spent: number; remaining: number; rate: number }[] };

/** 회계 대시보드: 올해 전체 예산·집행·잔액, 예산별 현황, 월별 집행, 최근 지출 */
export async function getDashboard(userId: number, year: number) {
  const db = await getDb();
  if (!db) return { total: 0, spent: 0, remaining: 0, rate: 0, budgets: [] as DashBudget[], monthly: new Array(12).fill(0) as number[], recent: [] as DashExpense[] };
  const bs = await db.select().from(acctBudgets).where(and(eq(acctBudgets.userId, userId), eq(acctBudgets.year, year))).orderBy(asc(acctBudgets.id));
  const budgets: DashBudget[] = [];
  const allExp: DashExpense[] = [];
  for (const b of bs) {
    const items = (await db.select().from(acctItems).where(eq(acctItems.budgetId, b.id))).map(toItem);
    const exps = (await db.select().from(acctExpenses).where(eq(acctExpenses.budgetId, b.id))).map(toExp);
    const s = summarize(b.splitQuarter, items, exps);
    const names = new Map(items.map((i) => [i.id, i.name]));
    for (const e of exps) allExp.push({ ...e, budgetName: b.name, itemName: names.get(e.itemId) ?? "-" });
    budgets.push({
      id: b.id, name: b.name, splitQuarter: b.splitQuarter,
      total: s.total, spent: s.spent, remaining: s.remaining, rate: s.rate, q: s.q,
      items: s.items.map((i) => ({ id: i.id, name: i.name, amount: i.amount, spent: i.spent, remaining: i.remaining, rate: i.rate })),
    });
  }
  const total = budgets.reduce((a, b) => a + b.total, 0);
  const spent = budgets.reduce((a, b) => a + b.spent, 0);
  const recent = allExp.sort((a, b) => b.expenseDate.localeCompare(a.expenseDate) || b.id - a.id).slice(0, 8);
  return { total, spent, remaining: total - spent, rate: total > 0 ? Math.round((spent / total) * 100) : 0, budgets, monthly: monthlySpent(allExp), recent };
}
