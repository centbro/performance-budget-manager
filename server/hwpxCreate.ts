import JSZip from "jszip";
import type { DocBlock, GeneratedDoc } from "../shared/docChat";
import { SKELETON_HWPX_B64 } from "./hwpxSkeleton";

/**
 * 대화로 문서 작성의 결과(GeneratedDoc)를 한글(hwpx) 새 문서로 만든다.
 * 한글이 만든 빈 문서 골격(스타일·글꼴·쪽 설정)에 글자 모양·문단 모양·표 테두리를 추가하고 본문을 채운다.
 * 한글 프로그램으로 직접 열어 확인한 것은 아니다(구조·스키마 검사까지만).
 */

const TEXT_WIDTH = 42520; // 골격의 쪽 설정(A4, 좌우 여백 30mm)에서 본문 폭(HWPUNIT)

const esc = (s: string) =>
  s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ─── 헤더에 추가할 모양 ────────────────────────────────────────────
// 글자 모양 id (골격은 0~6 사용)
const CH = { title: 7, h1: 8, h2: 9, body: 10, th: 11, td: 12, caption: 13 } as const;
const CHAR_DEFS: { id: number; height: number; bold: boolean }[] = [
  { id: CH.title, height: 1800, bold: true },
  { id: CH.h1, height: 1400, bold: true },
  { id: CH.h2, height: 1200, bold: true },
  { id: CH.body, height: 1100, bold: false },
  { id: CH.th, height: 1000, bold: true },
  { id: CH.td, height: 1000, bold: false },
  { id: CH.caption, height: 1000, bold: true },
];
// 문단 모양 id (골격은 0~19 사용)
const PA = { title: 20, heading: 21, body: 22, bullet: 23, cellL: 24, cellC: 25, cellR: 26 } as const;
const PARA_DEFS: { id: number; align: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFY"; left: number; intent: number; prev: number; next: number; line: number }[] = [
  { id: PA.title, align: "CENTER", left: 0, intent: 0, prev: 0, next: 1200, line: 150 },
  { id: PA.heading, align: "LEFT", left: 0, intent: 0, prev: 1000, next: 300, line: 150 },
  { id: PA.body, align: "JUSTIFY", left: 0, intent: 0, prev: 0, next: 200, line: 160 },
  { id: PA.bullet, align: "LEFT", left: 1100, intent: -1100, prev: 0, next: 100, line: 160 },
  { id: PA.cellL, align: "LEFT", left: 0, intent: 0, prev: 0, next: 0, line: 140 },
  { id: PA.cellC, align: "CENTER", left: 0, intent: 0, prev: 0, next: 0, line: 140 },
  { id: PA.cellR, align: "RIGHT", left: 0, intent: 0, prev: 0, next: 0, line: 140 },
];
const BF_CELL = 3; // 가는 실선 테두리
const BF_HEAD = 4; // 실선 + 연한 회청색 바탕

function patchHeader(h: string): string {
  const charTpl = h.match(/<hh:charPr id="0"[\s\S]*?<\/hh:charPr>/)?.[0];
  const paraTpl = h.match(/<hh:paraPr id="0"[\s\S]*?<\/hh:paraPr>/)?.[0];
  if (!charTpl || !paraTpl) throw new Error("hwpx 골격의 서식 정보를 읽지 못했습니다.");

  const chars = CHAR_DEFS.map((d) => {
    let x = charTpl.replace(/id="0"/, `id="${d.id}"`).replace(/height="\d+"/, `height="${d.height}"`);
    if (d.bold) x = x.replace(/(<hh:offset [^>]*\/>)/, `$1<hh:bold/>`);
    return x;
  }).join("");

  const paras = PARA_DEFS.map((d) => {
    let x = paraTpl.replace(/id="0"/, `id="${d.id}"`).replace(/horizontal="JUSTIFY"/, `horizontal="${d.align}"`);
    x = x.replace(/<hc:intent value="0"/g, `<hc:intent value="${d.intent}"`).replace(/<hc:left value="0"/g, `<hc:left value="${d.left}"`);
    x = x.replace(/<hc:prev value="0"/g, `<hc:prev value="${d.prev}"`).replace(/<hc:next value="0"/g, `<hc:next value="${d.next}"`);
    x = x.replace(/<hh:lineSpacing type="PERCENT" value="\d+"/g, `<hh:lineSpacing type="PERCENT" value="${d.line}"`);
    return x;
  }).join("");

  const border = (side: string) => `<hh:${side} type="SOLID" width="0.12 mm" color="#000000"/>`;
  const bf = (id: number, fill: string) =>
    `<hh:borderFill id="${id}" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0"><hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/>${["leftBorder", "rightBorder", "topBorder", "bottomBorder"].map(border).join("")}<hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/><hc:fillBrush><hc:winBrush faceColor="${fill}" hatchColor="#999999" alpha="0"/></hc:fillBrush></hh:borderFill>`;

  return h
    .replace(/<hh:borderFills itemCnt="(\d+)">/, (_m, n) => `<hh:borderFills itemCnt="${+n + 2}">`)
    .replace("</hh:borderFills>", bf(BF_CELL, "none") + bf(BF_HEAD, "#E8EDF3") + "</hh:borderFills>")
    .replace(/<hh:charProperties itemCnt="(\d+)">/, (_m, n) => `<hh:charProperties itemCnt="${+n + CHAR_DEFS.length}">`)
    .replace("</hh:charProperties>", chars + "</hh:charProperties>")
    .replace(/<hh:paraProperties itemCnt="(\d+)">/, (_m, n) => `<hh:paraProperties itemCnt="${+n + PARA_DEFS.length}">`)
    .replace("</hh:paraProperties>", paras + "</hh:paraProperties>");
}

