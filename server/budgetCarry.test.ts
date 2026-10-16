import { describe, it, expect } from "vitest";
import { computeCarryOver } from "../shared/budgetCarry";

describe("computeCarryOver", () => {
  it("앞 분기 잔여가 다음 분기로 채워진다", () => {
    const r = computeCarryOver([100, 100, 100, 100], [40, 100, 0, 0]);
    expect(r[0].remain).toBe(60);
    expect(r[1].carryIn).toBe(60);
    expect(r[1].available).toBe(160);
    expect(r[1].remain).toBe(60);
    expect(r[3].remain).toBe(260);
  });
  it("초과 지출은 다음 분기에서 차감된다", () => {
    const r = computeCarryOver([100, 100], [130, 50]);
    expect(r[1].carryIn).toBe(-30);
    expect(r[1].available).toBe(70);
    expect(r[1].rate).toBe(71);
  });
});
