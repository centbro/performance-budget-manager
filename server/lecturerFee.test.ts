import { describe, it, expect } from "vitest";
import { calcFee, grossForNet, sumRows, parseRows } from "../shared/lecturerFee";

describe("강사비 계산", () => {
  it("사업소득 3.3%", () => {
    const r = calcFee("business", 300_000);
    expect(r).toEqual({ gross: 300000, incomeTax: 9000, localTax: 900, tax: 9900, net: 290100 });
  });
  it("10원 미만 절사", () => {
    const r = calcFee("business", 123_456);
    expect(r.incomeTax).toBe(3700); // 3703.68
    expect(r.localTax).toBe(370); // 370.368
  });
  it("기타소득 12만5천원 이하는 세금 없음", () => {
    expect(calcFee("other", 125_000).tax).toBe(0);
    expect(calcFee("other", 100_000).net).toBe(100_000);
  });
  it("기타소득 초과분은 8.8%", () => {
    const r = calcFee("other", 200_000);
    expect(r).toEqual({ gross: 200000, incomeTax: 16000, localTax: 1600, tax: 17600, net: 182400 });
    expect(calcFee("other", 125_001).tax).toBeGreaterThan(0);
  });
  it("이상한 입력은 0", () => {
    expect(calcFee("business", NaN).gross).toBe(0);
    expect(calcFee("business", -5).net).toBe(0);
  });
  it("실수령 역산", () => {
    for (const kind of ["business", "other"] as const) {
      for (const net of [100_000, 125_000, 150_000, 290_100, 500_000]) {
        const g = grossForNet(kind, net);
        expect(calcFee(kind, g).net).toBeGreaterThanOrEqual(net);
        expect(calcFee(kind, g - 1).net).toBeLessThan(net + (kind === "other" && g - 1 <= 125000 ? 1 : 0));
      }
    }
  });
  it("합계", () => {
    const t = sumRows([
      { name: "A", kind: "business", gross: 300000 },
      { name: "B", kind: "other", gross: 200000 },
      { name: "C", kind: "other", gross: 100000 },
      { name: "빈칸", kind: "business", gross: 0 },
    ]);
    expect(t).toEqual({ count: 3, gross: 600000, incomeTax: 25000, localTax: 2500, tax: 27500, net: 572500 });
  });
  it("저장된 JSON 복원", () => {
    expect(parseRows("깨짐")).toEqual([]);
    expect(parseRows(JSON.stringify([{ name: "홍", kind: "x", gross: "1000.9" }]))[0]).toMatchObject({ kind: "business", gross: 1000 });
  });
});
