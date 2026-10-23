import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { detectKind } from "./templateFile";
import { MAX_LISTED_PARAGRAPHS, type DocEdit, type DocParagraph, type RowOp } from "../shared/docEdit";
import { styleHints } from "../shared/styleHints";

export class DocEditError extends Error {}

type Flavor = { kind: "hwpx" | "docx"; p: string; t: string; tc: string; tr: string; tbl: string };
const HWPX: Flavor = { kind: "hwpx", p: "hp:p", t: "hp:t", tc: "hp:tc", tr: "hp:tr", tbl: "hp:tbl" };
const DOCX: Flavor = { kind: "docx", p: "w:p", t: "w:t", tc: "w:tc", tr: "w:tr", tbl: "w:tbl" };

type Part = { name: string; doc: Document };
type Loaded = { zip: JSZip; flavor: Flavor; parts: Part[] };

async function load(buf: Buffer): Promise<Loaded> {
  const kind = await detectKind(buf);
  if (kind === "legacy") throw new DocEditError("옛 형식(.hwp 등)의 파일이라 고칠 수 없습니다. 파일 이름이 .hwpx여도 확장자만 바꾼 파일이면 이 오류가 납니다. 한글에서 파일을 연 뒤 '다른 이름으로 저장'에서 파일 형식을 '한글 문서(*.hwpx)'로 골라 저장해 주세요.");
  if (kind !== "hwpx" && kind !== "docx") throw new DocEditError("hwpx 또는 docx 파일만 고칠 수 있습니다.");
  const zip = await JSZip.loadAsync(buf);
  const flavor = kind === "hwpx" ? HWPX : DOCX;
  const names = kind === "hwpx"
    ? zip.file(/^Contents\/section\d+\.xml$/i).map((f) => f.name).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    : ["word/document.xml"];
  const parts: Part[] = [];
  for (const name of names) {
    const xml = await zip.file(name)!.async("string");
    parts.push({ name, doc: new DOMParser().parseFromString(xml, "text/xml") as unknown as Document });
  }
  return { zip, flavor, parts };
}

const elementChildren = (n: Node): Element[] => Array.from(n.childNodes as any).filter((c: any) => c.nodeType === 1) as Element[];
const all = (doc: Document | Element, tag: string): Element[] => Array.from((doc as any).getElementsByTagName(tag));

/** el에서 위로 올라가며 가장 가까운 tag 조상 */
function ancestor(el: Node, tag: string): Element | null {
  let n: Node | null = el.parentNode;
  while (n) { if ((n as Element).nodeName === tag) return n as Element; n = n.parentNode; }
  return null;
}

/** 이 문단에 직접 속한 글 요소(안쪽 문단·표의 글은 제외) */
const ownTexts = (p: Element, f: Flavor) => all(p, f.t).filter((t) => ancestor(t, f.p) === p);
const textOf = (t: Element) => Array.from(t.childNodes as any).filter((c: any) => c.nodeType === 3 || c.nodeType === 4).map((c: any) => c.nodeValue).join("");
const hasNestedP = (p: Element, f: Flavor) => all(p, f.p).length > 0;

type ParaRef = { id: number; el: Element; part: Part };

/** 문서 전체의 표(안쪽 표 포함)를 나오는 순서대로 */
const tablesOf = (l: Loaded): Element[] => l.parts.flatMap((p) => all(p.doc, l.flavor.tbl));

