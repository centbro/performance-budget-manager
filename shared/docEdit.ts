/** 기존 문서(hwpx·docx)를 문단 단위로 고쳐 쓰는 기능의 공용 타입·검증 */
import { parseMoney } from "./docChat";

export type CellPos = { t: number; r: number; c: number };
export type DocParagraph = { id: number; text: string; cell?: CellPos };
export type DocEdit = { id: number; text?: string; after?: string };
/** 표의 행 추가·삭제. t·row·after는 0부터(목록의 '표N R행'에서 1을 뺀 값). rows는 열 순서대로 칸 글. */
export type RowOp =
  | { op: "insert"; t: number; after: number; rows: string[][] }
  | { op: "delete"; t: number; row: number };

export const MAX_LISTED_PARAGRAPHS = 700;
export const MAX_LIST_CHARS = 60000;

const EMPTY_LABEL = /^\(?\s*빈\s*칸\s*\)?$/;
const clean = (v: unknown, n: number) => {
  const t = String(v ?? "").replace(/\*\*/g, "").replace(/[\r\n]+/g, " ").trim().slice(0, n);
  return EMPTY_LABEL.test(t) ? "" : t; // 목록에 쓰인 '(빈칸)' 표시를 글로 적는 일을 막는다
};

function extractJson(raw: string): any | null {
  const t = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(t); } catch { /* */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; } }
  return null;
}

/** AI 응답 → 고칠 목록. 없는 문단 번호·같은 글로 바꾸는 항목은 버린다. */
export function parseEdits(raw: string, paras: DocParagraph[]): { edits: DocEdit[]; notes: string[]; rowOps: RowOp[] } | null {
  const j = extractJson(raw);
  if (!j || !Array.isArray(j.edits)) return null;
  const byId = new Map(paras.map((p) => [p.id, p]));
  const merged = new Map<number, DocEdit>();
  for (const e of j.edits.slice(0, 600)) {
    const id = Number(e?.id);
    const p = byId.get(id);
    if (!Number.isInteger(id) || !p) continue;
    const cur = merged.get(id) ?? { id };
    if (typeof e.text === "string" && cur.text === undefined) {
      const t = clean(e.text, 1500);
      if (t !== p.text) cur.text = t;
    }
    if (typeof e.after === "string" && !cur.after) {
      const a = clean(e.after, 1500);
      if (a) cur.after = a;
    }
    if (cur.text !== undefined || cur.after) merged.set(id, cur);
  }
  const edits = Array.from(merged.values());
  const notes = Array.isArray(j.notes) ? j.notes.map((x: unknown) => clean(x, 300)).filter(Boolean).slice(0, 10) : [];
  return { edits, notes, rowOps: parseRowOps(j.tableOps, paras) };
}

/** 표별 마지막 행 번호(0부터) */
function tableRowMax(paras: DocParagraph[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const p of paras) if (p.cell) m.set(p.cell.t, Math.max(m.get(p.cell.t) ?? 0, p.cell.r));
  return m;
}

/** AI가 낸 표 행 작업(번호는 1부터) → 0부터 번호의 RowOp. 없는 표·행은 버린다. */
export function parseRowOps(raw: unknown, paras: DocParagraph[]): RowOp[] {
  if (!Array.isArray(raw)) return [];
  const max = tableRowMax(paras);
  const out: RowOp[] = [];
  const seenDel = new Set<string>();
  for (const o of raw.slice(0, 60)) {
    const t = Number(o?.table) - 1;
    const last = max.get(t);
    if (!Number.isInteger(t) || last === undefined) continue;
    if (o?.op === "delete") {
      const row = Number(o.row) - 1;
      if (!Number.isInteger(row) || row < 1 || row > last || seenDel.has(`${t}:${row}`)) continue; // 첫 행(머리글)은 지우지 않음
      seenDel.add(`${t}:${row}`);
      out.push({ op: "delete", t, row });
    } else if (o?.op === "insert") {
      const after = Number(o.after) - 1;
      if (!Number.isInteger(after) || after < 0 || after > last || !Array.isArray(o.rows)) continue;
      const rows = o.rows.slice(0, 30).filter(Array.isArray).map((r: unknown[]) => r.slice(0, 30).map((c) => clean(c, 400)));
      if (rows.length) out.push({ op: "insert", t, after, rows });
    }
  }
  return out;
}

