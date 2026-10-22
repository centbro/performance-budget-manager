/** 강사비 세금 계산 — 사업소득(3.3%) / 기타소득(8.8%, 지급액 125,000원 이하는 비과세) */
export type FeeKind = "business" | "other";
export type FeeResult = { gross: number; incomeTax: number; localTax: number; tax: number; net: number };

export const OTHER_TAX_FREE_LIMIT = 125_000;
export const KIND_LABEL: Record<FeeKind, string> = { business: "사업소득 (3.3%)", other: "기타소득 (8.8%)" };

const floor10 = (n: number) => Math.floor(n / 10) * 10;

/** 지급액(세전) → 원천징수 소득세·지방소득세·실수령액. 세금은 10원 미만 절사. */
export function calcFee(kind: FeeKind, gross: number): FeeResult {
  const g = Number.isFinite(gross) && gross > 0 ? Math.floor(gross) : 0;
  let incomeTax = 0;
  let localTax = 0;
  if (kind === "business") {
    incomeTax = floor10(g * 0.03);
    localTax = floor10(g * 0.003);
  } else if (g > OTHER_TAX_FREE_LIMIT) {
    incomeTax = floor10(g * 0.08);
    localTax = floor10(g * 0.008);
  }
  const tax = incomeTax + localTax;
  return { gross: g, incomeTax, localTax, tax, net: g - tax };
}

/** 실수령액(세후)을 맞추고 싶을 때 필요한 지급액(세전) 역산 — 계산해서 실수령액이 target 이상이 되는 최소 금액 */
export function grossForNet(kind: FeeKind, net: number): number {
  const target = Math.floor(net);
  if (!(target > 0)) return 0;
  const rate = kind === "business" ? 0.967 : 0.912;
  let g = Math.floor(target / rate);
  while (g > 0 && calcFee(kind, g - 1).net >= target) g--;
  while (calcFee(kind, g).net < target) g++;
  if (kind === "other" && target <= OTHER_TAX_FREE_LIMIT) return target; // 비과세 구간
  return g;
}

export type FeeRow = { name: string; kind: FeeKind; gross: number; memo?: string };
export type FeeTotals = { count: number; gross: number; incomeTax: number; localTax: number; tax: number; net: number };

export function sumRows(rows: FeeRow[]): FeeTotals {
  const t: FeeTotals = { count: 0, gross: 0, incomeTax: 0, localTax: 0, tax: 0, net: 0 };
  for (const r of rows) {
    const c = calcFee(r.kind, r.gross);
    if (!c.gross) continue;
    t.count++; t.gross += c.gross; t.incomeTax += c.incomeTax; t.localTax += c.localTax; t.tax += c.tax; t.net += c.net;
  }
  return t;
}

export function parseRows(json: string): FeeRow[] {
  try {
    const a = JSON.parse(json);
    if (!Array.isArray(a)) return [];
    return a.slice(0, 200).map((r: any) => ({
      name: String(r?.name ?? "").slice(0, 50),
      kind: r?.kind === "other" ? "other" : "business",
      gross: Math.max(0, Math.floor(Number(r?.gross) || 0)),
      memo: String(r?.memo ?? "").slice(0, 100),
    } as FeeRow));
  } catch { return []; }
}
