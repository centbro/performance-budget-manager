import { describe, it, expect } from "vitest";
import { monthlySpent, evenQuarters, normalizeItem, quarterOf, summarize } from "../shared/acct";

describe("회계 예산 계산", () => {
  it("분기 나누기: 나머지는 1분기", () => {
    expect(evenQuarters(1000003)).toEqual([250003, 250000, 250000, 250000]);
  });
  it("분기 안 나누면 분기값 0, 나누면 금액=분기 합", () => {
    expect(normalizeItem(false, 1000, [1, 2, 3, 4])).toEqual({ amount: 1000, q: [0, 0, 0, 0] });
    expect(normalizeItem(true, 0, [100, 200, 300, 400])).toEqual({ amount: 1000, q: [100, 200, 300, 400] });
    expect(normalizeItem(true, 1000).q).toEqual([250, 250, 250, 250]);
  });
  it("분기 판정", () => {
    expect(quarterOf("2026-03-31")).toBe(0);
    expect(quarterOf("2026-04-01")).toBe(1);
    expect(quarterOf("2026-12-01")).toBe(3);
  });
  it("항목·분기별 집행 집계", () => {
    const items = [
      { id: 1, name: "인건비", amount: 1000, q: [250, 250, 250, 250] as [number, number, number, number] },
      { id: 2, name: "운영비", amount: 400, q: [100, 100, 100, 100] as [number, number, number, number] },
    ];
    const ex = [
      { id: 1, itemId: 1, expenseDate: "2026-02-10", amount: 300, description: "" },
      { id: 2, itemId: 1, expenseDate: "2026-05-10", amount: 100, description: "" },
      { id: 3, itemId: 2, expenseDate: "2026-05-11", amount: 50, description: "" },
      { id: 4, itemId: 99, expenseDate: "2026-05-11", amount: 999, description: "" },
    ];
    const s = summarize(true, items, ex);
    expect(s.total).toBe(1400);
    expect(s.spent).toBe(450);
    expect(s.remaining).toBe(950);
    expect(s.items[0]).toMatchObject({ spent: 400, remaining: 600, rate: 40 });
    expect(s.q[0]).toEqual({ budget: 350, spent: 300 });
    expect(s.q[1]).toEqual({ budget: 350, spent: 150 });
    expect(summarize(false, items, ex).q[0].budget).toBe(0);
  });
  it("월별 집행", () => {
    const m = monthlySpent([{ expenseDate: "2026-01-05", amount: 10 }, { expenseDate: "2026-01-20", amount: 5 }, { expenseDate: "2026-12-01", amount: 7 }]);
    expect(m[0]).toBe(15);
    expect(m[11]).toBe(7);
    expect(m.reduce((a, b) => a + b, 0)).toBe(22);
  });
});
