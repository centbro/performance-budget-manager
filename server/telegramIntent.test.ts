import { describe, expect, it } from "vitest";
import { parseIntent } from "./telegramIntent";

describe("parseIntent: 출석·조회·삭제", () => {
  it("전원 출석 + 예외", () => {
    const r = parseIntent(JSON.stringify({ intent: "attendance", className: "한글교실", date: "2026-11-17", marks: [{ name: "김철수", status: "absent" }], rest: "present" }));
    expect(r).toEqual({ intent: "attendance", className: "한글교실", date: "2026-11-17", marks: [{ name: "김철수", status: "absent" }], rest: "present" });
  });
  it("잘못된 상태·날짜는 버린다", () => {
    const r = parseIntent(JSON.stringify({ intent: "attendance", className: "", date: "내일", marks: [{ name: "A", status: "bogus" }, { name: "B", status: "late" }], rest: "" }));
    expect(r).toEqual({ intent: "attendance", className: "", date: "", marks: [{ name: "B", status: "late" }], rest: null });
  });
  it("누가 출석인지 없으면 되묻는다", () => {
    expect(parseIntent(JSON.stringify({ intent: "attendance", marks: [] })).intent).toBe("chat");
  });
  it("조회·삭제는 내용이 있어야 한다", () => {
    expect(parseIntent(JSON.stringify({ intent: "lookup", text: "김철수" }))).toEqual({ intent: "lookup", name: "김철수" });
    expect(parseIntent(JSON.stringify({ intent: "lookup", text: "" })).intent).toBe("chat");
    expect(parseIntent(JSON.stringify({ intent: "delete_schedule", text: "개강식" }))).toEqual({ intent: "delete_schedule", text: "개강식" });
    expect(parseIntent(JSON.stringify({ intent: "delete_schedule", text: "" })).intent).toBe("chat");
  });
});
