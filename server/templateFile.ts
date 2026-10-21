import JSZip from "jszip";
import * as XLSX from "xlsx";
import { extractPdfTextFromBuffer } from "./pdfExtract";

export class TemplateFileError extends Error {}

export type TemplateFileKind = "pdf" | "docx" | "hwpx" | "xlsx" | "legacy" | "unknown";

/** 확장자가 아니라 파일 앞부분(매직 바이트)으로 종류를 판별한다. */
export async function detectKind(buf: Buffer): Promise<TemplateFileKind> {
  if (buf.length >= 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (buf.length >= 8 && buf.subarray(0, 8).toString("hex") === "d0cf11e0a1b11ae1") return "legacy"; // hwp, doc, xls
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b) {
    try {
      const zip = await JSZip.loadAsync(buf);
      if (zip.file("word/document.xml")) return "docx";
      if (zip.file(/^Contents\/section\d+\.xml$/i).length > 0) return "hwpx";
      if (zip.file("xl/workbook.xml")) return "xlsx";
    } catch { /* 손상된 압축 파일 */ }
  }
  return "unknown";
}

const decodeXml = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, "&");

/** 문단(<w:p>/<hp:p>) 단위로 줄을 나누고, 표의 칸은 ' | '로 이어 붙인다. */
export function xmlParagraphsToText(xml: string, para: "w:p" | "hp:p", text: "w:t" | "hp:t", cell: "w:tc" | "hp:tc", row: "w:tr" | "hp:tr"): string {
  // 표의 칸 안에서는 문단이 끝나도 줄을 바꾸지 않고 한 줄로 이어 붙인다.
  const inCell = xml.replace(new RegExp(`<${cell}(?:\\s[^>]*)?>[\\s\\S]*?</${cell}>`, "g"), (c) => c.replace(new RegExp(`</${para}>`, "g"), " "));
  const withBreaks = inCell
    .replace(new RegExp(`</${cell}>`, "g"), "\u0001")
    .replace(new RegExp(`</${row}>`, "g"), "\n")
    .replace(new RegExp(`</${para}>`, "g"), "\u0002");
  const out: string[] = [];
  let line = "";
  const re = new RegExp(`<${text}(?:\\s[^>]*)?>([\\s\\S]*?)</${text}>|\u0001|\u0002|\n`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(withBreaks))) {
    if (m[1] !== undefined) line += decodeXml(m[1]);
    else if (m[0] === "\u0001") line += " | ";
    else { if (line.trim()) out.push(line.replace(/\s*\|\s*$/, "").trim()); line = ""; }
  }
  if (line.trim()) out.push(line.trim());
  return out.join("\n");
}

async function docxText(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file("word/document.xml")!.async("string");
  return xmlParagraphsToText(xml, "w:p", "w:t", "w:tc", "w:tr");
}

async function hwpxText(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const files = zip.file(/^Contents\/section\d+\.xml$/i).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const parts: string[] = [];
  for (const f of files) parts.push(xmlParagraphsToText(await f.async("string"), "hp:p", "hp:t", "hp:tc", "hp:tr"));
  return parts.join("\n");
}

function xlsxText(buf: Buffer): string {
  const wb = XLSX.read(buf, { type: "buffer" });
  const parts: string[] = [];
  for (const name of wb.SheetNames.slice(0, 3)) {
    const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" });
    for (const r of rows) {
      const line = r.map((c) => String(c ?? "").trim()).filter(Boolean).join(" | ");
      if (line) parts.push(line);
    }
  }
  return parts.join("\n");
}

/** 서식 파일(PDF·한글 hwpx·워드 docx·엑셀 xlsx)에서 글자를 읽는다. */
export async function extractTemplateText(buf: Buffer): Promise<{ kind: TemplateFileKind; text: string }> {
  const kind = await detectKind(buf);
  switch (kind) {
    case "pdf": return { kind, text: await extractPdfTextFromBuffer(buf) };
    case "docx": return { kind, text: await docxText(buf) };
    case "hwpx": return { kind, text: await hwpxText(buf) };
    case "xlsx": return { kind, text: xlsxText(buf) };
    case "legacy":
      throw new TemplateFileError("예전 형식(.hwp, .doc, .xls) 파일은 읽을 수 없습니다. 한글에서 '다른 이름으로 저장'으로 .hwpx 또는 PDF로 저장해 올려 주세요. (워드는 .docx, 엑셀은 .xlsx)");
    default:
      throw new TemplateFileError("지원하지 않는 파일입니다. PDF, 한글(.hwpx), 워드(.docx), 엑셀(.xlsx) 파일을 올려 주세요.");
  }
}

/** 일반 글 파일(txt·md·csv)인지 확인하고 글자로 바꾼다. UTF-8이 아니면 EUC-KR(한글 메모장 저장)로 시도. */
export function plainText(buf: Buffer): string | null {
  if (buf.length === 0 || buf.includes(0)) return null;
  const u8 = new TextDecoder("utf-8").decode(buf);
  const bad = (u8.match(/\uFFFD/g) ?? []).length;
  if (bad === 0) return u8;
  try {
    const k = new TextDecoder("euc-kr").decode(buf);
    if ((k.match(/\uFFFD/g) ?? []).length < bad) return k;
  } catch { /* 지원하지 않는 환경 */ }
  return bad / Math.max(1, u8.length) < 0.01 ? u8 : null;
}

/** '작성할 내용' 자료 파일(PDF·hwpx·docx·xlsx·txt)에서 글자를 읽는다. */
export async function extractSourceText(buf: Buffer): Promise<{ kind: TemplateFileKind | "text"; text: string }> {
  const kind = await detectKind(buf);
  if (kind === "unknown") {
    const t = plainText(buf);
    if (t !== null) return { kind: "text", text: t };
  }
  return extractTemplateText(buf);
}