function collect(l: Loaded): { refs: ParaRef[]; paragraphs: DocParagraph[] } {
  const f = l.flavor;
  const refs: ParaRef[] = [];
  const paragraphs: DocParagraph[] = [];
  let id = 0;
  const tbls = tablesOf(l);
  for (const part of l.parts) {
    for (const el of all(part.doc, f.p)) {
      const myId = id++;
      refs.push({ id: myId, el, part });
      const text = ownTexts(el, f).map(textOf).join("");
      const tc = ancestor(el, f.tc);
      let cell: DocParagraph["cell"];
      if (tc) {
        const tr = ancestor(tc, f.tr);
        const tbl = tr ? ancestor(tr, f.tbl) : null;
        if (tr && tbl) {
          const row = elementChildren(tbl).filter((e) => e.nodeName === f.tr).indexOf(tr);
          const addr = elementChildren(tc).find((e) => e.nodeName === "hp:cellAddr");
          const col = addr ? Number(addr.getAttribute("colAddr")) : elementChildren(tr).filter((e) => e.nodeName === f.tc).indexOf(tc);
          const r = addr && addr.getAttribute("rowAddr") != null ? Number(addr.getAttribute("rowAddr")) : row;
          cell = { t: tbls.indexOf(tbl), r: Number.isFinite(r) ? r : row, c: Number.isFinite(col) ? col : 0 };
        }
      }
      const leaf = !hasNestedP(el, f);
      if (text.trim() || (cell && leaf)) paragraphs.push({ id: myId, text, cell });
    }
  }
  return { refs, paragraphs };
}

export async function listParagraphs(buf: Buffer): Promise<{ kind: "hwpx" | "docx"; paragraphs: DocParagraph[]; truncated: boolean }> {
  const l = await load(buf);
  const { paragraphs } = collect(l);
  return { kind: l.flavor.kind, paragraphs: paragraphs.slice(0, MAX_LISTED_PARAGRAPHS), truncated: paragraphs.length > MAX_LISTED_PARAGRAPHS };
}

function setText(p: Element, text: string, f: Flavor) {
  const doc = p.ownerDocument!;
  const ts = ownTexts(p, f);
  const put = (t: Element) => {
    while (t.firstChild) t.removeChild(t.firstChild);
    t.appendChild(doc.createTextNode(text));
    if (f.kind === "docx") t.setAttribute("xml:space", "preserve");
  };
  if (ts.length) {
    put(ts[0]);
    for (const t of ts.slice(1)) while (t.firstChild) t.removeChild(t.firstChild);
  } else {
    // 비어 있는 문단: 글자 서식은 같은 문단의 첫 run을 따른다
    const run = elementChildren(p).find((e) => e.nodeName === (f.kind === "hwpx" ? "hp:run" : "w:r"));
    const newRun = run ? (run.cloneNode(false) as Element) : doc.createElement(f.kind === "hwpx" ? "hp:run" : "w:r");
    if (!run && f.kind === "hwpx") newRun.setAttribute("charPrIDRef", "0");
    const t = doc.createElement(f.t);
    put(t);
    newRun.appendChild(t);
    const seg = elementChildren(p).find((e) => e.nodeName === "hp:linesegarray");
    if (seg) p.insertBefore(newRun, seg); else p.appendChild(newRun);
  }
  // 줄 배치 캐시는 한글이 다시 계산하도록 지운다
  for (const seg of elementChildren(p).filter((e) => e.nodeName === "hp:linesegarray")) p.removeChild(seg);
}


// ─── 표 행 추가·삭제 ───────────────────────────────────────────────────────────
const attrNum = (el: Element | undefined, a: string, d: number) => {
  const v = el?.getAttribute(a);
  const n = v == null || v === "" ? NaN : Number(v);
  return Number.isFinite(n) ? n : d;
};
const childOf = (el: Element, name: string) => elementChildren(el).find((e) => e.nodeName === name);

type HCell = { tc: Element; tr: Element; col: number; row: number; cs: number; rs: number; addr?: Element; span?: Element; h: number };
function hwpxCells(tbl: Element): HCell[] {
  const out: HCell[] = [];
  elementChildren(tbl).filter((e) => e.nodeName === "hp:tr").forEach((tr, ti) => {
    elementChildren(tr).filter((e) => e.nodeName === "hp:tc").forEach((tc, ci) => {
      const addr = childOf(tc, "hp:cellAddr"), span = childOf(tc, "hp:cellSpan"), sz = childOf(tc, "hp:cellSz");
      out.push({ tc, tr, addr, span, col: attrNum(addr, "colAddr", ci), row: attrNum(addr, "rowAddr", ti), cs: attrNum(span, "colSpan", 1), rs: attrNum(span, "rowSpan", 1), h: attrNum(sz, "height", 0) });
    });
  });
  return out;
}
const bumpTblHeight = (tbl: Element, delta: number) => {
  const sz = childOf(tbl, "hp:sz");
  const h = attrNum(sz, "height", 0);
  if (sz && h > 0 && delta) sz.setAttribute("height", String(Math.max(0, h + delta)));
};