const MARK_ONLY = /^[-–—·•○●◦ㅇ※*]?\s*$/;

/**
 * 고친 뒤 칸이 모두 비어 있는 행은 자동으로 지운다(원래부터 비어 있던 여분의 행도 포함).
 * 글을 실제로 고친 표에서만 한다: 행 작업이 있거나, 글이 있던 칸을 비웠거나, 칸 3곳 이상을 고친 표.
 * 서식 문서의 빈 서명란 같은 곳을 지우지 않도록, 건드리지 않은 표는 그대로 둔다.
 */
export function autoPruneRows(paras: DocParagraph[], edits: DocEdit[], rowOps: RowOp[]): RowOp[] {
  const after = applyToParagraphs(paras, edits);
  const cellOf = new Map(paras.map((p) => [p.id, p]));
  const touched = new Set<number>(rowOps.map((o) => o.t));
  const editCount = new Map<number, number>();
  for (const e of edits) {
    const p = cellOf.get(e.id);
    if (!p?.cell) continue;
    editCount.set(p.cell.t, (editCount.get(p.cell.t) ?? 0) + 1);
    if (e.text !== undefined && !MARK_ONLY.test(p.text) && MARK_ONLY.test(e.text)) touched.add(p.cell.t);
  }
  editCount.forEach((n, t) => { if (n >= 3) touched.add(t); });

  const key = (t: number, r: number) => `${t}:${r}`;
  const rows = new Map<string, { empty: boolean; t: number; r: number }>();
  for (const p of after) {
    if (!p.cell || !touched.has(p.cell.t)) continue;
    const k = key(p.cell.t, p.cell.r);
    const cur = rows.get(k) ?? { empty: true, t: p.cell.t, r: p.cell.r };
    if (!MARK_ONLY.test(p.text)) cur.empty = false;
    rows.set(k, cur);
  }
  const already = new Set(rowOps.filter((o) => o.op === "delete").map((o) => key(o.t, (o as { row: number }).row)));
  const perTable = new Map<number, number>();
  for (const v of Array.from(rows.values())) perTable.set(v.t, (perTable.get(v.t) ?? 0) + 1);
  const out: RowOp[] = [];
  for (const v of Array.from(rows.values()).sort((a, b) => a.t - b.t || a.r - b.r)) {
    if (!v.empty || v.r < 1 || already.has(key(v.t, v.r))) continue;
    if ((perTable.get(v.t) ?? 0) - out.filter((o) => o.t === v.t).length <= 2) continue; // 표에 최소 2행은 남긴다
    out.push({ op: "delete", t: v.t, row: v.r });
  }
  return out;
}

/** 행 작업을 문단 목록에 반영(합계 검산용). 아래쪽 행부터 처리해 번호가 어긋나지 않게 한다. */
export function applyRowOpsToParagraphs(paras: DocParagraph[], rowOps: RowOp[]): DocParagraph[] {
  let cur = paras.map((p) => ({ ...p, cell: p.cell ? { ...p.cell } : undefined }));
  const anchor = (o: RowOp) => (o.op === "insert" ? o.after : o.row);
  const ops = [...rowOps].sort((a, b) => a.t - b.t || anchor(b) - anchor(a) || (a.op === "insert" ? -1 : 1) - (b.op === "insert" ? -1 : 1));
  let seq = 0;
  for (const o of ops) {
    if (o.op === "delete") {
      cur = cur.filter((p) => !(p.cell && p.cell.t === o.t && p.cell.r === o.row));
      for (const p of cur) if (p.cell && p.cell.t === o.t && p.cell.r > o.row) p.cell.r -= 1;
    } else {
      const n = o.rows.length;
      for (const p of cur) if (p.cell && p.cell.t === o.t && p.cell.r > o.after) p.cell.r += n;
      o.rows.forEach((cells, k) => cells.forEach((text, c) => cur.push({ id: -1_000_000 - seq++, text, cell: { t: o.t, r: o.after + 1 + k, c } })));
    }
  }
  return cur;
}

