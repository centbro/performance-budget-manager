import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { detectKind } from "./templateFile";
import { MAX_LISTED_PARAGRAPHS, type DocEdit, type DocParagraph } from "../shared/docEdit";
import { styleHints } from "../shared/styleHints";

export class DocEditError extends Error {}

type Flavor = { kind: "hwpx" | "docx"; p: string; t: string; tc: string; tr: string; tbl: string };
const HWPX: Flavor = { kind: "hwpx", p: "hp:p", t: "hp:t", tc: "hp:tc", tr: "hp:tr", tbl: "hp:tbl" };
const DOCX: Flavor = { kind: "docx", p: "w:p", t: "w:t", tc: "w:tc", tr: "w:tr", tbl: "w:tbl" };

type Part = { name: string; doc: Document };
type Loaded = { zip: JSZip; flavor: Flavor; parts: Part[] };

async function load(buf: Buffer): Promise<Loaded> {
  const kind = await detectKind(buf);
  if (kind === "legacy") throw new DocEditError("옛 한글(.hwp) 파일은 직접 고칠 수 없습니다. 한글에서 hwpx로 다시 저장해 주세요.");
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

function collect(l: Loaded): { refs: ParaRef[]; paragraphs: DocParagraph[] } {
  const f = l.flavor;
  const refs: ParaRef[] = [];
  const paragraphs: DocParagraph[] = [];
  let id = 0;
  for (const part of l.parts) {
    const tbls = all(part.doc, f.tbl);
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

export async function applyEdits(buf: Buffer, edits: DocEdit[]): Promise<{ data: Buffer; changed: number }> {
  const l = await load(buf);
  const { refs } = collect(l);
  const byId = new Map(refs.map((r) => [r.id, r]));
  let changed = 0;
  for (const e of edits) {
    const ref = byId.get(e.id);
    if (!ref) continue;
    if (e.text !== undefined) { setText(ref.el, e.text, l.flavor); changed++; }
    if (e.after && !hasNestedP(ref.el, l.flavor)) {
      const clone = ref.el.cloneNode(true) as Element;
      setText(clone, e.after, l.flavor);
      ref.el.parentNode!.insertBefore(clone, ref.el.nextSibling);
      changed++;
    }
  }
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
  return { data, changed };
}

export const EDIT_SYSTEM = `당신은 복지기관 행정 문서를 고쳐 쓰는 도우미입니다. 기존 문서(예: 작년 계획서)의 문단 목록과 사용자의 지시를 보고, 올해 내용으로 바뀌어야 하는 문단만 골라 새 글로 바꿉니다. 문서의 서식·표는 그대로 두고 글자만 바꿉니다.

문단 목록 형식: [번호] (위치) 글  — 위치는 '본문' 또는 '표N R행 C열'입니다. '(빈칸)'은 비어 있는 표 칸입니다.

규칙:
1. 지시에 적힌 사실(날짜·시간·순서·사람·이름·금액)은 그대로 반영합니다. 지시와 참고 파일·기존 문서가 다르면 지시를 따릅니다.
2. 기존 문서에 있는 지난해 정보(연도, 날짜, 요일, 인원, 금액, 장소, 이름, 회차)는 빠짐없이 새 내용에 맞게 고칩니다. 같은 정보가 여러 곳에 나오면 모두 고칩니다.
3. 바꿀 필요가 없는 문단은 edits에 넣지 않습니다. 문서 전체를 다시 쓰지 않습니다.
4. 표의 행·칸 수는 바꿀 수 없습니다. 칸에 맞춰 글을 바꾸고, 칸을 더 채워야 하면 그 문단에 "after"로 줄을 추가합니다. 쓸 내용이 없는 칸은 text를 ""(빈 글)로 합니다. 순서·일정 표는 행 수에 맞춰 내용을 배치합니다.
5. 금액은 정확히 계산합니다. '합계' 칸은 항목 합과 정확히 같아야 하고, 지시에 총액과 일부 항목이 주어지면 나머지는 총액에서 빼서 구합니다. 금액 칸에는 "3,965,000"처럼 숫자와 쉼표만 씁니다(단위가 칸에 이미 있으면 그대로 유지).
6. 새로 쓰거나 바꾸는 모든 글은 이 문서에 이미 있는 글을 그대로 따라 씁니다. 같은 자리(같은 표의 다른 칸, 앞뒤 문단)의 글과 말투(예: "~함", "~예정")·글머리·번호 기호(○, -, 1., 가. 등)·날짜·시간·금액 표기·문장 길이·띄어쓰기를 똑같이 맞춥니다. 기존 문장을 최대한 살리고 바뀐 사실만 고쳐 씁니다. "after"로 추가하는 문단은 바로 앞 문단의 모양을 복사한 듯이 씁니다. 목록 끝의 "[문서의 말투·형식 관찰]"이 있으면 반드시 따릅니다. 마크다운 기호는 쓰지 않고, 한 문단에 줄바꿈을 넣지 않습니다.
7. 모르는 정보는 지어내지 않고 "[확인 필요]"라고 쓰고 notes에 적습니다. 개인정보(전화번호 등)는 쓰지 않습니다.

JSON만 출력:
{"edits":[{"id":12,"text":"고친 글"},{"id":30,"after":"이 문단 바로 뒤에 추가할 문단"}],"notes":["확인이 필요한 점·가정한 내용"]}`;

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
