import { describe, expect, it } from "vitest";
import { buildCalendarRef, buildSchedulePrompt, parseScheduleItems, withTime } from "./scheduleParse";

describe("buildCalendarRef", () => {
  it("요일이 맞는 4주 달력", () => {
    const c = buildCalendarRef("2026-10-16");
    expect(c.startsWith("2026-10-16(금)")).toBe(true);
    expect(c).toContain("2026-10-20(화)");
    expect(c.split(" ")).toHaveLength(28);
  });
});

describe("buildSchedulePrompt", () => {
  it("오늘·사업 목록을 담는다", () => {
    const { system, user } = buildSchedulePrompt("내일 회의", "2026-10-16", [{ id: 7, name: "명랑운동회" }]);
    expect(system).toContain("2026-10-16(금요일)");
    expect(system).toContain("7: 명랑운동회");
    expect(user).toBe("내일 회의");
  });
});

describe("parseScheduleItems", () => {
  const raw = JSON.stringify({
    items: [
      { title: "준비회의", startDate: "2026-10-20", endDate: "2026-10-20", time: "14:00", description: "센터 회의실", projectId: 7, color: "blue" },
      { title: "결과보고서 마감", startDate: "2026-11-20", endDate: "2026-11-01", projectId: 99, color: "나쁜색" },
      { title: "날짜 없음", startDate: "", endDate: "" },
      { title: "", startDate: "2026-11-01" },
    ],
  });
  it("검증·보정한다", () => {
    const r = parseScheduleItems(raw, [7], "2026-10-16");
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ projectId: 7, time: "14:00" });
    expect(r[1]).toMatchObject({ projectId: null, color: "blue", endDate: "2026-11-20" });
  });
  it("깨진 응답은 빈 배열", () => {
    expect(parseScheduleItems("oops", [], "2026-10-16")).toEqual([]);
  });
});

describe("withTime", () => {
  it("시간을 설명 앞에", () => {
    expect(withTime("회의실", "14:00")).toBe("시간: 14:00\n회의실");
    expect(withTime("", "")).toBe("");
  });
});
