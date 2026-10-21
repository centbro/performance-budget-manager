export type FolderRow = { name: string; kind: string; date: string; summary: string; facts: string };

const clip = (s: unknown, n: number) => {
  const a = Array.from(String(s ?? "").replace(/\s+/g, " ").replace(/[*#`]/g, "").trim());
  return a.length > n ? a.slice(0, n - 1).join("") + "…" : a.join("");
};

/** AI 응답을 파일 순서(index)에 맞춰 행으로 바꾼다. 응답에 없는 파일은 빈 요약으로 채운다. */
export function parseFolderRows(raw: string, names: string[]): FolderRow[] {
  let o: any = null;
  try { const m = raw.match(/\{[\s\S]*\}/); o = JSON.parse(m ? m[0] : raw); } catch { /* 빈 결과 */ }
  const arr: any[] = Array.isArray(o?.rows) ? o.rows : [];
  return names.map((name, i) => {
    const r = arr.find((x) => Number(x?.index) === i) ?? {};
    const facts = Array.isArray(r.facts) ? r.facts.map((f: unknown) => clip(f, 60)).filter(Boolean).join(" / ") : clip(r.facts, 200);
    return { name, kind: clip(r.kind, 20), date: clip(r.date, 30), summary: clip(r.summary, 160), facts: clip(facts, 240) };
  });
}
