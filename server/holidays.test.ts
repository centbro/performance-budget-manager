import { describe, expect, it } from "vitest";
import { HOLIDAYS, hasHolidayData, holidayName, workingSegments } from "../shared/holidays";

const MON_FRI = [1, 2, 3, 4, 5];

describe("holidays", () => {
  it("공휴일 이름", () => {
    expect(holidayName("2026-09-25")).toBe("추석");
    expect(holidayName("2026-09-28")).toBeUndefined(); // 추석 연휴가 토요일까지라 대체공휴일 없음
    expect(holidayName("2027-02-09")).toBe("대체공휴일");
    expect(holidayName("2027-07-17")).toBe("제헌절"); // 2027년부터 공휴일
    expect(holidayName("2026-07-17")).toBeUndefined();
    expect(holidayName("2026-06-06")).toBe("현충일");
  });
  it("연도 범위", () => {
    expect(hasHolidayData(2026)).toBe(true);
    expect(hasHolidayData(2028)).toBe(false);
  });
  it("표의 날짜 형식", () => {
    for (const k of Object.keys(HOLIDAYS)) expect(k).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("추석 주간 휴가는 쉬는 날을 빼고 두 구간으로 나뉜다", () => {
    const r = workingSegments("2026-09-22", "2026-09-29", MON_FRI);
    expect(r.segments).toEqual([
      { start: "2026-09-22", end: "2026-09-23", days: 2 },
      { start: "2026-09-28", end: "2026-09-29", days: 2 },
    ]);
    expect(r.total).toBe(8);
    expect(r.excluded).toBe(4); // 목·금(추석), 토·일
    expect(r.workdays).toBe(4);
  });
  it("주 6일 근무자는 토요일이 근무일이다", () => {
    const r = workingSegments("2026-11-16", "2026-11-22", [1, 2, 3, 4, 5, 6]);
    expect(r.segments).toEqual([{ start: "2026-11-16", end: "2026-11-21", days: 6 }]);
  });
  it("모두 쉬는 날이면 구간이 없다", () => {
    expect(workingSegments("2026-09-26", "2026-09-27", MON_FRI).segments).toEqual([]);
  });
  it("하루짜리 근무일", () => {
    expect(workingSegments("2026-11-19", "2026-11-19", MON_FRI).segments).toEqual([{ start: "2026-11-19", end: "2026-11-19", days: 1 }]);
  });
});
