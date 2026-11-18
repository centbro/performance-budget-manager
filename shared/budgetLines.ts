// 예산 세부내역(구분 · 산출내역 · 금액) 공용 계산 — 서버·클라이언트 공통
export const BUDGET_CATEGORIES = ["project", "operation", "labor"] as const;
export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];
export const BUDGET_CATEGORY_LABEL: Record<BudgetCategory, string> = { project: "사업비", operation: "운영비", labor: "인건비" };

export type BudgetLineInput = { name: string; category: BudgetCategory; unitPrice: number; qty: number; unit: string; amount: number; memo: string };

/** 단가×수량이 있으면 그 곱, 없으면 직접 입력한 금액 */
export function lineAmount(l: { unitPrice: number; qty: number; amount: number }): number {
  if (l.unitPrice > 0 && l.qty > 0) return Math.round(l.unitPrice * l.qty);
  return Math.max(0, Math.round(l.amount || 0));
}

/** "7,980원×200ea" 형태의 산출내역 문구. 단가·수량이 없으면 메모만. */
export function basisText(l: { unitPrice: number; qty: number; unit: string; memo: string }): string {
  const parts: string[] = [];
  if (l.unitPrice > 0 && l.qty > 0) parts.push(`${l.unitPrice.toLocaleString("ko-KR")}원×${l.qty.toLocaleString("ko-KR")}${l.unit || ""}`);
  if (l.memo?.trim()) parts.push(l.memo.trim());
  return parts.join(" · ");
}

export type LineRow = { id: number; category: BudgetCategory; amount: number };
export type CategorySummary = { category: BudgetCategory; budget: number; spent: number; remain: number };

/** 구분별 예산 합계와 집행액(지출을 세부내역에 연결한 것 + 연결 안 한 것은 구분 단위로) */
export function summarizeLines(lines: LineRow[], expenses: { category: BudgetCategory; amount: number; lineId: number | null }[]) {
  const byCat = new Map<BudgetCategory, CategorySummary>(BUDGET_CATEGORIES.map((c) => [c, { category: c, budget: 0, spent: 0, remain: 0 }]));
  const lineSpent = new Map<number, number>();
  for (const l of lines) byCat.get(l.category)!.budget += l.amount;
  for (const e of expenses) {
    byCat.get(e.category)!.spent += e.amount;
    if (e.lineId != null) lineSpent.set(e.lineId, (lineSpent.get(e.lineId) ?? 0) + e.amount);
  }
  const cats = BUDGET_CATEGORIES.map((c) => { const s = byCat.get(c)!; return { ...s, remain: s.budget - s.spent }; });
  const total = cats.reduce((a, c) => ({ budget: a.budget + c.budget, spent: a.spent + c.spent }), { budget: 0, spent: 0 });
  return { cats, lineSpent, totalBudget: total.budget, totalSpent: total.spent };
}
