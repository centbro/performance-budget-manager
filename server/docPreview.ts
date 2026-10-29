/**
 * hwpx 미리보기: 문서 구조(문단·표·칸 병합·테두리·글자 크기)를 읽어 HTML로 그린다.
 * 한컴으로 연 모습과 똑같지는 않다(글꼴·줄 나눔이 조금 다를 수 있음). 어디에 무엇이 들어갔는지 확인하는 용도다.
 * 만드는 HTML은 인라인 스타일만 쓰고, 문서에서 온 글·값은 모두 이스케이프하거나 숫자·색상 형식만 허용한다.
 */
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import { detectKind } from "./templateFile";
import { DocEditError } from "./docEdit";

const U = 75; // HWPUNIT(1/7200인치) → 96dpi 화면 픽셀
const MAX_DEPTH = 4;
const FONT = "'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif";

const kids = (n: Node): Element[] => Array.from(n.childNodes as any).filter((c: any) => c.nodeType === 1) as Element[];
const child = (n: Element, name: string) => kids(n).find((e) => e.nodeName === name);
const all = (n: Element | Document, tag: string): Element[] => Array.from((n as any).getElementsByTagName(tag));
const num = (el: Element | undefined | null, a: string, d: number) => {
  const v = el?.getAttribute(a);
  const n = v == null || v === "" ? NaN : Number(v);
  return Number.isFinite(n) ? n : d;
};
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const color = (c: string | null | undefined, d = "#000000") => (c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : d);
/** 연속 공백(정렬용)은 글꼴과 상관없이 글자 크기의 약 절반 폭으로 그린다. 한글 문서의 공백 폭과 비슷하다. */
const spaced = (text: string) => text.split(/( {2,})/).map((seg) => (/^ {2,}$/.test(seg) ? `<span style="display:inline-block;width:${seg.length * 0.46}em"></span>` : esc(seg))).join("");
const px = (v: number) => `${Math.round((v / U) * 10) / 10}px`;

type CharStyle = { pt: number; bold: boolean; italic: boolean; underline: boolean; color: string };
type ParaStyle = { align: string; line: number; left: number; prev: number; next: number };
type Border = { l: string; r: string; t: string; b: string; bg: string | null };
type Styles = { chars: Map<string, CharStyle>; paras: Map<string, ParaStyle>; borders: Map<string, Border> };

function borderCss(el: Element | undefined): string {
  const type = el?.getAttribute("type") ?? "NONE";
  if (!el || type === "NONE") return "none";
  const mm = parseFloat((el.getAttribute("width") ?? "0.12").replace(/[^\d.]/g, "")) || 0.12;
  const w = Math.max(1, Math.round(mm * 3.78));
  const style = /DASH/.test(type) ? "dashed" : /DOT/.test(type) ? "dotted" : type === "DOUBLE" || type === "DOUBLE_SLIM" ? "double" : "solid";
  return `${style === "double" ? Math.max(3, w) : w}px ${style} ${color(el.getAttribute("color"))}`;
}

function parseStyles(headerXml: string): Styles {
  const doc = new DOMParser().parseFromString(headerXml, "text/xml") as unknown as Document;
  const chars = new Map<string, CharStyle>();
  for (const c of all(doc, "hh:charPr")) {
    const id = c.getAttribute("id");
    if (id == null) continue;
    const ul = child(c, "hh:underline");
    chars.set(id, {
      pt: Math.min(72, Math.max(4, num(c, "height", 1000) / 100)),
      bold: !!child(c, "hh:bold"),
      italic: !!child(c, "hh:italic"),
      underline: !!ul && (ul.getAttribute("type") ?? "NONE") !== "NONE",
      color: color(c.getAttribute("textColor")),
    });
  }
  const paras = new Map<string, ParaStyle>();
  for (const p of all(doc, "hh:paraPr")) {
    const id = p.getAttribute("id");
    if (id == null) continue;
    const ls = all(p, "hh:lineSpacing")[0];
    const val = (tag: string) => num(all(p, tag)[0], "value", 0);
    paras.set(id, {
      align: p.getElementsByTagName("hh:align")[0]?.getAttribute("horizontal") ?? "JUSTIFY",
      line: ls && (ls.getAttribute("type") ?? "PERCENT") === "PERCENT" ? Math.min(3, Math.max(1, num(ls, "value", 160) / 100)) : 1.6,
      left: Math.max(0, val("hc:left")),
      prev: Math.max(0, val("hc:prev")),
      next: Math.max(0, val("hc:next")),
    });
  }
  const borders = new Map<string, Border>();
  for (const b of all(doc, "hh:borderFill")) {
    const id = b.getAttribute("id");
    if (id == null) continue;
    const face = all(b, "hc:winBrush")[0]?.getAttribute("faceColor");
    borders.set(id, {
      l: borderCss(child(b, "hh:leftBorder")), r: borderCss(child(b, "hh:rightBorder")),
      t: borderCss(child(b, "hh:topBorder")), b: borderCss(child(b, "hh:bottomBorder")),
      bg: face && /^#[0-9a-fA-F]{6}$/.test(face) && face.toLowerCase() !== "#ffffff" ? face : null,
    });
  }
  return { chars, paras, borders };
}