/** 칸 안의 글을 한 문단으로 만들어 text를 넣는다(서식은 첫 문단·첫 run을 따른다) */
function setCellText(tc: Element, text: string, f: Flavor) {
  const ps = all(tc, f.p).filter((p) => ancestor(p, f.tc) === tc && !hasNestedP(p, f));
  if (!ps.length) return;
  for (const extra of ps.slice(1)) extra.parentNode?.removeChild(extra);
  setText(ps[0], text, f);
}

function deleteRowHwpx(tbl: Element, d: number): string | null {
  const cells = hwpxCells(tbl);
  const inRow = cells.filter((c) => c.row === d);
  const total = Math.max(0, ...cells.map((c) => c.row + c.rs));
  if (!inRow.length) return "그 행을 찾지 못해 지우지 못했습니다.";
  if (d < 1 || total <= 2) return "머리글 행이거나 표에 행이 얼마 남지 않아 지우지 않았습니다.";
  if (inRow.some((c) => c.rs > 1)) return "다른 행과 합쳐진 칸이 있어 지우지 않았습니다. 한글에서 직접 지워 주세요.";
  for (const c of cells) {
    if (c.row < d && c.row + c.rs > d) c.span?.setAttribute("rowSpan", String(c.rs - 1));
    else if (c.row > d) c.addr?.setAttribute("rowAddr", String(c.row - 1));
  }
  const h = Math.min(...inRow.map((c) => c.h || Infinity));
  inRow[0].tr.parentNode!.removeChild(inRow[0].tr);
  tbl.setAttribute("rowCnt", String(Math.max(1, attrNum(tbl as Element, "rowCnt", total) - 1)));
  if (Number.isFinite(h)) bumpTblHeight(tbl, -h);
  return null;
}

function insertRowsHwpx(tbl: Element, after: number, rows: string[][], f: Flavor): string | null {
  for (let k = 0; k < rows.length; k++) {
    const A = after + k;
    const cells = hwpxCells(tbl);
    const singles = cells.filter((c) => c.row === A && c.rs === 1).sort((a, b) => a.col - b.col);
    if (!singles.length) return "그 행을 찾지 못해 행을 추가하지 못했습니다.";
    for (const c of cells) {
      if (c.row > A) c.addr?.setAttribute("rowAddr", String(c.row + 1));
      else if (c.rs > 1 && c.row <= A && A < c.row + c.rs) c.span?.setAttribute("rowSpan", String(c.rs + 1));
    }
    const newTr = singles[0].tr.cloneNode(false) as Element;
    for (const src of singles) {
      const clone = src.tc.cloneNode(true) as Element;
      childOf(clone, "hp:cellAddr")?.setAttribute("rowAddr", String(A + 1));
      childOf(clone, "hp:cellSpan")?.setAttribute("rowSpan", "1");
      setCellText(clone, rows[k][src.col] ?? "", f);
      newTr.appendChild(clone);
    }
    singles[0].tr.parentNode!.insertBefore(newTr, singles[0].tr.nextSibling);
    tbl.setAttribute("rowCnt", String(attrNum(tbl, "rowCnt", cells.length) + 1));
    const h = Math.min(...singles.map((c) => c.h || Infinity));
    if (Number.isFinite(h)) bumpTblHeight(tbl, h);
  }
  return null;
}

const docxRows = (tbl: Element) => elementChildren(tbl).filter((e) => e.nodeName === "w:tr");
const docxMerged = (tr: Element) => all(tr, "w:vMerge").length > 0;

