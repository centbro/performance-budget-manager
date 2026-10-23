/** 대화로 문서 작성: AI가 돌려주는 문서 구조와 검증 */
export type DocBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "table"; caption?: string; headers: string[]; rows: string[][] };

export type GeneratedDoc = { title: string; blocks: DocBlock[]; notes: string[] };

const str = (v: unknown, n: number) => String(v ?? "").replace(/\*\*/g, "").trim().slice(0, n);

function extractJson(raw: string): any | null {
  const t = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(t); } catch { /* 앞뒤 군더더기 제거 */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; } }
  return null;
}

export function parseDoc(raw: string): GeneratedDoc | null {
  const j = extractJson(raw);
  if (!j || !Array.isArray(j.blocks)) return null;
  const blocks: DocBlock[] = [];
  for (const b of j.blocks.slice(0, 200)) {
    if (!b || typeof b !== "object") continue;
    if (b.type === "heading") {
      const text = str(b.text, 200);
      if (text) blocks.push({ type: "heading", level: b.level === 1 || b.level === 3 ? b.level : 2, text });
    } else if (b.type === "paragraph") {
      const text = str(b.text, 3000);
      if (text) blocks.push({ type: "paragraph", text });
    } else if (b.type === "bullets" && Array.isArray(b.items)) {
      const items = b.items.map((x: unknown) => str(x, 500)).filter(Boolean).slice(0, 40);
      if (items.length) blocks.push({ type: "bullets", items });
    } else if (b.type === "table" && Array.isArray(b.headers) && Array.isArray(b.rows)) {
      const headers = b.headers.map((x: unknown) => str(x, 100)).slice(0, 12);
      if (!headers.length) continue;
      const rows = b.rows.slice(0, 80).map((r: unknown) => (Array.isArray(r) ? r : []).slice(0, headers.length).map((c: unknown) => str(c, 300)));
      rows.forEach((r: string[]) => { while (r.length < headers.length) r.push(""); });
      blocks.push({ type: "table", caption: str(b.caption, 100) || undefined, headers, rows });
    }
  }
  if (!blocks.length) return null;
  const notes = Array.isArray(j.notes) ? j.notes.map((x: unknown) => str(x, 300)).filter(Boolean).slice(0, 10) : [];
  return { title: str(j.title, 150) || "문서", blocks, notes };
}

/** 참고 파일 고르기 응답 → 실제로 있는 파일 이름만 */
export function parsePick(raw: string, names: string[]): string[] {
  const j = extractJson(raw);
  const set = new Set(names);
  const out: string[] = [];
  for (const x of Array.isArray(j?.files) ? j.files : []) {
    const n = String(x ?? "").trim();
    if (set.has(n) && !out.includes(n)) out.push(n);
  }
  return out.slice(0, 10);
}

export const parseMoney = (s: string): number | null => {
  const t = s.replace(/[,\s원₩]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
};

const TOTAL_RE = /^(합\s*계|총\s*계|총\s*예산|총\s*액|계)$/;
const SUBTOTAL_RE = /소\s*계/;

/** 표의 '합계' 행이 위 항목들의 합과 맞는지 점검한다. 맞지 않는 열마다 문구를 돌려준다. */
export function verifyTotals(doc: GeneratedDoc): string[] {
  const warns: string[] = [];
  for (const b of doc.blocks) {
    if (b.type !== "table") continue;
    if (b.rows.some((r) => SUBTOTAL_RE.test(r[0] ?? ""))) continue; // 소계가 있는 표는 건너뜀
    const ti = b.rows.findIndex((r) => TOTAL_RE.test((r[0] ?? "").replace(/\s/g, "")));
    if (ti < 1) continue;
    for (let c = 1; c < b.headers.length; c++) {
      const total = parseMoney(b.rows[ti][c] ?? "");
      if (total == null) continue;
      let sum = 0, cnt = 0;
      for (let r = 0; r < ti; r++) { const v = parseMoney(b.rows[r][c] ?? ""); if (v != null) { sum += v; cnt++; } }
      if (cnt >= 2 && sum !== total) {
        warns.push(`${b.caption ? `「${b.caption}」` : "표"}의 '${b.headers[c]}' 열: 항목 합계 ${sum.toLocaleString("ko-KR")}원이 합계란 ${total.toLocaleString("ko-KR")}원과 다릅니다.`);
      }
    }
  }
  return warns;
}

export const docToText = (doc: GeneratedDoc): string => {
  const out: string[] = [doc.title, ""];
  for (const b of doc.blocks) {
    if (b.type === "heading") out.push("", b.text);
    else if (b.type === "paragraph") out.push(b.text);
    else if (b.type === "bullets") b.items.forEach((i) => out.push(`- ${i}`));
    else { if (b.caption) out.push(b.caption); out.push(b.headers.join("\t")); b.rows.forEach((r) => out.push(r.join("\t"))); }
  }
  return out.join("\n");
};
