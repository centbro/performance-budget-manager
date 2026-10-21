import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { detectKind, extractTemplateText, TemplateFileError } from "./templateFile";

const docx = async () => {
  const z = new JSZip();
  z.file("word/document.xml", `<w:document><w:body><w:p><w:r><w:t>출장 신청서</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>출장자</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>출장지</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>목적 &amp; 사유</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>`);
  return Buffer.from(await z.generateAsync({ type: "uint8array" }));
};
const hwpx = async () => {
  const z = new JSZip();
  z.file("Contents/section0.xml", `<hs:sec><hp:p><hp:run><hp:t>복명서</hp:t></hp:run></hp:p><hp:tbl><hp:tr><hp:tc><hp:p><hp:run><hp:t>출장기간</hp:t></hp:run></hp:p></hp:tc><hp:tc><hp:p><hp:run><hp:t>복명 내용</hp:t></hp:run></hp:p></hp:tc></hp:tr></hp:tbl></hs:sec>`);
  return Buffer.from(await z.generateAsync({ type: "uint8array" }));
};

describe("서식 파일 읽기", () => {
  it("docx: 문단과 표의 칸 이름을 읽는다", async () => {
    const r = await extractTemplateText(await docx());
    expect(r.kind).toBe("docx");
    expect(r.text).toContain("출장 신청서");
    expect(r.text).toContain("출장자");
    expect(r.text).toContain("출장지");
    expect(r.text).toContain("목적 & 사유");
  });
  it("hwpx: 문단과 표의 칸 이름을 읽는다", async () => {
    const r = await extractTemplateText(await hwpx());
    expect(r.kind).toBe("hwpx");
    expect(r.text).toContain("복명서");
    expect(r.text).toContain("출장기간 | 복명 내용");
  });
  it("xlsx를 읽는다", async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["출장자", "", "출장지"], ["목적"]]), "s");
    const r = await extractTemplateText(Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" })));
    expect(r.kind).toBe("xlsx");
    expect(r.text).toContain("출장자 | 출장지");
  });
  it("구형 hwp/doc는 변환 안내와 함께 거절한다", async () => {
    const legacy = Buffer.concat([Buffer.from("d0cf11e0a1b11ae1", "hex"), Buffer.alloc(64)]);
    await expect(extractTemplateText(legacy)).rejects.toThrow(/hwpx|PDF/);
    await expect(extractTemplateText(legacy)).rejects.toBeInstanceOf(TemplateFileError);
  });
  it("알 수 없는 파일은 거절한다", async () => {
    expect(await detectKind(Buffer.from("hello world"))).toBe("unknown");
    await expect(extractTemplateText(Buffer.from("hello world"))).rejects.toThrow(/지원하지 않는/);
  });
});

import { extractSourceText, plainText } from "./templateFile";
describe("작성용 자료 파일 읽기", () => {
  it("txt(UTF-8)를 읽는다", async () => {
    const r = await extractSourceText(Buffer.from("일시: 10월 11일\n장소: 봉담읍 예랑도예원", "utf-8"));
    expect(r.kind).toBe("text");
    expect(r.text).toContain("봉담읍");
  });
  it("EUC-KR로 저장된 txt도 읽는다", () => {
    const euc = Buffer.from([0xc7, 0xd1, 0xb1, 0xdb]); // "한글"
    expect(plainText(euc)).toBe("한글");
  });
  it("이진 파일은 글로 읽지 않는다", async () => {
    expect(plainText(Buffer.from([0x00, 0x01, 0x02, 0x03]))).toBeNull();
    await expect(extractSourceText(Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]))).rejects.toThrow(/지원하지 않는/);
  });
  it("docx도 읽는다", async () => {
    const r = await extractSourceText(await docx());
    expect(r.kind).toBe("docx");
    expect(r.text).toContain("출장지");
  });
});
