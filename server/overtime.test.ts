import { describe, expect, it } from "vitest";
import { fmtMinutes, minutesOfRange, summarizeOvertime } from "../shared/overtime";

const ot = (date: string, desc: string | null, title = "야근", projectId = 0) => ({
  projectId, title, description: desc, startDate: new Date(`${date}T00:00:00`), endDate: new Date(`${date}T00:00:00`),
});

describe("야근 합산", () => {
  it("시간 범위를 분으로", () => {
    expect(minutesOfRange("18:00~21:30")).toBe(210);
    expect(minutesOfRange("22:00~01:00")).toBe(180); // 자정 넘김
    expect(minutesOfRange("18:00")).toBeNull();
    expect(minutesOfRange("abc~def")).toBeNull();
  });
  it("표기", () => {
    expect(fmtMinutes(210)).toBe("3시간 30분");
    expect(fmtMinutes(120)).toBe("2시간");
    expect(fmtMinutes(45)).toBe("45분");
  });
  it("해당 월의 야근만 합산하고 다른 일정은 제외", () => {
    const r = summarizeOvertime(
      [
        ot("2026-11-05", "시간: 18:00~21:00"),
        ot("2026-11-12", "시간: 18:00~20:30\n메모"),
        ot("2026-10-30", "시간: 18:00~22:00"), // 다른 달
        ot("2026-11-06", "시간: 09:00~18:00", "회의 참석"), // 야근 아님
        ot("2026-11-07", "시간: 18:00~21:00", "야근", 5), // 사업 일정
      ],
      2026, 11
    );
    expect(r.totalMinutes).toBe(180 + 150);
    expect(r.dayCount).toBe(2);
    expect(r.days.map((d) => d.day)).toEqual([5, 12]);
  });
  it("시간 없는 야근은 일수만 세고 따로 알린다", () => {
    const r = summarizeOvertime([ot("2026-11-03", null), ot("2026-11-04", "시간: 18:00~20:00")], 2026, 11);
    expect(r.dayCount).toBe(2);
    expect(r.untimedDays).toBe(1);
    expect(r.totalMinutes).toBe(120);
  });
  it("밤샘 야근(다음 날 새벽까지)은 한 번만 센다", () => {
    const r = summarizeOvertime(
      [{ projectId: 0, title: "야근", description: "시간: 22:00~01:00", startDate: new Date("2026-11-05T00:00:00"), endDate: new Date("2026-11-06T00:00:00") }],
      2026, 11
    );
    expect(r.dayCount).toBe(1);
    expect(r.totalMinutes).toBe(180);
  });
  it("여러 날에 걸친 같은 시간대 야근은 날마다 센다", () => {
    const r = summarizeOvertime(
      [{ projectId: 0, title: "야근", description: "시간: 18:00~20:00", startDate: new Date("2026-11-05T00:00:00"), endDate: new Date("2026-11-07T00:00:00") }],
      2026, 11
    );
    expect(r.dayCount).toBe(3);
    expect(r.totalMinutes).toBe(360);
  });
});
