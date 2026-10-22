import { describe, it, expect } from "vitest";
import { BASE_PAY_ROWS, PAY_GRADES, basePay } from "../shared/payrollTable";
import { calcPay, defaultHourly } from "../shared/payroll";

describe("기본급표", () => {
  it("모양: 31개 호봉 × 9개 직위", () => {
    expect(BASE_PAY_ROWS).toHaveLength(31);
    BASE_PAY_ROWS.forEach((r) => expect(r).toHaveLength(PAY_GRADES.length));
  });
  it("같은 직위는 호봉이 오를수록 금액이 오른다(입력 오타 점검)", () => {
    for (let c = 0; c < PAY_GRADES.length; c++) {
      let prev = 0;
      for (let s = 0; s < 31; s++) {
        const v = BASE_PAY_ROWS[s][c];
        if (!v) continue;
        expect(v, `${PAY_GRADES[c]} ${s + 1}호봉`).toBeGreaterThan(prev);
        prev = v;
      }
    }
  });
  it("같은 호봉에서 높은 직위일수록 금액이 크다(인접 열, 오타 점검)", () => {
    for (let s = 0; s < 31; s++) {
      const r = BASE_PAY_ROWS[s];
      for (let c = 1; c < r.length - 1; c++) {
        if (!r[c] || !r[c + 1]) continue;
        if (c === 6 || c === 7) continue; // 5급·관리직·기능직 사이는 직군이 달라 제외
        expect(r[c], `${s + 1}호봉 ${PAY_GRADES[c]}`).toBeGreaterThan(r[c + 1]);
      }
    }
  });
  it("실제 명세서 기준값: 3급 13호봉 = 3,401,300", () => {
    expect(basePay(4, 13)).toBe(3_401_300);
    expect(basePay(6, 31)).toBe(3_898_000);
    expect(basePay(0, 31)).toBe(0);
  });
});

describe("급여 계산 — 실제 명세서와 대조", () => {
  const r = calcPay({
    baseSalary: 3_401_300, overtimeHours: 0, hourlyWage: 0, leaveDays: 0, holidayBonus: true,
    familyAllowance: 90_000, seniorityAllowance: 50_000, mealAllowance: 160_000, positionAllowance: 0,
    otherPay: 559_600, // 시간외수당(명세서 금액)
    pensionBase: 3_898_000, healthBase: 3_952_500, incomeTax: 238_130, otherDeduct: 0,
  });
  it("지급", () => {
    expect(r.pays.holiday).toBe(2_040_780);
    expect(r.gross).toBe(6_301_680);
  });
  it("공제", () => {
    expect(r.deductions.pension).toBe(185_150);
    expect(r.deductions.health).toBe(142_090);
    expect(r.deductions.ltc).toBe(18_670);
    expect(r.deductions.employment).toBe(35_570);
    expect(r.deductions.localTax).toBe(23_810);
    expect(r.totalDeduct).toBe(643_420);
  });
  it("실수령액", () => expect(r.net).toBe(5_658_260));
  it("시간외·연차 계산식", () => {
    const h = defaultHourly(3_401_300);
    const x = calcPay({ ...{ baseSalary: 3_401_300, overtimeHours: 10, hourlyWage: h, leaveDays: 2 } as any, holidayBonus: false, familyAllowance: 0, seniorityAllowance: 0, mealAllowance: 0, positionAllowance: 0, otherPay: 0, pensionBase: 0, healthBase: 0, incomeTax: 0, otherDeduct: 0 });
    expect(x.pays.overtime).toBe(Math.floor(10 * h * 1.5));
    expect(x.pays.leave).toBe(8 * h * 2);
  });
});
