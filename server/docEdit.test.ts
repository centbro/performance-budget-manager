import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { applyEdits, buildEditUser, listParagraphs } from "./docEdit";
import { applyToParagraphs, parseEdits, verifyEditedTables } from "../shared/docEdit";

const NS_H = 'xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core"';
const lineseg = '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42000" flags="393216"/></hp:linesegarray>';
const para = (t: string, extra = "") => `<hp:p id="0" paraPrIDRef="3" styleIDRef="0"><hp:run charPrIDRef="7">${extra}${t ? `<hp:t>${t}</hp:t>` : ""}</hp:run>${lineseg}</hp:p>`;
const cell = (c: number, r: number, t: string) => `<hp:tc name="" header="0"><hp:subList>${para(t)}</hp:subList><hp:cellAddr colAddr="${c}" rowAddr="${r}"/><hp:cellSpan colSpan="1" rowSpan="1"/></hp:tc>`;
const SECTION = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hs:sec ${NS_H}>
${para("2025년 사업보고회 계획(안)", "<hp:secPr/>")}
<hp:p id="1"><hp:run charPrIDRef="1"><hp:t>일시: 2025. 12. 5.(금) </hp:t></hp:run><hp:run charPrIDRef="2"><hp:t>14:00~16:00</hp:t></hp:run>${lineseg}</hp:p>
<hp:p id="2"><hp:run charPrIDRef="0"><hp:tbl rowCnt="4" colCnt="2">
<hp:tr>${cell(0, 0, "항목")}${cell(1, 0, "금액(원)")}</hp:tr>
<hp:tr>${cell(0, 1, "업체")}${cell(1, 1, "3,000,000")}</hp:tr>
<hp:tr>${cell(0, 2, "다과")}${cell(1, 2, "")}</hp:tr>
<hp:tr>${cell(0, 3, "합계")}${cell(1, 3, "4,000,000")}</hp:tr>
</hp:tbl></hp:run>${lineseg}</hp:p>
${para("끝.")}
</hs:sec>`;

async function makeHwpx(): Promise<Buffer> {
  const z = new JSZip();
  z.file("mimetype", "application/hwp+zip", { compression: "STORE" });
  z.file("version.xml", "<v/>");
  z.file("Contents/section0.xml", SECTION);
  z.file("Contents/header.xml", "<h/>");
  return z.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

describe("hwpx 문단 목록", () => {
  it("본문·표 칸(빈칸 포함)을 번호와 위치로 나열", async () => {
    const r = await listParagraphs(await makeHwpx());
    expect(r.kind).toBe("hwpx");
    const texts = r.paragraphs.map((p) => p.text);
    expect(texts).toContain("2025년 사업보고회 계획(안)");
    expect(texts).toContain("일시: 2025. 12. 5.(금) 14:00~16:00"); // 여러 run을 한 문단으로
    const empty = r.paragraphs.find((p) => p.cell && p.cell.r === 2 && p.cell.c === 1)!;
    expect(empty.text).toBe("");
    expect(r.paragraphs.find((p) => p.text === "3,000,000")!.cell).toEqual({ t: 0, r: 1, c: 1 });
  });
});

describe("hwpx 고쳐 쓰기", () => {
  it("글자만 바꾸고 서식(run·문단 속성)은 유지, 빈 칸도 채운다", async () => {
    const buf = await makeHwpx();
    const { paragraphs } = await listParagraphs(buf);
    const id = (t: string) => paragraphs.find((p) => p.text === t)!.id;
    const emptyId = paragraphs.find((p) => p.cell?.r === 2 && p.cell?.c === 1)!.id;
    const { data, changed } = await applyEdits(buf, [
      { id: id("2025년 사업보고회 계획(안)"), text: "2026년 사업보고회 계획(안)" },
      { id: id("일시: 2025. 12. 5.(금) 14:00~16:00"), text: "일시: 2026. 12. 6.(일) 13:00~14:30" },
      { id: emptyId, text: "1,000,000" },
      { id: id("3,000,000"), text: "3,000,000", after: "(부가세 포함)" },
      { id: id("4,000,000"), text: "4,000,000" },
    ]);
    expect(changed).toBeGreaterThanOrEqual(4);
    const z = await JSZip.loadAsync(data);
    const xml = await z.file("Contents/section0.xml")!.async("string");
    expect(xml).toContain("2026년 사업보고회 계획(안)");
    expect(xml).not.toContain("2025년");
    expect(xml).toContain("일시: 2026. 12. 6.(일) 13:00~14:30");
    expect(xml).not.toContain("14:00~16:00");
    expect(xml).toContain('charPrIDRef="1"'); // 서식 참조 유지
    expect(xml).toContain("<hp:secPr/>"); // 문서 설정 요소 유지
    expect(xml).toContain("1,000,000"); // 빈 칸 채움
    expect(xml).toContain("(부가세 포함)");
    // 다시 읽어도 구조가 유지된다
    const again = await listParagraphs(data);
    expect(again.paragraphs.find((p) => p.cell?.r === 2 && p.cell?.c === 1)!.text).toBe("1,000,000");
    // 고친 문단의 줄 배치 캐시는 지워진다
    const firstPara = xml.split("</hp:p>")[0];
    expect(firstPara).not.toContain("linesegarray");
  });
  it("압축 파일 구조: mimetype이 첫 항목이며 압축 없이 저장", async () => {
    const buf = await makeHwpx();
    const { data } = await applyEdits(buf, [{ id: 0, text: "바꿈" }]);
    expect(data.subarray(0, 4).toString("hex")).toBe("504b0304");
    expect(data.readUInt16LE(8)).toBe(0); // 첫 항목 압축 방식 0 = 저장
    const nameLen = data.readUInt16LE(26);
    expect(data.subarray(30, 30 + nameLen).toString()).toBe("mimetype");
  });
  it("없는 번호는 무시, 옛 hwp·엉뚱한 파일은 오류", async () => {
    const buf = await makeHwpx();
    expect((await applyEdits(buf, [{ id: 9999, text: "x" }])).changed).toBe(0);
    await expect(listParagraphs(Buffer.from("d0cf11e0a1b11ae1", "hex"))).rejects.toThrow(/hwpx/);
    await expect(listParagraphs(Buffer.from("hello"))).rejects.toThrow();
  });
});

describe("docx 고쳐 쓰기", () => {
  it("본문·표 칸 수정", async () => {
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const body = `<w:document ${W}><w:body>
<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>2025년 계획</w:t></w:r><w:r><w:t> (안)</w:t></w:r></w:p>
<w:tbl><w:tr><w:tc><w:p><w:r><w:t>구분</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>내용</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>일시</w:t></w:r></w:p></w:tc><w:tc><w:p/></w:tc></w:tr></w:tbl>
</w:body></w:document>`;
    const z = new JSZip(); z.file("[Content_Types].xml", "<Types/>"); z.file("word/document.xml", body);
    const buf = await z.generateAsync({ type: "nodebuffer" });
    const { paragraphs } = await listParagraphs(buf);
    expect(paragraphs[0].text).toBe("2025년 계획 (안)");
    const empty = paragraphs.find((p) => p.cell?.r === 1 && p.cell?.c === 1)!;
    const { data } = await applyEdits(buf, [{ id: paragraphs[0].id, text: "2026년 계획 (안)" }, { id: empty.id, text: "12월 6일" }]);
    const xml = await (await JSZip.loadAsync(data)).file("word/document.xml")!.async("string");
    expect(xml).toContain("2026년 계획 (안)");
    expect(xml).toContain("<w:b/>"); // 굵게 서식 유지
    expect(xml).toContain("12월 6일");
  });
});

describe("AI 응답 해석·검산", () => {
  const paras = [{ id: 1, text: "a" }, { id: 2, text: "b" }];
  it("없는 번호·같은 글·군더더기 제거", () => {
    const r = parseEdits('```json\n{"edits":[{"id":1,"text":"a"},{"id":2,"text":"**새** 글\\n둘째줄"},{"id":99,"text":"x"},{"id":2,"after":"추가"}],"notes":["확인"]}\n```', paras)!;
    expect(r.edits).toEqual([{ id: 2, text: "새 글 둘째줄", after: "추가" }]);
    expect(r.notes).toEqual(["확인"]);
    expect(parseEdits("죄송합니다", paras)).toBeNull();
  });
  it("고친 뒤 표 합계 검산", async () => {
    const { paragraphs } = await listParagraphs(await makeHwpx());
    const get = (t: string) => paragraphs.find((p) => p.text === t)!.id;
    const empty = paragraphs.find((p) => p.cell?.r === 2 && p.cell?.c === 1)!.id;
    const bad = applyToParagraphs(paragraphs, [{ id: get("3,000,000"), text: "3,000,000" }, { id: empty, text: "500,000" }]);
    expect(verifyEditedTables(bad)).toHaveLength(1); // 3,000,000+500,000 ≠ 4,000,000
    const good = applyToParagraphs(paragraphs, [{ id: empty, text: "1,000,000" }]);
    expect(verifyEditedTables(good)).toEqual([]);
  });
  it("프롬프트에 위치·빈칸 표시", async () => {
    const { paragraphs } = await listParagraphs(await makeHwpx());
    const u = buildEditUser({ instruction: "올해로", history: [], sources: [], paragraphs });
    expect(u).toContain("(표1 3행 2열) (빈칸)");
    expect(u).toContain("(본문) 2025년 사업보고회 계획(안)");
  });
});

describe("고쳐 쓰기 프롬프트: 기존 말투 따르기", () => {
  it("문서의 말투·형식 관찰이 들어간다", () => {
    const texts = ["1. 개요", "○ 일시: 2025. 12. 5.(금) 14:00~16:00", "○ 장소: 센터 3층 강당에서 진행함", "○ 대상: 외국인 주민 100명을 초청함", "- 센터장 환영사 및 내빈 소개를 실시함"];
    const u = buildEditUser({ instruction: "올해로", history: [], sources: [], paragraphs: texts.map((t, i) => ({ id: i, text: t })) });
    expect(u).toContain("[문서의 말투·형식 관찰]");
    expect(u).toContain("개조식");
    expect(u).toContain("2025. 12. 5.(금)");
  });
});
