import { describe, expect, it } from "vitest";
import { summarize, monthRange, isDateStr } from "../shared/attendance";
import { normalizeBirth, parseParticipantRows } from "../shared/participantImport";

describe("출석 집계", () => {
  const recs = [
    { participantId: 1, date: "2026-10-01", status: "present" as const },
    { participantId: 1, date: "2026-10-08", status: "late" as const },
    { participantId: 1, date: "2026-10-15", status: "absent" as const },
    { participantId: 2, date: "2026-10-01", status: "excused" as const },
    { participantId: 2, date: "2026-10-08", status: "present" as const },
    { participantId: 99, date: "2026-10-08", status: "present" as const }, // 반 소속이 아닌 사람은 제외
  ];
  const s = summarize(recs, [1, 2, 3]);
  it("출석률은 사유를 제외하고 계산", () => {
    expect(s.byParticipant.get(1)!.rate).toBe(66.7);
    expect(s.byParticipant.get(2)!.rate).toBe(100);
    expect(s.byParticipant.get(3)!.rate).toBeNull();
  });
  it("날짜별 집계와 날짜 목록", () => {
    expect(s.dates).toEqual(["2026-10-01", "2026-10-08", "2026-10-15"]);
    expect(s.byDate.get("2026-10-08")!.present).toBe(1);
    expect(s.all.recorded).toBe(5);
  });
  it("실인원=1회 이상 참석한 사람, 연인원=참석(출석+지각) 건수", () => {
    // 참여자1: 출석·지각·결석 / 참여자2: 사유·출석 / 참여자3: 기록 없음
    expect(s.people).toBe(2);
    expect(s.extended).toBe(3);
    const onlyExcused = summarize([{ participantId: 1, date: "2026-10-01", status: "excused" }], [1]);
    expect(onlyExcused.people).toBe(0);
    expect(onlyExcused.extended).toBe(0);
  });
  it("월 범위·날짜 검증", () => {
    expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2027-01-01" });
    expect(isDateStr("2026-02-30")).toBe(false);
    expect(isDateStr("2026-10-16")).toBe(true);
  });
});

describe("참여자 엑셀 해석", () => {
  it("생년월일 표기 정규화", () => {
    expect(normalizeBirth("1990.1.2")).toBe("1990-01-02");
    expect(normalizeBirth("19900102")).toBe("1990-01-02");
    expect(normalizeBirth("")).toBeUndefined();
    expect(normalizeBirth("abc")).toBeNull();
    expect(normalizeBirth("1990-02-31")).toBeNull();
    expect(normalizeBirth(32874)).toBe("1990-01-01");
  });
  it("외국인: 머리글 순서가 달라도 이름으로 해석", () => {
    const rows = parseParticipantRows([["성명", "국적", "성별", "반"], ["Nguyen", "베트남", "여", "한국어A"]], "foreigner");
    expect(rows[0]).toMatchObject({ name: "Nguyen", nationality: "베트남", gender: "female", className: "한국어A" });
  });
  it("내국인: 머리글 없으면 내국인 양식 순서(이름,성별,생년월일,…)", () => {
    const rows = parseParticipantRows([["홍길동", "남", "1980-05-06", "010-1", "서울", "컴퓨터반", "메모"]], "domestic");
    expect(rows[0]).toMatchObject({ birthDate: "1980-05-06", phone: "010-1", region: "서울", className: "컴퓨터반", note: "메모" });
    expect(rows[0].nationality).toBeUndefined();
  });
  it("기존 6열 양식(머리글 있음)도 그대로 동작, 오류 행 표시", () => {
    const rows = parseParticipantRows([["이름", "성별", "국적", "전화번호", "비자종류", "거주지역"], ["A", "남", "중국", "", "E-9", "경기"], ["B", "?", "", "", "", ""]], "foreigner");
    expect(rows[0].visaType).toBe("E-9");
    expect(rows[1].error).toContain("성별");
  });
});
