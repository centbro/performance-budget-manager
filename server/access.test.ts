import { describe, expect, it } from "vitest";
import { accessInfo, endOfDayKst, extendAccess, kstDateString } from "../shared/access";

const now = new Date("2026-10-16T08:00:00+09:00");

describe("accessInfo", () => {
  it("무제한", () => {
    expect(accessInfo(null, now)).toEqual({ state: "unlimited" });
  });
  it("남은 일수(한국 날짜 기준)", () => {
    expect(accessInfo(endOfDayKst("2026-10-16"), now)).toMatchObject({ state: "active", daysLeft: 0, warn: true });
    expect(accessInfo(endOfDayKst("2026-10-23"), now)).toMatchObject({ daysLeft: 7, warn: true });
    expect(accessInfo(endOfDayKst("2026-11-15"), now)).toMatchObject({ daysLeft: 30, warn: false, until: "2026-11-15" });
  });
  it("만료", () => {
    expect(accessInfo(endOfDayKst("2026-10-14"), now)).toMatchObject({ state: "expired", daysAgo: 2 });
  });
  it("한국 자정 직전/직후 경계", () => {
    expect(accessInfo(endOfDayKst("2026-10-16"), new Date("2026-10-16T23:59:00+09:00")).state).toBe("active");
    expect(accessInfo(endOfDayKst("2026-10-16"), new Date("2026-10-17T00:00:01+09:00"))).toMatchObject({ state: "expired", daysAgo: 1 });
  });
});

describe("extendAccess", () => {
  it("만료일이 미래면 거기서, 아니면 오늘부터 연장", () => {
    expect(kstDateString(extendAccess(endOfDayKst("2026-11-01"), 30, now))).toBe("2026-12-01");
    expect(kstDateString(extendAccess(endOfDayKst("2026-09-01"), 30, now))).toBe("2026-11-15");
    expect(kstDateString(extendAccess(null, 90, now))).toBe("2027-01-14");
  });
});
