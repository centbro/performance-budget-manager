import { Fragment, type ReactNode } from "react";

/** 사업계획서 본문용 가벼운 마크다운 표시(제목·굵게·목록·표·가로줄). 기호가 그대로 보이지 않게 한다. */
function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[3]) parts.push(<code key={k++} className="px-1 rounded bg-muted text-[0.9em]">{m[3]}</code>);
    else parts.push(<strong key={k++} className="font-semibold">{m[1] ?? m[2]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isTableSep = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(l);
const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
const LIST = /^(\s*)([-*+•]|\d+[.)])\s+(.*)$/;

export default function MarkdownLite({ text, className = "" }: { text: string; className?: string }) {
  const lines = (text ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0, key = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    const h = l.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      blocks.push(<p key={key++} className={level <= 2 ? "mt-4 mb-1.5 text-base font-bold" : "mt-3 mb-1 font-semibold"}>{inline(h[2])}</p>);
      i++; continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(l)) { blocks.push(<hr key={key++} className="my-3 border-border" />); i++; continue; }
    if (isTableRow(l) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = cells(l); const rows: string[][] = []; i += 2;
      while (i < lines.length && isTableRow(lines[i])) { rows.push(cells(lines[i])); i++; }
      blocks.push(
        <div key={key++} className="my-2 overflow-x-auto">
          <table className="w-full border-collapse text-[0.92em]">
            <thead><tr>{head.map((c, j) => <th key={j} className="border px-2 py-1 bg-muted/60 text-left font-semibold">{inline(c)}</th>)}</tr></thead>
            <tbody>{rows.map((r, a) => <tr key={a}>{r.map((c, j) => <td key={j} className="border px-2 py-1 align-top">{inline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }
    if (LIST.test(l)) {
      const items: { depth: number; ordered: boolean; text: string }[] = [];
      while (i < lines.length && LIST.test(lines[i])) {
        const m = lines[i].match(LIST)!;
        items.push({ depth: Math.min(Math.floor(m[1].replace(/\t/g, "  ").length / 2), 3), ordered: /\d/.test(m[2]), text: m[3] });
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-1.5 space-y-1">
          {items.map((it, j) => (
            <li key={j} className="flex gap-2" style={{ paddingLeft: it.depth * 16 }}>
              <span className="shrink-0 text-muted-foreground">{it.ordered ? `${j + 1}.` : it.depth ? "–" : "•"}</span>
              <span className="min-w-0">{inline(it.text)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^\s{0,3}#{1,6}\s/.test(lines[i]) && !LIST.test(lines[i]) && !isTableRow(lines[i])) { para.push(lines[i]); i++; }
    if (para.length === 0) { para.push(lines[i]); i++; }
    blocks.push(<p key={key++} className="my-1.5">{para.map((p, j) => <Fragment key={j}>{j > 0 && <br />}{inline(p)}</Fragment>)}</p>);
  }
  return <div className={`text-sm leading-relaxed break-words ${className}`}>{blocks}</div>;
}
