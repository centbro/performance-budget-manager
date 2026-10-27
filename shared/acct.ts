/** 회계 전용 예산 계산(서버·화면 공용, 순수 함수) */
export type AcctItem = { id: number; name: string; amount: number; q: [number, number, number, number] };
export type AcctExpense = { id: number; itemId: number; expenseDate: string; amount: number; description: string };

export const quarterOf = (dateStr: string): 0 | 1 | 2 | 3 => {
  const m = parseInt(dateStr.slice(5, 7), 10);
  return (m <= 3 ? 0 : m <= 6 ? 1 : m <= 9 ? 2 : 3) as 0 | 1 | 2 | 3;
};

/** 총액을 4분기로 나눈다(나머지는 1분기에 얹는다) */
export function evenQuarters(total: number): [number, number, number, number] {
  const base = Math.floor(total / 4);
  return [base + (total - base * 4), base, base, base];
}

/** 세부항목 입력을 예산의 분기 설정에 맞게 정리: 분기 나눔이면 금액=분기 합, 아니면 분기값은 0 */
export function normalizeItem(split: boolean, amount: number, q?: number[]): { amount: number; q: [number, number, number, number] } {
  if (!split) return { amount: Math.max(0, Math.round(amount)), q: [0, 0, 0, 0] };
  const qq = (q && q.length === 4 ? q : evenQuarters(Math.max(0, Math.round(amount)))).map((n) => Math.max(0, Math.round(n || 0))) as [number, number, number, number];
  return { amount: qq[0] + qq[1] + qq[2] + qq[3], q: qq };
}

export type ItemSummary = AcctItem & { spent: number; remaining: number; rate: number; qSpent: [number, number, number, number] };
export type BudgetSummary = { total: number; spent: number; remaining: number; rate: number; q: { budget: number; spent: number }[]; items: ItemSummary[] };

export function summarize(split: boolean, items: AcctItem[], expenses: AcctExpense[]): BudgetSummary {
  const out: ItemSummary[] = items.map((it) => ({ ...it, spent: 0, remaining: 0, rate: 0, qSpent: [0, 0, 0, 0] }));
  const byId = new Map(out.map((i) => [i.id, i]));
  for (const e of expenses) {
    const it = byId.get(e.itemId);
    if (!it) continue;
    it.spent += e.amount;
    it.qSpent[quarterOf(e.expenseDate)] += e.amount;
  }
  for (const it of out) {
    it.remaining = it.amount - it.spent;
    it.rate = it.amount > 0 ? Math.round((it.spent / it.amount) * 100) : 0;
  }
  const total = out.reduce((a, i) => a + i.amount, 0);
  const spent = out.reduce((a, i) => a + i.spent, 0);
  const q = [0, 1, 2, 3].map((k) => ({ budget: split ? out.reduce((a, i) => a + i.q[k], 0) : 0, spent: out.reduce((a, i) => a + i.qSpent[k], 0) }));
  return { total, spent, remaining: total - spent, rate: total > 0 ? Math.round((spent / total) * 100) : 0, q, items: out };
}