function deleteRowDocx(tbl: Element, d: number): string | null {
  const rows = docxRows(tbl);
  if (d < 1 || d >= rows.length || rows.length <= 2) return "머리글 행이거나 표에 행이 얼마 남지 않아 지우지 않았습니다.";
  if (docxMerged(rows[d])) return "다른 행과 합쳐진 칸이 있어 지우지 않았습니다. 워드에서 직접 지워 주세요.";
  tbl.removeChild(rows[d]);
  return null;
}

function insertRowsDocx(tbl: Element, after: number, rows: string[][], f: Flavor): string | null {
  const tpl = docxRows(tbl)[after];
  if (!tpl) return "그 행을 찾지 못해 행을 추가하지 못했습니다.";
  if (docxMerged(tpl)) return "다른 행과 합쳐진 칸이 있어 행을 추가하지 않았습니다. 워드에서 직접 추가해 주세요.";
  let prev = tpl;
  for (const cells of rows) {
    const clone = tpl.cloneNode(true) as Element;
    elementChildren(clone).filter((e) => e.nodeName === "w:tc").forEach((tc, ci) => setCellText(tc, cells[ci] ?? "", f));
    tbl.insertBefore(clone, prev.nextSibling);
    prev = clone;
  }
  return null;
}

/** 표 행 작업을 적용한다. 아래쪽 행부터 처리해 번호가 어긋나지 않게 하고, 못 한 작업은 이유를 돌려준다. */
function applyRowOps(l: Loaded, rowOps: RowOp[]): { done: number; skipped: string[] } {
  const tbls = tablesOf(l);
  const anchor = (o: RowOp) => (o.op === "insert" ? o.after : o.row);
  const ops = [...rowOps].sort((a, b) => a.t - b.t || anchor(b) - anchor(a) || (a.op === "insert" ? -1 : 1) - (b.op === "insert" ? -1 : 1));
  let done = 0;
  const skipped: string[] = [];
  for (const o of ops) {
    const tbl = tbls[o.t];
    const label = `표${o.t + 1} ${anchor(o) + 1}행`;
    if (!tbl) { skipped.push(`${label}: 표를 찾지 못했습니다.`); continue; }
    const hwpx = l.flavor.kind === "hwpx";
    const err = o.op === "delete"
      ? (hwpx ? deleteRowHwpx(tbl, o.row) : deleteRowDocx(tbl, o.row))
      : (hwpx ? insertRowsHwpx(tbl, o.after, o.rows, l.flavor) : insertRowsDocx(tbl, o.after, o.rows, l.flavor));
    if (err) skipped.push(`${label}: ${err}`); else done++;
  }
  return { done, skipped };
}

const MARK = "[-–—·•○●◦ㅇ※*▪■□◆◇▶▷]";
const AFTER_MARK = "(?=\\s|[가-힣A-Za-z(\\[])"; // "-500" 같은 숫자는 기호로 보지 않는다

/** 새 글을 원래 문단의 모양에 맞춘다: 겹친 글머리 기호 정리, 원래 있던 기호 유지/원래 없던 기호 제거, 줄바꿈 제거 */
export function tidyEditText(original: string, next: string): string {
  let t = next.replace(/[\r\n\u2028\u2029]+/g, " ").replace(/[ \t\u00a0]{2,}/g, " ").trim();
  if (!t || /^\(?\s*빈\s*칸\s*\)?$/.test(t)) return "";
  // "- - 글" → "- 글"
  t = t.replace(new RegExp(`^(${MARK})${AFTER_MARK}\\s*(?:\\1\\s*)+`), "$1 ");
  const om = original.match(new RegExp(`^\\s*(${MARK})${AFTER_MARK}(\\s*)`));
  const nm = t.match(new RegExp(`^(${MARK})${AFTER_MARK}\\s*`));
  if (om && !nm) t = `${om[1]}${om[2] || " "}${t}`;
  else if (!om && nm && original.trim()) t = t.slice(nm[0].length);
  else if (om && nm) t = `${om[1]}${om[2] || " "}${t.slice(nm[0].length)}`;
  return t;
}