/** 글 고침 + 행 작업을 모두 반영한 문단 목록 */
export function applyAll(paras: DocParagraph[], edits: DocEdit[], rowOps: RowOp[]): DocParagraph[] {
  return applyRowOpsToParagraphs(applyToParagraphs(paras, edits), rowOps);
}

/** 메모리에서 고친 결과 문단 목록(합계 검산용). after는 해당 칸의 마지막 줄로 이어 붙인다. */
export function applyToParagraphs(paras: DocParagraph[], edits: DocEdit[]): DocParagraph[] {
  const m = new Map(edits.map((e) => [e.id, e]));
  const out: DocParagraph[] = [];
  for (const p of paras) {
    const e = m.get(p.id);
    out.push({ ...p, text: e?.text !== undefined ? e.text : p.text });
    if (e?.after) out.push({ id: -p.id - 1, text: e.after, cell: p.cell });
  }
  return out;
}

/** 표 칸 좌표가 있는 문단들을 표별 행렬로 만든다(칸 안 여러 문단은 공백으로 이음). */
export function buildTables(paras: DocParagraph[]): string[][][] {
  const tables = new Map<number, Map<number, Map<number, string>>>();
  for (const p of paras) {
    if (!p.cell) continue;
    const { t, r, c } = p.cell;
    if (!tables.has(t)) tables.set(t, new Map());
    const rows = tables.get(t)!;
    if (!rows.has(r)) rows.set(r, new Map());
    const row = rows.get(r)!;
    row.set(c, [row.get(c), p.text].filter(Boolean).join(" "));
  }
  return Array.from(tables.entries()).sort((a, b) => a[0] - b[0]).map(([, rows]) =>
    Array.from(rows.entries()).sort((a, b) => a[0] - b[0]).map(([, row]) => {
      const max = Math.max(...Array.from(row.keys()));
      return Array.from({ length: max + 1 }, (_, i) => row.get(i) ?? "");
    })
  );
}

const TOTAL_RE = /^(합\s*계|총\s*계|총\s*예산|총\s*액|계)$/;
const SUBTOTAL_RE = /소\s*계/;

/** 고친 뒤 표의 '합계' 칸이 위 항목 합과 맞는지 점검(금액 칸만). */
export function verifyEditedTables(paras: DocParagraph[]): string[] {
  const warns: string[] = [];
  buildTables(paras).forEach((rows, ti) => {
    if (rows.some((r) => SUBTOTAL_RE.test(r[0] ?? ""))) return;
    const hi = rows.findIndex((r) => TOTAL_RE.test((r[0] ?? "").replace(/\s/g, "")));
    if (hi < 1) return;
    const width = Math.max(...rows.map((r) => r.length));
    for (let c = 1; c < width; c++) {
      const total = parseMoney(rows[hi][c] ?? "");
      if (total == null) continue;
      let sum = 0, cnt = 0;
      for (let r = 0; r < hi; r++) { const v = parseMoney(rows[r][c] ?? ""); if (v != null) { sum += v; cnt++; } }
      if (cnt >= 2 && sum !== total) warns.push(`표${ti + 1}의 ${c + 1}번째 칸: 위 항목 합계 ${sum.toLocaleString("ko-KR")}원이 '합계' ${total.toLocaleString("ko-KR")}원과 다릅니다.`);
    }
  });
  return warns;
}

export const cellLabel = (c?: CellPos) => (c ? `표${c.t + 1} ${c.r + 1}행 ${c.c + 1}열` : "본문");