const ALIGN: Record<string, string> = { LEFT: "left", RIGHT: "right", CENTER: "center", JUSTIFY: "justify", DISTRIBUTE: "justify" };

class Renderer {
  constructor(private st: Styles, private marks: Set<string>) {}

  /** 문단 안 글자(run별 서식)를 이어 붙인 글 */
  private runText(run: Element): string {
    let s = "";
    for (const t of kids(run)) {
      if (t.nodeName !== "hp:t") continue;
      for (const n of Array.from(t.childNodes as any) as Node[]) {
        if (n.nodeType === 3 || n.nodeType === 4) s += n.nodeValue ?? "";
        else if (n.nodeName === "hp:tab") s += "    ";
        else if (n.nodeName === "hp:lineBreak") s += "\n";
      }
    }
    return s;
  }

  paragraph(p: Element, depth: number): string {
    const runs = kids(p).filter((e) => e.nodeName === "hp:run");
    const ps = this.st.paras.get(p.getAttribute("paraPrIDRef") ?? "") ?? { align: "JUSTIFY", line: 1.6, left: 0, prev: 0, next: 0 };
    const full = runs.map((r) => this.runText(r)).join("");
    const hl = full.trim() !== "" && this.marks.has(full.trim());
    const firstCs = this.st.chars.get(runs[0]?.getAttribute("charPrIDRef") ?? "");
    const parts: string[] = [];
    for (const r of runs) {
      const cs = this.st.chars.get(r.getAttribute("charPrIDRef") ?? "") ?? { pt: 10, bold: false, italic: false, underline: false, color: "#000000" };
      const text = this.runText(r);
      if (text) {
        const style = `font-size:${cs.pt}pt;color:${cs.color};${cs.bold ? "font-weight:bold;" : ""}${cs.italic ? "font-style:italic;" : ""}${cs.underline ? "text-decoration:underline;" : ""}${hl ? "background:#fff3a3;" : ""}`;
        parts.push(`<span style="${style}">${spaced(text)}</span>`);
      }
      for (const t of kids(r)) if (t.nodeName === "hp:tbl" && depth < MAX_DEPTH) { parts.push(this.table(t, depth + 1)); }
    }
    const fs = firstCs?.pt ?? 10;
    const empty = !parts.length;
    const style = `text-align:${ALIGN[ps.align] ?? "justify"};line-height:${ps.line};${/^ {10,}/.test(full) ? "white-space:pre;" : "white-space:pre-wrap;word-break:break-all;"}margin:${px(ps.prev)} 0 ${px(ps.next)} 0;${ps.left ? `padding-left:${px(ps.left)};` : ""}${empty ? `min-height:${(fs * ps.line).toFixed(1)}pt;font-size:${fs}pt;` : ""}`;
    return `<div style="${style}">${empty ? "&nbsp;" : parts.join("")}</div>`;
  }

