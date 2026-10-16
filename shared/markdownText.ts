/** 마크다운 기호(#, **, *, 표 구분선 등)를 걷어내고 붙여넣기 좋은 평문으로 바꾼다. */
export function mdToPlain(src: string): string {
  const lines = (src ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  for (let raw of lines) {
    let l = raw;
    if (/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l) && l.includes("-") && (l.includes("|") || /^\s*-{3,}\s*$/.test(l))) {
      if (/^\s*-{3,}\s*$/.test(l)) out.push(""); // 가로줄 → 빈 줄
      continue; // 표 구분선 제거
    }
    if (/^\s*\|.*\|\s*$/.test(l)) l = l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()).join("\t");
    l = l.replace(/^\s{0,3}#{1,6}\s+/, "");
    l = l.replace(/^(\s*)[*+]\s+/, "$1- ");
    l = l.replace(/\*\*(.+?)\*\*/g, "$1").replace(/__(.+?)__/g, "$1");
    l = l.replace(/(^|[\s(])\*(?!\s)(.+?)\*(?=[\s).,:;]|$)/g, "$1$2");
    l = l.replace(/`([^`]+)`/g, "$1");
    out.push(l);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