export async function applyEdits(buf: Buffer, edits: DocEdit[], rowOps: RowOp[] = []): Promise<{ data: Buffer; changed: number; skipped: string[] }> {
  const l = await load(buf);
  const { refs } = collect(l);
  const byId = new Map(refs.map((r) => [r.id, r]));
  let changed = 0;
  for (const e of edits) {
    const ref = byId.get(e.id);
    if (!ref) continue;
    const orig = ownTexts(ref.el, l.flavor).map(textOf).join("");
    if (e.text !== undefined) { setText(ref.el, tidyEditText(orig, e.text), l.flavor); changed++; }
    if (e.after && !hasNestedP(ref.el, l.flavor)) {
      const clone = ref.el.cloneNode(true) as Element;
      setText(clone, tidyEditText(e.text !== undefined ? tidyEditText(orig, e.text) : orig, e.after), l.flavor);
      ref.el.parentNode!.insertBefore(clone, ref.el.nextSibling);
      changed++;
    }
  }
  const rowRes = rowOps.length ? applyRowOps(l, rowOps) : { done: 0, skipped: [] as string[] };
  changed += rowRes.done;
  const ser = new XMLSerializer();
  for (const part of l.parts) {
    let xml = ser.serializeToString(part.doc as any);
    if (!/^<\?xml/i.test(xml)) xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + xml;
    l.zip.file(part.name, xml);
  }
  if (l.flavor.kind === "hwpx" && l.zip.file("mimetype")) {
    l.zip.file("mimetype", await l.zip.file("mimetype")!.async("string"), { compression: "STORE" });
  }
  const data = await l.zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  return { data, changed, skipped: rowRes.skipped };
}

export const EDIT_SYSTEM = `당신은 복지기관 행정 문서를 고쳐 쓰는 도우미입니다. 기존 문서(예: 작년 계획서)의 문단 목록과 사용자의 지시를 보고, 올해 내용으로 바뀌어야 하는 문단만 골라 새 글로 바꿉니다. 문서의 서식·표는 그대로 두고 글자만 바꿉니다.

문단 목록 형식: [번호] (위치) 글  — 위치는 '본문' 또는 '표N R행 C열'입니다. '(빈칸)'은 비어 있는 표 칸입니다.

규칙:
1. 지시에 적힌 사실(날짜·시간·순서·사람·이름·금액)은 그대로 반영합니다. 지시와 참고 파일·기존 문서가 다르면 지시를 따릅니다.
2. 기존 문서에 있는 지난해 정보(연도, 날짜, 요일, 인원, 금액, 장소, 이름, 회차)는 빠짐없이 새 내용에 맞게 고칩니다. 같은 정보가 여러 곳에 나오면 모두 고칩니다.
3. 바꿀 필요가 없는 문단은 edits에 넣지 않습니다. 문서 전체를 다시 쓰지 않습니다.
4. 표: 칸의 글을 바꾸고, 항목 수가 달라지면 행을 늘리거나 줄입니다. 쓸 내용이 없어진 행은 빈 채로 두지 말고 tableOps의 delete로 지웁니다. 항목이 모자라면 insert로 행을 추가합니다(바로 위 행과 같은 모양으로 복사되고, rows에 열 순서대로 칸 글을 적습니다. 1열부터 차례로 적고, 위 칸과 합쳐져 칸이 없는 열은 ""로 둡니다). 번호는 목록의 '표N R행'의 N, R을 그대로 씁니다(1부터). 머리글(맨 윗줄)과 '계·합계' 행은 지우지 않습니다. 순서·일정 표와 예산 표는 새 항목 수에 맞춰 행 수를 조정합니다. 칸이 비어 있다는 표시 "(빈칸)"을 글로 쓰지 않습니다.
5. 금액은 정확히 계산합니다. '합계' 칸은 항목 합과 정확히 같아야 하고, 지시에 총액과 일부 항목이 주어지면 나머지는 총액에서 빼서 구합니다. 금액 칸에는 "3,965,000"처럼 숫자와 쉼표만 씁니다(단위가 칸에 이미 있으면 그대로 유지).
6. 새로 쓰거나 바꾸는 모든 글은 이 문서에 이미 있는 글을 그대로 따라 씁니다. 같은 자리(같은 표의 다른 칸, 앞뒤 문단)의 글과 말투(예: "~함", "~예정")·글머리·번호 기호(○, -, 1., 가. 등)·날짜·시간·금액 표기·문장 길이·띄어쓰기를 똑같이 맞춥니다. 기존 문장을 최대한 살리고 바뀐 사실만 고쳐 씁니다. "after"로 추가하는 문단은 바로 앞 문단의 모양을 복사한 듯이 씁니다. 목록 끝의 "[문서의 말투·형식 관찰]"이 있으면 반드시 따릅니다. 마크다운 기호는 쓰지 않고, 한 문단에 줄바꿈을 넣지 않습니다.
7. 표는 칸의 머리글(맨 윗줄의 제목)에 맞는 내용만 그 칸에 씁니다. 예) '비고·담당' 칸에는 사람 이름·역할만, '세부내용' 칸에는 할 일만 쓰고 서로 섞지 않습니다. 한 칸에는 한 가지 항목만 한 줄로 짧게 쓰고, 같은 칸을 원래 줄 수보다 늘리지 않습니다(늘려야 하면 그 이유를 notes에 적습니다). 글머리 기호("- " 등)는 원래 문단에 있던 것을 한 번만 씁니다. 기호가 없던 문단에는 붙이지 않습니다.
8. 모르는 정보는 지어내지 않고 "[확인 필요]"라고 쓰고 notes에 적습니다. 개인정보(전화번호 등)는 쓰지 않습니다.

JSON만 출력:
{"edits":[{"id":12,"text":"고친 글"},{"id":30,"after":"이 문단 바로 뒤에 추가할 문단"}],"tableOps":[{"op":"insert","table":2,"after":5,"rows":[["1열 글","2열 글","3열 글"]]},{"op":"delete","table":2,"row":8}],"notes":["확인이 필요한 점·가정한 내용"]}
tableOps가 필요 없으면 빈 배열로 둡니다.`;