  /** 표: 열 너비는 한 칸짜리 칸에서 읽고, 합친 칸에서 나머지를 계산한다 */
  table(tbl: Element, depth: number): string {
    type Cell = { tc: Element; col: number; row: number; cs: number; rs: number; w: number; h: number };
    const rows = kids(tbl).filter((e) => e.nodeName === "hp:tr");
    const cells: Cell[][] = rows.map((tr) => kids(tr).filter((e) => e.nodeName === "hp:tc").map((tc) => {
      const addr = child(tc, "hp:cellAddr"), span = child(tc, "hp:cellSpan"), sz = child(tc, "hp:cellSz");
      return { tc, col: num(addr, "colAddr", 0), row: num(addr, "rowAddr", 0), cs: Math.max(1, num(span, "colSpan", 1)), rs: Math.max(1, num(span, "rowSpan", 1)), w: num(sz, "width", 0), h: num(sz, "height", 0) };
    }));
    const flat = cells.flat();
    const colCnt = Math.max(num(tbl, "colCnt", 0), ...flat.map((c) => c.col + c.cs));
    const widths: number[] = Array(colCnt).fill(0);
    for (const c of flat) if (c.cs === 1) widths[c.col] = Math.max(widths[c.col], c.w);
    for (let pass = 0; pass < colCnt; pass++) {
      let progressed = false;
      for (const c of flat) {
        if (c.cs < 2) continue;
        const idx = Array.from({ length: c.cs }, (_, i) => c.col + i);
        const unknown = idx.filter((i) => widths[i] <= 0);
        if (unknown.length === 1) { widths[unknown[0]] = Math.max(0, c.w - idx.reduce((a, i) => a + widths[i], 0)); progressed = true; }
      }
      if (!progressed) break;
    }
    const tblW = num(child(tbl, "hp:sz"), "width", widths.reduce((a, b) => a + b, 0));
    const known = widths.reduce((a, b) => a + b, 0), zero = widths.filter((w) => w <= 0).length;
    const fill = zero ? Math.max(tblW - known, zero * 1000) / zero : 0;
    const cols = widths.map((w) => (w > 0 ? w : fill));
    const total = cols.reduce((a, b) => a + b, 0) || tblW;
    const inM = child(tbl, "hp:inMargin");
    const trs = rows.map((_, ri) => {
      const rowH = Math.max(0, ...cells[ri].filter((c) => c.rs === 1).map((c) => c.h));
      const tds = cells[ri].map((c) => {
        const bf = this.st.borders.get(c.tc.getAttribute("borderFillIDRef") ?? "") ?? { l: "none", r: "none", t: "none", b: "none", bg: null };
        const mg = child(c.tc, "hp:cellMargin");
        const m = (a: string) => num(mg, a, num(inM, a, 141));
        const sub = child(c.tc, "hp:subList");
        const va = (sub?.getAttribute("vertAlign") ?? "CENTER").toLowerCase();
        const inner = sub ? kids(sub).filter((e) => e.nodeName === "hp:p").map((p) => this.paragraph(p, depth)).join("") : "";
        return `<td colspan="${c.cs}" rowspan="${c.rs}" style="border-left:${bf.l};border-right:${bf.r};border-top:${bf.t};border-bottom:${bf.b};${bf.bg ? `background:${bf.bg};` : ""}padding:${px(m("top"))} ${px(m("right"))} ${px(m("bottom"))} ${px(m("left"))};vertical-align:${va === "center" ? "middle" : va === "bottom" ? "bottom" : "top"};overflow:hidden;">${inner}</td>`;
      }).join("");
      return `<tr style="height:${px(rowH)}">${tds}</tr>`;
    }).join("");
    return `<table style="border-collapse:collapse;table-layout:fixed;display:inline-table;vertical-align:top;text-align:left;width:${px(total)};"><colgroup>${cols.map((w) => `<col style="width:${px(w)}">`).join("")}</colgroup>${trs}</table>`;
  }
}

/** 고친 hwpx를 HTML로 그린다. marks에 든 글과 같은 문단은 노랗게 표시한다(이번에 바뀐 곳). */
export async function renderHwpxPreview(buf: Buffer, marks: string[] = []): Promise<{ html: string; width: number }> {
  const kind = await detectKind(buf);
  if (kind !== "hwpx") throw new DocEditError("미리보기는 hwpx 파일만 지원합니다.");
  const zip = await JSZip.loadAsync(buf, { createFolders: false });
  const header = await zip.file("Contents/header.xml")?.async("string");
  if (!header) throw new DocEditError("문서 서식을 찾지 못했습니다.");
  const st = parseStyles(header);
  const names = zip.file(/^Contents\/section\d+\.xml$/i).map((f) => f.name).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const r = new Renderer(st, new Set(marks.map((m) => m.trim()).filter(Boolean)));
  let pageW = 59528, mL = 5102, mR = 5102, mT = 4252, mB = 4252;
  const body: string[] = [];
  for (const name of names) {
    const xml = await zip.file(name)!.async("string");
    const doc = new DOMParser().parseFromString(xml, "text/xml") as unknown as Document;
    const pg = all(doc, "hp:pagePr")[0];
    if (pg && name === names[0]) {
      const mg = child(pg, "hp:margin");
      pageW = num(pg, "width", pageW); mL = num(mg, "left", mL); mR = num(mg, "right", mR); mT = num(mg, "top", mT); mB = num(mg, "bottom", mB);
    }
    const root = doc.documentElement;
    for (const p of kids(root)) if (p.nodeName === "hp:p") body.push(r.paragraph(p, 0));
  }
  const width = Math.round(pageW / U);
  const html = `<div style="box-sizing:border-box;width:${width}px;padding:${px(mT)} ${px(mR)} ${px(mB)} ${px(mL)};background:#fff;color:#000;font-family:${FONT};overflow:hidden;">${body.join("")}</div>`;
  return { html, width };
}
