import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { checkFormFile, cleanFormName, DocFormError, MAX_DOC_FORM_BYTES } from "./docFormDb";

const zipWith = async (files: Record<string, string>) => {
  const z = new JSZip();
  for (const [k, v] of Object.entries(files)) z.file(k, v);
  return z.generateAsync({ type: "nodebuffer" });
};

describe("자주 쓰는 문서 저장 검사", () => {
  it("hwpx·docx만 받는다", async () => {
    expect(await checkFormFile(await zipWith({ "Contents/section0.xml": "<a/>" }))).toBe("hwpx");
    expect(await checkFormFile(await zipWith({ "word/document.xml": "<a/>" }))).toBe("docx");
  });
  it("옛 .hwp(이름만 hwpx)·엑셀·아무 파일은 거절한다", async () => {
    const ole = Buffer.concat([Buffer.from("d0cf11e0a1b11ae1", "hex"), Buffer.alloc(64)]);
    await expect(checkFormFile(ole)).rejects.toThrow(/옛 \.hwp/);
    await expect(checkFormFile(await zipWith({ "xl/workbook.xml": "<a/>" }))).rejects.toBeInstanceOf(DocFormError);
    await expect(checkFormFile(Buffer.from("hello"))).rejects.toThrow(/hwpx 또는 docx/);
  });
  it("3MB를 넘으면 거절한다", async () => {
    await expect(checkFormFile(Buffer.alloc(MAX_DOC_FORM_BYTES + 1))).rejects.toThrow(/3MB/);
  });
  it("이름에서 경로 문자를 없애고 100자로 자른다", () => {
    expect(cleanFormName('  사업/보고회:계획?(안)  ')).toBe("사업 보고회 계획 (안)");
    expect(cleanFormName("가".repeat(300)).length).toBe(100);
  });
});