export function buildEditUser(p: {
  instruction: string;
  history: { role: "user" | "assistant"; text: string }[];
  sources: { name: string; text: string }[];
  paragraphs: DocParagraph[];
  fix?: string[];
  prevEdits?: unknown;
}): string {
  const cellTxt = (c?: DocParagraph["cell"]) => (c ? `표${c.t + 1} ${c.r + 1}행 ${c.c + 1}열` : "본문");
  const list = p.paragraphs.map((x) => `[${x.id}] (${cellTxt(x.cell)}) ${x.text.trim() ? x.text.slice(0, 400) : "(빈칸)"}`).join("\n");
  const parts: string[] = [];
  if (p.sources.length) parts.push("[참고 파일]\n" + p.sources.map((s, i) => `### 파일 ${i + 1}: ${s.name}\n${s.text}`).join("\n\n"));
  if (p.history.length) parts.push("[이전 대화]\n" + p.history.slice(-6).map((h) => `${h.role === "user" ? "사용자" : "도우미"}: ${h.text.slice(0, 1200)}`).join("\n"));
  parts.push(`[고칠 문서의 문단 목록]\n${list}`);
  const hints = styleHints(p.paragraphs.map((x) => x.text));
  if (hints) parts.push(`[문서의 말투·형식 관찰]\n${hints}`);
  if (p.fix?.length) parts.push("[이전에 낸 edits]\n" + JSON.stringify(p.prevEdits ?? []) + "\n\n[바로잡을 점]\n" + p.fix.join("\n") + "\n위 계산 오류를 고쳐서 같은 형식의 JSON으로 다시 출력하세요(이전 edits 전체를 포함).");
  parts.push(`[이번 지시]\n${p.instruction}`);
  return parts.join("\n\n");
}
