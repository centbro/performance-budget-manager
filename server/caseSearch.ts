import caseIndexJson from "./data/caseIndex.json";

export type CaseEntry = {
  id: string;
  year: number;
  page: number;
  head: string;
  background: string;
  goals: string;
  activities: string;
  outcomes: string;
};

const CASES = caseIndexJson as CaseEntry[];

const FIELD_WEIGHTS: [keyof CaseEntry, number][] = [
  ["head", 3],
  ["goals", 2],
  ["background", 1.5],
  ["outcomes", 1.2],
  ["activities", 1],
];

/** 한국어 검색어를 단어 + 2글자 조각으로 나눈다(조사 변형에 덜 민감하게). */
export function tokenize(query: string): string[] {
  const words = query
    .toLowerCase()
    .split(/[\s,./·()\[\]'"“”‘’]+/)
    .filter((w) => w.length >= 1);
  const out = new Set<string>();
  for (const w of words) {
    if (w.length <= 2) {
      out.add(w);
      continue;
    }
    out.add(w);
    for (let i = 0; i < w.length - 1; i++) out.add(w.slice(i, i + 2));
  }
  return Array.from(out);
}

/** 한 덩어리 글에 대한 점수(긴 토큰일수록 가중). */
export function scoreText(text: string, tokens: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const t of tokens) if (lower.includes(t)) score += t.length >= 3 ? 2 : 1;
  return score;
}

export function scoreCase(c: CaseEntry, tokens: string[]): number {
  let score = 0;
  for (const [field, weight] of FIELD_WEIGHTS) {
    const text = (c[field] as string).toLowerCase();
    if (!text) continue;
    for (const t of tokens) {
      if (!text.includes(t)) continue;
      // 긴 토큰(원문 단어)을 더 높게 평가
      score += weight * (t.length >= 3 ? 2 : 1);
    }
  }
  return score;
}

export function searchCases(opts: { query: string; year?: number; limit?: number }): CaseEntry[] {
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 30);
  const pool = opts.year ? CASES.filter((c) => c.year === opts.year) : CASES;
  const tokens = tokenize(opts.query.trim());
  if (tokens.length === 0) return [];
  return pool
    .map((c) => ({ c, s: scoreCase(c, tokens) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || b.c.year - a.c.year)
    .slice(0, limit)
    .map((x) => x.c);
}

export function caseStats() {
  const byYear: Record<number, number> = {};
  for (const c of CASES) byYear[c.year] = (byYear[c.year] ?? 0) + 1;
  return { total: CASES.length, byYear };
}
