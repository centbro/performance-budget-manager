import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { parseDoc, parsePick, verifyTotals, docToText } from "../shared/docChat";
import { buildDocx, buildWriteUser } from "./docChat";

const raw = JSON.stringify({
  title: "2026년 사업보고회 계획(안)",
  blocks: [
    { type: "heading", level: 1, text: "1. 개요" },
    { type: "paragraph", text: "**일시**: 2026. 12. 6.(토) 13:00~14:30" },
    { type: "bullets", items: ["오프닝 공연", "센터장 환영사", ""] },
    { type: "table", caption: "소요 예산", headers: ["항목", "금액(원)"], rows: [
      ["업체", "3,965,000"], ["다과·도시락", "1,900,000"], ["꽃다발·감사패", "400,000"], ["기념품", "1,026,140"], ["합계", "7,291,140"],
    ] },
    { type: "bogus", text: "x" },
  ],
  notes: ["장소 미정"],
});

describe("문서 구조 해석", () => {
  it("코드블록·군더더기·마크다운 기호를 정리한다", () => {
    const d = parseDoc("```json\n" + raw + "\n```")!;
    expect(d.title).toContain("사업보고회");
    expect(d.blocks).toHaveLength(4); // bogus 제외
    expect(d.blocks[1]).toMatchObject({ type: "paragraph", text: "일시: 2026. 12. 6.(토) 13:00~14:30" });
    expect(d.blocks[2]).toMatchObject({ items: ["오프닝 공연", "센터장 환영사"] });
    expect(d.notes).toEqual(["장소 미정"]);
  });
  it("깨진 응답은 null", () => { expect(parseDoc("죄송합니다")).toBeNull(); expect(parseDoc('{"blocks":[]}')).toBeNull(); });
  it("표 칸 수를 머리글에 맞춘다", () => {
    const d = parseDoc(JSON.stringify({ title: "t", blocks: [{ type: "table", headers: ["a", "b", "c"], rows: [["1"], ["1", "2", "3", "4"]] }] }))!;
    expect((d.blocks[0] as any).rows).toEqual([["1", "", ""], ["1", "2", "3"]]);
  });
  it("참고 파일 고르기: 없는 이름은 버린다", () => {
    expect(parsePick('{"files":["a/b.docx","없는파일.pdf","a/b.docx","c.xlsx"]}', ["a/b.docx", "c.xlsx"])).toEqual(["a/b.docx", "c.xlsx"]);
  });
});

describe("합계 검증", () => {
  it("맞는 예산표는 통과 — 지시 예시: 7,291,140 = 3,965,000 + 1,900,000 + 400,000 + 1,026,140", () => {
    expect(verifyTotals(parseDoc(raw)!)).toEqual([]);
  });
  it("틀린 합계를 잡는다", () => {
    const bad = parseDoc(raw.replace("3,965,000", "3,900,000"))!;
    const w = verifyTotals(bad);
    expect(w).toHaveLength(1);
    expect(w[0]).toContain("7,226,140");
    expect(w[0]).toContain("7,291,140");
  });
  it("소계가 있는 표·합계 없는 표는 건너뜀", () => {
    const d = parseDoc(JSON.stringify({ title: "t", blocks: [{ type: "table", headers: ["항목", "금액"], rows: [["가", "1,000"], ["소계", "1,000"], ["나", "2,000"], ["합계", "9"]] }] }))!;
    expect(verifyTotals(d)).toEqual([]);
  });
});

describe("Word 파일", () => {
  it("docx가 만들어지고 본문·표가 들어간다", async () => {
    const buf = await buildDocx(parseDoc(raw)!);
    expect(buf.subarray(0, 2).toString()).toBe("PK");
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("2026년 사업보고회 계획(안)");
    expect(xml).toContain("7,291,140");
    expect(xml).toContain("<w:tbl>");
  });
  it("프롬프트에 지시·참고파일·이전 초안이 들어간다", () => {
    const u = buildWriteUser({ instruction: "예산표를 앞으로", history: [{ role: "user", text: "처음 지시" }], sources: [{ name: "작년.docx", text: "작년 계획" }], prevDoc: parseDoc(raw)!, fix: ["합계 오류"] });
    for (const k of ["예산표를 앞으로", "작년.docx", "처음 지시", "이전 초안", "합계 오류"]) expect(u).toContain(k);
  });
  it("텍스트 변환", () => expect(docToText(parseDoc(raw)!)).toContain("합계\t7,291,140"));
});

import { styleHints } from "../shared/styleHints";
describe("기존 문서 말투 관찰", () => {
  const gaejo = ["1. 추진 개요", "○ 일시: 2025. 12. 5.(금) 14:00~16:00", "○ 장소: 화성시외국인복지센터 3층 강당", "○ 대상: 외국인 주민 및 유관기관 관계자 100명", "- 오프닝 공연을 시작으로 센터장 환영사를 진행함", "- 지난 1년간의 사업 성과를 영상으로 공유함", "2. 소요 예산", "○ 총 예산: 7,291,140원"];
  it("개조식·기호·날짜·시간·금액을 읽어낸다", () => {
    const h = styleHints(gaejo);
    expect(h).toContain("개조식");
    expect(h).toContain("○(");
    expect(h).toContain("2025. 12. 5.(금)");
    expect(h).toContain("14:00~16:00");
    expect(h).toContain("7,291,140원");
  });
  it("존댓말 서술식도 구분", () => {
    expect(styleHints(["센터는 올해 사업을 성공적으로 마무리하였습니다.", "많은 분들이 참여해 주셔서 감사합니다.", "내년에도 더 좋은 프로그램으로 찾아뵙겠습니다."])).toContain("서술식 존댓말");
  });
  it("글이 너무 적으면 빈 문자열", () => expect(styleHints(["a", "b"])).toBe(""));
  it("프롬프트에 관찰 결과가 들어간다", () => {
    const u = buildWriteUser({ instruction: "x", history: [], sources: [{ name: "작년.docx", text: gaejo.join("\n") }] });
    expect(u).toContain("[참고 파일의 말투·형식 관찰]");
    expect(u).toContain("개조식");
  });
});
