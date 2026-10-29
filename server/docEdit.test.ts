import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { applyEdits, buildEditUser, listParagraphs, tidyEditText } from "./docEdit";
import { applyToParagraphs, applyAll, autoPruneRows, isCleanupOnly, parseEdits, parseRowOps, verifyEditedTables } from "../shared/docEdit";

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

describe("tidyEditText 공백 보존", () => {
  it("양식의 정렬용 공백을 그대로 쓴다", () => {
    expect(tidyEditText("2026년      10월     27일", "2026년 10월 29일")).toBe("2026년      10월     29일");
    expect(tidyEditText("      2026.  10.  28.(수)", "2026. 10. 30.(금)")).toBe("      2026.  10.  30.(금)");
    expect(tidyEditText("박 동 규  (인)", "엄 순 남 (인)")).toBe("엄 순 남  (인)");
  });
});

describe("todayKst", () => {
  it("한국 시간 기준 날짜", async () => {
    const { todayKst } = await import("./docChat");
    expect(todayKst(new Date("2026-10-29T15:30:00Z"))).toBe("2026년 10월 30일(금)");
    expect(todayKst(new Date("2026-10-29T11:00:00Z"))).toBe("2026년 10월 29일(목)");
  });
});

describe("tidyEditText", () => {
  it("겹친 글머리 기호를 하나로 줄인다", () => {
    expect(tidyEditText("- 센터 2025년 사업 영상 시청 (10분)", "- - 센터 2026년 사업 영상 시청 (10분)")).toBe("- 센터 2026년 사업 영상 시청 (10분)");
  });
  it("원래 있던 기호는 유지하고, 없던 기호는 붙이지 않는다", () => {
    expect(tidyEditText("- 오프닝 공연", "오프닝 마술 공연")).toBe("- 오프닝 마술 공연");
    expect(tidyEditText("한효진", "- 한효진")).toBe("한효진");
    expect(tidyEditText("", "- 새 줄")).toBe("- 새 줄");
  });
  it("줄바꿈·겹공백을 없애고, 숫자 앞 -는 기호로 보지 않는다", () => {
    expect(tidyEditText("○ 가", "○ 나\n다  라")).toBe("○ 나 다 라");
    expect(tidyEditText("100", "-500")).toBe("-500");
  });
});