// ─── 본문 ────────────────────────────────────────────────────────────
let uid = 0;
const nextId = () => String(++uid);

const run = (cp: number, text: string) => `<hp:run charPrIDRef="${cp}"><hp:t>${esc(text)}</hp:t></hp:run>`;
const para = (pp: number, cp: number, text: string) =>
  `<hp:p id="${nextId()}" paraPrIDRef="${pp}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">${run(cp, text)}</hp:p>`;

const isNumeric = (s: string) => /^[-+]?[\d,]+(\.\d+)?\s*(원|%|명|회|건)?$/.test(s.trim());

function tableXml(headers: string[], rows: string[][]): string {
  const cols = Math.max(1, headers.length);
  const base = Math.floor(TEXT_WIDTH / cols);
  const widths = headers.map((_, i) => (i === cols - 1 ? TEXT_WIDTH - base * (cols - 1) : base));
  const ROW_H = 2200;
  const all = [headers, ...rows.map((r) => headers.map((_, i) => r[i] ?? ""))];

  const trs = all.map((r, ri) => {
    const head = ri === 0;
    const tcs = r.map((t, ci) => {
      const pp = head ? PA.cellC : isNumeric(t) ? PA.cellR : PA.cellL;
      const cp = head ? CH.th : CH.td;
      return `<hp:tc name="" header="${head ? 1 : 0}" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="${head ? BF_HEAD : BF_CELL}">` +
        `<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">` +
        `<hp:p id="${nextId()}" paraPrIDRef="${pp}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">${run(cp, t)}</hp:p></hp:subList>` +
        `<hp:cellAddr colAddr="${ci}" rowAddr="${ri}"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="${widths[ci]}" height="${ROW_H}"/>` +
        `<hp:cellMargin left="510" right="510" top="141" bottom="141"/></hp:tc>`;
    }).join("");
    return `<hp:tr>${tcs}</hp:tr>`;
  }).join("");

  const tbl =
    `<hp:tbl id="${nextId()}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="${all.length}" colCnt="${cols}" cellSpacing="0" borderFillIDRef="${BF_CELL}" noAdjust="0">` +
    `<hp:sz width="${TEXT_WIDTH}" widthRelTo="ABSOLUTE" height="${ROW_H * all.length}" heightRelTo="ABSOLUTE" protect="0"/>` +
    `<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>` +
    `<hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:inMargin left="510" right="510" top="141" bottom="141"/>${trs}</hp:tbl>`;
  return `<hp:p id="${nextId()}" paraPrIDRef="${PA.cellL}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${CH.td}">${tbl}<hp:t/></hp:run></hp:p>`;
}

function blockXml(b: DocBlock): string {
  switch (b.type) {
    case "heading": return para(PA.heading, b.level === 1 ? CH.h1 : CH.h2, b.text);
    case "paragraph": return para(PA.body, CH.body, b.text);
    case "bullets": return b.items.map((t) => para(PA.bullet, CH.body, `○ ${t}`)).join("");
    case "table":
      return (b.caption ? para(PA.bullet, CH.caption, `<${b.caption}>`) : "") + tableXml(b.headers, b.rows) + para(PA.body, CH.body, "");
  }
}

/** GeneratedDoc → hwpx 파일(Buffer) */
export async function buildHwpx(doc: GeneratedDoc): Promise<Buffer> {
  uid = 0;
  const z = await JSZip.loadAsync(Buffer.from(SKELETON_HWPX_B64, "base64"));
  const header = await z.file("Contents/header.xml")!.async("string");
  z.file("Contents/header.xml", patchHeader(header));

  // 골격의 첫 문단(쪽 설정이 들어 있는 문단)을 제목 문단으로 쓴다.
  const sec = await z.file("Contents/section0.xml")!.async("string");
  const first = sec.match(/<hp:p [^>]*>[\s\S]*?<\/hp:p>/)?.[0];
  if (!first) throw new Error("hwpx 골격의 본문을 읽지 못했습니다.");
  const title = first
    .replace(/paraPrIDRef="\d+"/, `paraPrIDRef="${PA.title}"`)
    .replace(/<hp:run charPrIDRef="\d+"><hp:t\/><\/hp:run>/, run(CH.title, doc.title || "문서"))
    .replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/, "");
  const body = doc.blocks.map(blockXml).join("");
  z.file("Contents/section0.xml", sec.replace(first, title + body));

  // 문서 정보·미리보기 글자
  const text = [doc.title, ...doc.blocks.flatMap((b) => (b.type === "heading" || b.type === "paragraph" ? [b.text] : b.type === "bullets" ? b.items : b.rows.map((r) => r.join(" "))))].join("\n").slice(0, 1000);
  z.file("Preview/PrvText.txt", text);
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const hpf = (await z.file("Contents/content.hpf")!.async("string"))
    .replace("<opf:title/>", `<opf:title>${esc(doc.title)}</opf:title>`)
    .replace(/synthetic-fixture-author/g, "복지실무톡")
    .replace(/(name="CreatedDate" content="text">)[^<]*/, `$1${now}`)
    .replace(/(name="ModifiedDate" content="text">)[^<]*/, `$1${now}`);
  z.file("Contents/content.hpf", hpf);

  // mimetype을 맨 앞에, 압축 없이 저장해야 한글이 열 수 있다.
  const out = new JSZip();
  out.file("mimetype", "application/hwp+zip", { compression: "STORE" });
  for (const name of Object.keys(z.files)) {
    if (name === "mimetype" || z.files[name].dir) continue;
    out.file(name, await z.files[name].async("nodebuffer"));
  }
  return out.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
