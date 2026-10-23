/** 기존 문서의 말투·표기 습관을 글에서 직접 관찰해 AI에게 알려 주는 짧은 안내문 */

const FORMAL_END = /(습니다|입니다|합니다|됩니다|십시오|바랍니다)[.!]?$/;
const POLITE_END = /(해요|예요|이에요|세요|어요|아요)[.!]?$/;
const NOUN_END = /(함|임|음|됨|있음|없음|예정|필요|바람|요망|계획|실시|진행|운영|지원|참석|확인|협조)[.]?$/;
const MARKERS: [string, RegExp][] = [
  ["○", /^○/], ["-", /^-\s/], ["·", /^[·ㆍ•]/], ["□", /^□/], ["■", /^■/], ["▶", /^[▶▷►]/], ["※", /^※/],
  ["1.", /^\d{1,2}\.\s/], ["가.", /^[가-하]\.\s/], ["1)", /^\d{1,2}\)\s/], ["가)", /^[가-하]\)\s/], ["(1)", /^\(\d{1,2}\)/], ["①", /^[①-⑩]/],
];
const DATE_RE = /\d{4}\.\s?\d{1,2}\.\s?\d{1,2}\.?(?:\([월화수목금토일]\))?|\d{4}-\d{2}-\d{2}|\d{4}년\s?\d{1,2}월\s?\d{1,2}일(?:\([월화수목금토일]\))?/g;
const TIME_RE = /\d{1,2}:\d{2}\s?[~∼-]\s?\d{1,2}:\d{2}|\d{1,2}시(?:\s?\d{1,2}분)?\s?[~∼-]\s?\d{1,2}시(?:\s?\d{1,2}분)?/g;
const MONEY_RE = /\d{1,3}(?:,\d{3})+\s?원?|\d+\s?천원|\d+\s?만원/g;

function topSamples(found: string[], n: number): string[] {
  const m = new Map<string, number>();
  for (const f of found) m.set(f, (m.get(f) ?? 0) + 1);
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k.trim());
}

export function styleHints(texts: string[]): string {
  const lines = texts.flatMap((t) => t.split(/\n+/)).map((s) => s.trim()).filter((s) => s.length >= 2);
  if (lines.length < 3) return "";
  let formal = 0, polite = 0, noun = 0, sentences = 0;
  for (const l of lines) {
    if (l.length < 8) continue;
    sentences++;
    if (FORMAL_END.test(l)) formal++;
    else if (POLITE_END.test(l)) polite++;
    else if (NOUN_END.test(l)) noun++;
  }
  const out: string[] = [];
  if (sentences >= 3) {
    const top = Math.max(formal, polite, noun);
    if (top >= sentences * 0.25) {
      if (top === noun) out.push('말투: 개조식 — 문장을 "~함", "~임", "~예정", "~실시"처럼 명사형으로 끝냄(존댓말 "~합니다" 쓰지 않음)');
      else if (top === formal) out.push('말투: 서술식 존댓말 — "~합니다", "~입니다"로 끝냄');
      else out.push('말투: 부드러운 존댓말 — "~해요", "~예요"로 끝냄');
    }
  }
  const markerCount = MARKERS.map(([label, re]) => [label, lines.filter((l) => re.test(l)).length] as const).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (markerCount.length) out.push(`글머리·번호 기호: ${markerCount.map(([l, n]) => `${l}(${n}번 사용)`).join(", ")} — 새로 쓰는 문단도 같은 기호 체계를 씀`);
  const all = lines.join("\n");
  const dates = topSamples(all.match(DATE_RE) ?? [], 2);
  if (dates.length) out.push(`날짜 표기 예: ${dates.join(" / ")} — 같은 모양으로 씀`);
  const times = topSamples(all.match(TIME_RE) ?? [], 2);
  if (times.length) out.push(`시간 표기 예: ${times.join(" / ")}`);
  const money = topSamples(all.match(MONEY_RE) ?? [], 2);
  if (money.length) out.push(`금액 표기 예: ${money.join(" / ")}`);
  const avg = Math.round(lines.filter((l) => l.length >= 8).reduce((a, l) => a + l.length, 0) / Math.max(1, lines.filter((l) => l.length >= 8).length));
  if (avg) out.push(`문장 길이: 보통 ${avg}자 안팎 — 비슷한 길이로 씀`);
  return out.length ? out.map((o) => `· ${o}`).join("\n") : "";
}
