/** 기존 문서(hwpx·docx)를 문단 단위로 고쳐 쓰는 기능의 공용 타입·검증 */
import { parseMoney } from "./docChat";

export type CellPos = { t: number; r: number; c: number };
export type DocParagraph = { id: number; text: string; cell?: CellPos };
export type DocEdit = { id: number; text?: string; after?: string };

export const MAX_LISTED_PARAGRAPHS = 700;
export const MAX_LIST_CHARS = 60000;

const clean = (v: unknown, n: number) => String(v ?? "").replace(/\*\*/g, "").replace(/[\r\n]+/g, " ").trim().slice(0, n);

function extractJson(raw: string): any | null {
  const t = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(t); } catch { /* */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; } }
  return null;
}

/** AI 응답 → 고칠 목록. 없는 문단 번호·같은 글로 바꾸는 항목은 버린다. */
export function parseEdits(raw: string, paras: DocParagraph[]): { edits: DocEdit[]; notes: string[] } | null {
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
  return { edits, notes };
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
