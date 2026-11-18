import { describe, expect, it } from "vitest";
import { basisText, lineAmount, summarizeLines } from "../shared/budgetLines";

describe("budgetLines", () => {
  it("단가×수량이 있으면 곱, 없으면 직접 금액", () => {
    expect(lineAmount({ unitPrice: 7980, qty: 200, amount: 0 })).toBe(1_596_000);
    expect(lineAmount({ unitPrice: 0, qty: 0, amount: 254_000 })).toBe(254_000);
    expect(lineAmount({ unitPrice: 5000, qty: 0, amount: 300 })).toBe(300);
    expect(lineAmount({ unitPrice: 0, qty: 0, amount: -5 })).toBe(0);
  });
  it("산출내역 문구", () => {
    expect(basisText({ unitPrice: 20000, qty: 18, unit: "ea", memo: "" })).toBe("20,000원×18ea");
    expect(basisText({ unitPrice: 0, qty: 0, unit: "", memo: "초대장 및 현수막" })).toBe("초대장 및 현수막");
    expect(basisText({ unitPrice: 39000, qty: 7, unit: "ea", memo: "감사패" })).toBe("39,000원×7ea · 감사패");
  });
  it("구분별 합계와 집행액", () => {
    const s = summarizeLines(
      [{ id: 1, category: "project", amount: 1000 }, { id: 2, category: "project", amount: 500 }, { id: 3, category: "operation", amount: 200 }],
      [{ category: "project", amount: 300, lineId: 1 }, { category: "project", amount: 100, lineId: null }, { category: "operation", amount: 50, lineId: 3 }],
    );
    expect(s.totalBudget).toBe(1700);
    expect(s.totalSpent).toBe(450);
    expect(s.cats.find((c) => c.category === "project")).toMatchObject({ budget: 1500, spent: 400, remain: 1100 });
    expect(s.cats.find((c) => c.category === "labor")).toMatchObject({ budget: 0, spent: 0, remain: 0 });
    expect(s.lineSpent.get(1)).toBe(300);
  });
});
