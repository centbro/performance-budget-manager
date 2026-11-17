import { describe, expect, it } from "vitest";
import { DEFAULT_WORK_DAYS, onOrAfterWorkday, parseWorkDays, serializeWorkDays } from "../shared/workDays";

describe("근무 요일", () => {
  it("비어 있거나 잘못된 값이면 월~금", () => {
    expect(parseWorkDays(null)).toEqual(DEFAULT_WORK_DAYS);
    expect(parseWorkDays("")).toEqual(DEFAULT_WORK_DAYS);
    expect(parseWorkDays("x,9,-1")).toEqual(DEFAULT_WORK_DAYS);
  });
  it("중복 제거·정렬", () => {
    expect(parseWorkDays("3,1,1,5")).toEqual([1, 3, 5]);
    expect(serializeWorkDays([6, 0, 6])).toBe("0,6");
  });
  it("쉬는 요일이면 다음 근무일", () => {
    // 2026-11-14 토 → 월~금 근무면 11-16 월
    expect(onOrAfterWorkday(new Date(2026, 10, 14), [1, 2, 3, 4, 5]).getDate()).toBe(16);
    // 근무일이면 그대로
    expect(onOrAfterWorkday(new Date(2026, 10, 17), [1, 2, 3, 4, 5]).getDate()).toBe(17);
    // 토·일만 근무
    expect(onOrAfterWorkday(new Date(2026, 10, 17), [0, 6]).getDate()).toBe(21);
  });
});
