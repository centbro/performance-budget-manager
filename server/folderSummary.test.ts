import { describe, it, expect } from "vitest";
import { parseFolderRows } from "../shared/folderSummary";
import { buildFolderUser } from "./folderSummary";

describe("폴더 문서 요약 파싱", () => {
  const names = ["a.pdf", "b.docx", "c.txt"];
  it("index에 맞춰 행을 만들고 빠진 파일은 빈 값으로 채운다", () => {
    const raw = JSON.stringify({ rows: [{ index: 1, kind: "복명서", date: "2026-10-11", summary: "소양교육 참석", facts: ["출장지: 봉담읍", "금액: 10,000원"] }, { index: 0, kind: "신청서", summary: "신청" }] });
    const r = parseFolderRows(raw, names);
    expect(r.map((x) => x.name)).toEqual(names);
    expect(r[0].kind).toBe("신청서");
    expect(r[1].facts).toBe("출장지: 봉담읍 / 금액: 10,000원");
    expect(r[2].summary).toBe("");
  });
  it("깨진 응답이어도 파일 수만큼 빈 행을 돌려준다", () => {
    expect(parseFolderRows("죄송합니다", names)).toHaveLength(3);
  });
  it("마크다운 기호를 지우고 길이를 줄인다", () => {
    const r = parseFolderRows(JSON.stringify({ rows: [{ index: 0, summary: "**" + "가".repeat(300) }] }), ["a"]);
    expect(Array.from(r[0].summary).length).toBeLessThanOrEqual(160);
    expect(r[0].summary).not.toContain("*");
  });
  it("프롬프트에 파일 번호와 이름이 들어간다", () => {
    expect(buildFolderUser([{ name: "x.pdf", text: "내용" }])).toContain("### 파일 0: x.pdf");
  });
});