// 예산표처럼 왼쪽 칸이 세로로 합쳐진 표: 0행 머리글, 1~4행 항목(0열은 4행에 걸친 칸), 5행 계
const spanCell = (c: number, r: number, t: string, rs: number) => `<hp:tc><hp:subList>${para(t)}</hp:subList><hp:cellAddr colAddr="${c}" rowAddr="${r}"/><hp:cellSpan colSpan="1" rowSpan="${rs}"/><hp:cellSz width="100" height="1000"/></hp:tc>`;
const sz = (c: number, r: number, t: string) => cell(c, r, t).replace("</hp:tc>", '<hp:cellSz width="100" height="1000"/></hp:tc>');
const BUDGET = `<?xml version="1.0" encoding="UTF-8"?><hs:sec ${NS_H}>${para("예산")}<hp:p id="9"><hp:run charPrIDRef="0"><hp:tbl rowCnt="6" colCnt="3"><hp:sz width="300" height="6000"/>
<hp:tr>${sz(0, 0, "구분")}${sz(1, 0, "항목")}${sz(2, 0, "금액")}</hp:tr>
<hp:tr>${spanCell(0, 1, "사업보고회", 4)}${sz(1, 1, "업체")}${sz(2, 1, "3,000,000")}</hp:tr>
<hp:tr>${sz(1, 2, "다과")}${sz(2, 2, "1,000,000")}</hp:tr>
<hp:tr>${sz(1, 3, "꽃다발")}${sz(2, 3, "400,000")}</hp:tr>
<hp:tr>${sz(1, 4, "기념품")}${sz(2, 4, "600,000")}</hp:tr>
<hp:tr>${sz(0, 5, "계")}${sz(1, 5, "")}${sz(2, 5, "5,000,000")}</hp:tr>
</hp:tbl></hp:run>${lineseg}</hp:p></hs:sec>`;
async function makeBudget(): Promise<Buffer> {
  const z = new JSZip();
  z.file("mimetype", "application/hwp+zip", { compression: "STORE" });
  z.file("Contents/section0.xml", BUDGET);
  return z.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
const addrs = (xml: string) => Array.from(xml.matchAll(/<hp:cellAddr colAddr="(\d+)" rowAddr="(\d+)"\/>/g)).map((m) => `${m[1]},${m[2]}`);

describe("표 행 추가·삭제(hwpx)", () => {
  it("합쳐진 칸 안의 행을 지우면 합쳐진 칸의 높이가 줄고 아래 행 번호가 당겨진다", async () => {
    const { data, skipped } = await applyEdits(await makeBudget(), [], [{ op: "delete", t: 0, row: 3 }]);
    expect(skipped).toEqual([]);
    const xml = await (await JSZip.loadAsync(data)).file("Contents/section0.xml")!.async("string");
    expect(xml).not.toContain("꽃다발");
    expect(xml).toContain('rowCnt="5"');
    expect(xml).toContain('rowSpan="3"');
    expect(xml).toContain('height="5000"'); // 표 전체 높이도 한 행만큼 줄어든다
    expect(addrs(xml)).toEqual(["0,0", "1,0", "2,0", "0,1", "1,1", "2,1", "1,2", "2,2", "1,3", "2,3", "0,4", "1,4", "2,4"]);
    const again = await listParagraphs(data);
    expect(again.paragraphs.find((p) => p.text === "계")!.cell).toEqual({ t: 0, r: 4, c: 0 });
  });
  it("합쳐진 칸이 시작되는 행을 지우면 합쳐진 칸을 다음 행으로 옮기고 높이만 줄인다", async () => {
    const { data, skipped } = await applyEdits(await makeBudget(), [], [{ op: "delete", t: 0, row: 1 }]);
    expect(skipped).toEqual([]);
    const xml = await (await JSZip.loadAsync(data)).file("Contents/section0.xml")!.async("string");
    expect(xml).not.toContain("업체");
    expect(xml).toContain("사업보고회"); // 합쳐진 칸의 글은 남는다
    expect(xml).toContain('rowSpan="3"');
    expect(xml).toContain('rowCnt="5"');
    expect(addrs(xml)).toEqual(["0,0", "1,0", "2,0", "0,1", "1,1", "2,1", "1,2", "2,2", "1,3", "2,3", "0,4", "1,4", "2,4"]);
    const p = (await listParagraphs(data)).paragraphs;
    expect(p.find((x) => x.text === "사업보고회")!.cell).toEqual({ t: 0, r: 1, c: 0 });
    expect(p.find((x) => x.text === "다과")!.cell).toEqual({ t: 0, r: 1, c: 1 });
  });
  it("그림 같은 개체가 든 행은 지우지 않는다", async () => {
    const z = await JSZip.loadAsync(await makeBudget());
    const xml = (await z.file("Contents/section0.xml")!.async("string")).replace("<hp:t>꽃다발</hp:t>", "<hp:t>꽃다발</hp:t><hp:pic/>");
    z.file("Contents/section0.xml", xml);
    const { skipped } = await applyEdits(await z.generateAsync({ type: "nodebuffer" }), [], [{ op: "delete", t: 0, row: 3 }]);
    expect(skipped[0]).toContain("개체");
  });
  it("행을 추가하면 합쳐진 칸이 늘어나고 새 행에 글이 들어간다", async () => {
    const { data, skipped } = await applyEdits(await makeBudget(), [], [{ op: "insert", t: 0, after: 4, rows: [["", "현수막", "250,000"], ["", "사진 촬영", "150,000"]] }]);
    expect(skipped).toEqual([]);
    const xml = await (await JSZip.loadAsync(data)).file("Contents/section0.xml")!.async("string");
    expect(xml).toContain('rowCnt="8"');
    expect(xml).toContain('rowSpan="6"');
    expect(xml).toContain('height="8000"');
    const p = (await listParagraphs(data)).paragraphs;
    expect(p.find((x) => x.text === "현수막")!.cell).toEqual({ t: 0, r: 5, c: 1 });
    expect(p.find((x) => x.text === "사진 촬영")!.cell).toEqual({ t: 0, r: 6, c: 1 });
    expect(p.find((x) => x.text === "계")!.cell).toEqual({ t: 0, r: 7, c: 0 });
    expect(p.find((x) => x.text === "250,000")!.cell).toEqual({ t: 0, r: 5, c: 2 });
  });
  it("글 고침과 행 삭제를 함께 해도 번호가 어긋나지 않는다", async () => {
    const buf = await makeBudget();
    const { paragraphs } = await listParagraphs(buf);
    const idOf = (t: string) => paragraphs.find((p) => p.text === t)!.id;
    const { data } = await applyEdits(buf, [{ id: idOf("5,000,000"), text: "4,000,000" }], [{ op: "delete", t: 0, row: 4 }]);
    const xml = await (await JSZip.loadAsync(data)).file("Contents/section0.xml")!.async("string");
    expect(xml).toContain("4,000,000");
    expect(xml).not.toContain("기념품");
  });
  it("머리글 행은 지우지 않는다", async () => {
    const { skipped } = await applyEdits(await makeBudget(), [], [{ op: "delete", t: 0, row: 0 }]);
    expect(skipped.length).toBe(1);
  });
});

describe("표 행 작업 계산(공용)", () => {
  const paras = [
    { id: 0, text: "항목", cell: { t: 0, r: 0, c: 0 } }, { id: 1, text: "금액", cell: { t: 0, r: 0, c: 1 } },
    { id: 2, text: "업체", cell: { t: 0, r: 1, c: 0 } }, { id: 3, text: "3,000", cell: { t: 0, r: 1, c: 1 } },
    { id: 4, text: "다과", cell: { t: 0, r: 2, c: 0 } }, { id: 5, text: "1,000", cell: { t: 0, r: 2, c: 1 } },
    { id: 6, text: "합계", cell: { t: 0, r: 3, c: 0 } }, { id: 7, text: "4,000", cell: { t: 0, r: 3, c: 1 } },
  ];
  it("AI가 비운 행은 자동으로 지운다(원래 비어 있던 행은 두고)", () => {
    const edits = [{ id: 4, text: "" }, { id: 5, text: "" }];
    expect(autoPruneRows(paras, edits, [])).toEqual([{ op: "delete", t: 0, row: 2 }]);
  });
  it("글을 고친 표에서는 원래부터 비어 있던 여분의 행도 지운다", () => {
    const extra = [...paras, { id: 8, text: "", cell: { t: 0, r: 4, c: 0 } }, { id: 9, text: "", cell: { t: 0, r: 4, c: 1 } }];
    const edits = [{ id: 3, text: "3,500" }, { id: 5, text: "500" }, { id: 7, text: "4,000" }];
    expect(autoPruneRows(extra, edits, [])).toEqual([{ op: "delete", t: 0, row: 4 }]);
    // 글을 거의 고치지 않은 표의 빈 행은 그대로 둔다(서식 문서의 빈 서명란 등)
    expect(autoPruneRows(extra, [{ id: 3, text: "3,500" }], [])).toEqual([]);
  });
  it("행을 지우고 추가한 뒤의 합계를 검산한다", () => {
    const edits = [{ id: 7, text: "4,500" }];
    const ops = [{ op: "insert" as const, t: 0, after: 2, rows: [["현수막", "500"]] }];
    expect(verifyEditedTables(applyAll(paras, edits, ops))).toEqual([]);
    expect(verifyEditedTables(applyAll(paras, [{ id: 7, text: "9,999" }], ops)).length).toBe(1);
  });
  it("tableOps의 번호는 1부터, 없는 표·머리글 삭제는 버린다", () => {
    const ops = parseRowOps([{ op: "delete", table: 1, row: 3 }, { op: "delete", table: 1, row: 1 }, { op: "delete", table: 5, row: 2 }, { op: "insert", table: 1, after: 2, rows: [["a", "(빈칸)"]] }], paras);
    expect(ops).toEqual([{ op: "delete", t: 0, row: 2 }, { op: "insert", t: 0, after: 1, rows: [["a", ""]] }]);
  });
});

describe("표 행 추가·삭제(docx)", () => {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const wc = (t: string) => `<w:tc><w:p><w:r><w:t>${t}</w:t></w:r></w:p></w:tc>`;
  const doc = `<?xml version="1.0"?><w:document ${W}><w:body><w:tbl><w:tr>${wc("항목")}${wc("금액")}</w:tr><w:tr>${wc("업체")}${wc("3")}</w:tr><w:tr>${wc("다과")}${wc("1")}</w:tr><w:tr>${wc("합계")}${wc("4")}</w:tr></w:tbl></w:body></w:document>`;
  const make = async () => { const z = new JSZip(); z.file("word/document.xml", doc); return z.generateAsync({ type: "nodebuffer" }); };
  it("행을 지우고 추가한다", async () => {
    const { data, skipped } = await applyEdits(await make(), [], [{ op: "delete", t: 0, row: 2 }, { op: "insert", t: 0, after: 1, rows: [["현수막", "2"]] }]);
    expect(skipped).toEqual([]);
    const p = (await listParagraphs(data)).paragraphs.filter((x) => x.cell).map((x) => `${x.cell!.r}:${x.text}`);
    expect(p).toEqual(["0:항목", "0:금액", "1:업체", "1:3", "2:현수막", "2:2", "3:합계", "3:4"]);
  });
});

describe("열 너비 맞춤·새 표(hwpx)", () => {
  const widths = (xml: string) => Array.from(xml.matchAll(/<hp:cellSz width="(\d+)"/g)).map((m) => Number(m[1]));
  it("글을 많이 고친 표는 열 너비를 글 길이에 맞게 다시 나누고 합계 너비는 그대로 둔다", async () => {
    const buf = await makeBudget();
    const { paragraphs } = await listParagraphs(buf);
    const id = (t: string) => paragraphs.find((p) => p.text === t)!.id;
    const { data } = await applyEdits(buf, [
      { id: id("업체"), text: "무대·음향·진행을 맡는 업체(축제 전문)" },
      { id: id("3,000,000"), text: "3,500,000" }, { id: id("5,000,000"), text: "5,500,000" },
    ], [{ op: "fit", t: 0 }]);
    const xml = await (await JSZip.loadAsync(data)).file("Contents/section0.xml")!.async("string");
    const w = widths(xml);
    const firstRow = w.slice(0, 3);
    expect(firstRow.reduce((a, b) => a + b, 0)).toBe(300); // 합계 너비 유지
    expect(firstRow[1]).toBeGreaterThan(firstRow[0]); // 글이 긴 항목 열이 넓어짐
    expect(firstRow[1]).toBeGreaterThan(firstRow[2]);
    expect(w.filter((_, i) => i % 3 === 0 || true).length).toBeGreaterThan(0);
  });
  it("글을 거의 고치지 않은 표의 너비는 건드리지 않는다", async () => {
    const buf = await makeBudget();
    const { data } = await applyEdits(buf, [{ id: 0, text: "예산(안)" }]);
    const xml = await (await JSZip.loadAsync(data)).file("Contents/section0.xml")!.async("string");
    expect(new Set(widths(xml))).toEqual(new Set([100]));
  });
  it("기존 표 모양을 복사해 새 표를 문단 뒤에 만들고 행 수를 맞춘다", async () => {
    const buf = await makeBudget();
    const { data, skipped } = await applyEdits(buf, [], [{ op: "newTable", from: 0, afterId: 0, rows: [["구분", "항목", "금액"], ["행사", "대관료", "1,000,000"], ["행사", "홍보물", "200,000"], ["계", "", "1,200,000"]] }]);
    expect(skipped).toEqual([]);
    const { paragraphs } = await listParagraphs(data);
    const tables = new Set(paragraphs.filter((p) => p.cell).map((p) => p.cell!.t));
    expect(tables.size).toBe(2);
    const second = paragraphs.filter((p) => p.cell?.t === 0); // 새 표가 문서에서 먼저 나온다(본문 첫 문단 뒤)
    expect(second.find((p) => p.text === "대관료")).toBeTruthy();
    expect(second.find((p) => p.text === "1,200,000")!.cell).toEqual({ t: 0, r: 3, c: 2 });
    expect(paragraphs.filter((p) => p.cell?.t === 1).map((p) => p.text)).toContain("꽃다발"); // 원래 표는 그대로
    const xml = await (await JSZip.loadAsync(data)).file("Contents/section0.xml")!.async("string");
    expect(xml.match(/<hp:tbl /g)!.length).toBe(2);
    expect(xml).toContain('id="1"');
  });
  it("행이 더 필요하면 늘리고, 열 수가 다르면 만들지 않는다", async () => {
    const buf = await makeBudget();
    const rows = [["구분", "항목", "금액"], ...Array.from({ length: 7 }, (_, i) => ["행사", `항목${i}`, `${i}00`]), ["계", "", "2,100"]];
    const ok = await applyEdits(buf, [], [{ op: "newTable", from: 0, afterId: 0, rows }]);
    expect(ok.skipped).toEqual([]);
    const p = (await listParagraphs(ok.data)).paragraphs.filter((x) => x.cell?.t === 0);
    expect(p.find((x) => x.text === "항목6")!.cell!.r).toBe(7);
    expect(p.find((x) => x.text === "2,100")!.cell!.r).toBe(8);
    const bad = await applyEdits(buf, [], [{ op: "newTable", from: 0, afterId: 0, rows: [["a", "b"], ["c", "d"]] }]);
    expect(bad.skipped[0]).toContain("열 수");
  });
});

describe("열 너비 맞춤·새 표(docx)", () => {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const wc = (t: string, w: number) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>${t}</w:t></w:r></w:p></w:tc>`;
  const row = (a: string, b: string) => `<w:tr>${wc(a, 3000)}${wc(b, 3000)}</w:tr>`;
  const doc = `<?xml version="1.0"?><w:document ${W}><w:body><w:p><w:r><w:t>예산</w:t></w:r></w:p><w:tbl><w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="3000"/></w:tblGrid>${row("항목", "금액")}${row("업체", "3")}${row("다과", "1")}${row("합계", "4")}</w:tbl></w:body></w:document>`;
  const make = async () => { const z = new JSZip(); z.file("word/document.xml", doc); return z.generateAsync({ type: "nodebuffer" }); };
  it("새 표를 문단 뒤에 만들고 열 너비를 글에 맞춘다", async () => {
    const { data, skipped } = await applyEdits(await make(), [], [{ op: "newTable", from: 0, afterId: 0, rows: [["항목", "금액"], ["무대와 음향 설치 및 철거 일체", "9"], ["다과", "1"], ["기념품", "2"], ["합계", "12"]] }]);
    expect(skipped).toEqual([]);
    const xml = await (await JSZip.loadAsync(data)).file("word/document.xml")!.async("string");
    expect(xml.match(/<w:tbl>/g)!.length).toBe(2);
    const grid = Array.from(xml.split("</w:tbl>")[0].matchAll(/<w:gridCol w:w="(\d+)"/g)).map((m) => Number(m[1]));
    expect(grid.reduce((a, b) => a + b, 0)).toBe(6000);
    expect(grid[0]).toBeGreaterThan(grid[1]);
    const t = (await listParagraphs(data)).paragraphs.filter((p) => p.cell?.t === 0).map((p) => p.text);
    expect(t).toContain("무대와 음향 설치 및 철거 일체");
  });
});

describe("표 정리 지시 판별·응답 받아들이기", () => {
  it("글 내용을 바꾸라는 말이 없는 짧은 정리 지시만 AI 없이 처리한다", () => {
    expect(isCleanupOnly("고칠 파일의 표나 빈칸 등 정리해줘")).toBe(true);
    expect(isCleanupOnly("빈 행 지워줘")).toBe(true);
    expect(isCleanupOnly("표 너비 맞춰줘")).toBe(true);
    expect(isCleanupOnly("행사일을 12월 5일로 바꾸고 표 정리해줘")).toBe(false);
    expect(isCleanupOnly("예산표를 개요 뒤로 옮겨줘")).toBe(false);
  });
  it("edits 없이 tableOps만 답해도 받아들인다", () => {
    const paras = [{ id: 0, text: "a", cell: { t: 0, r: 0, c: 0 } }, { id: 1, text: "b", cell: { t: 0, r: 1, c: 0 } }, { id: 2, text: "c", cell: { t: 0, r: 2, c: 0 } }];
    const r = parseEdits('{"tableOps":[{"op":"delete","table":1,"row":3}]}', paras)!;
    expect(r.edits).toEqual([]);
    expect(r.rowOps).toEqual([{ op: "delete", t: 0, row: 2 }]);
  });
  it("정리 모드는 글을 고치지 않은 표의 빈 행도 지운다", () => {
    const paras = [
      { id: 0, text: "구분", cell: { t: 0, r: 0, c: 0 } }, { id: 1, text: "금액", cell: { t: 0, r: 0, c: 1 } },
      { id: 2, text: "업체", cell: { t: 0, r: 1, c: 0 } }, { id: 3, text: "3", cell: { t: 0, r: 1, c: 1 } },
      { id: 4, text: "", cell: { t: 0, r: 2, c: 0 } }, { id: 5, text: "", cell: { t: 0, r: 2, c: 1 } },
      { id: 6, text: "", cell: { t: 0, r: 3, c: 0 } }, { id: 7, text: "", cell: { t: 0, r: 3, c: 1 } },
    ];
    expect(autoPruneRows(paras, [], [], true)).toEqual([{ op: "delete", t: 0, row: 2 }, { op: "delete", t: 0, row: 3 }]);
  });
});

describe("칸 높이 맞춤(hwpx)", () => {
  const tc = (c: number, r: number, t: string, w: number, h: number, rs = 1) => `<hp:tc><hp:subList>${para(t)}</hp:subList><hp:cellAddr colAddr="${c}" rowAddr="${r}"/><hp:cellSpan colSpan="1" rowSpan="${rs}"/><hp:cellSz width="${w}" height="${h}"/><hp:cellMargin left="510" right="510" top="141" bottom="141"/></hp:tc>`;
  const tall = (longNote: boolean) => `<?xml version="1.0"?><hs:sec ${NS_H}><hp:p id="9"><hp:run charPrIDRef="0"><hp:tbl rowCnt="3" colCnt="2"><hp:sz width="40000" height="30000"/>
<hp:tr>${tc(0, 0, "시간", 10000, 2000)}${tc(1, 0, "내용", 30000, 2000)}</hp:tr>
<hp:tr>${tc(0, 1, "10:00", 10000, 14000)}${tc(1, 1, "행사 준비", 30000, 14000)}</hp:tr>
<hp:tr>${tc(0, 2, "11:00", 10000, 14000)}${tc(1, 2, longNote ? "가".repeat(400) : "마무리", 30000, 14000)}</hp:tr>
</hp:tbl></hp:run>${lineseg}</hp:p></hs:sec>`;
  const make = async (long: boolean) => { const z = new JSZip(); z.file("mimetype", "application/hwp+zip", { compression: "STORE" }); z.file("Contents/section0.xml", tall(long)); return z.generateAsync({ type: "nodebuffer" }); };
  const heights = (xml: string) => Array.from(xml.matchAll(/<hp:cellSz width="\d+" height="(\d+)"/g)).map((m) => Number(m[1]));
  it("글이 짧은데 칸만 높은 행은 높이를 줄이고 표 전체 높이도 맞춘다", async () => {
    const buf = await make(false);
    const { paragraphs } = await listParagraphs(buf);
    const id = (t: string) => paragraphs.find((p) => p.text === t)!.id;
    const { data } = await applyEdits(buf, [{ id: id("10:00"), text: "13:00" }, { id: id("행사 준비"), text: "사전 점검" }, { id: id("11:00"), text: "14:00" }], [{ op: "fit", t: 0 }]);
    const xml = await (await JSZip.loadAsync(data)).file("Contents/section0.xml")!.async("string");
    const h = heights(xml);
    expect(h[2]).toBeLessThan(14000);
    expect(h[2]).toBe(h[3]); // 같은 행의 칸 높이는 같다
    expect(h[4]).toBeLessThan(14000);
    const rowSum = h[0] + h[2] + h[4];
    expect(xml).toContain(`<hp:sz width="40000" height="${rowSum}"/>`);
  });
  it("글이 많은 칸은 줄이지 않고, 높이를 늘리지도 않는다", async () => {
    const buf = await make(true);
    const { paragraphs } = await listParagraphs(buf);
    const id = (t: string) => paragraphs.find((p) => p.text === t)!.id;
    const { data } = await applyEdits(buf, [{ id: id("10:00"), text: "13:00" }, { id: id("행사 준비"), text: "사전 점검" }, { id: id("11:00"), text: "14:00" }]);
    const h = heights(await (await JSZip.loadAsync(data)).file("Contents/section0.xml")!.async("string"));
    expect(h[4]).toBe(14000); // 400자는 원래 높이를 넘으므로 그대로
    expect(Math.max(...h)).toBeLessThanOrEqual(14000);
  });
});

describe("여러 조각으로 나뉜 문단의 서식", () => {
  it("공백뿐인 첫 조각이 아니라 내용이 든 조각의 글자 모양을 쓴다", async () => {
    const NSH = 'xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section"';
    const xml = `<?xml version="1.0"?><hs:sec ${NSH}><hp:p id="1"><hp:run charPrIDRef="3"><hp:t>      </hp:t></hp:run><hp:run charPrIDRef="9"><hp:t>2026년 10월 27일</hp:t></hp:run></hp:p></hs:sec>`;
    const z = new JSZip(); z.file("mimetype", "application/hwp+zip", { compression: "STORE" }); z.file("Contents/section0.xml", xml);
    const buf = await z.generateAsync({ type: "nodebuffer" });
    const { paragraphs } = await listParagraphs(buf);
    const { data } = await applyEdits(buf, [{ id: paragraphs[0].id, text: "2026년 10월 29일" }]);
    const out = await (await JSZip.loadAsync(data)).file("Contents/section0.xml")!.async("string");
    expect(out).toMatch(/charPrIDRef="9"><hp:t>\s*2026년 10월 29일<\/hp:t>/);
    expect(out).toMatch(/charPrIDRef="3"><hp:t\/?>/);
  });
});
