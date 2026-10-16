// 프로그램 달성 가능성 시뮬레이션 (몬테카를로) — AI를 쓰지 않고 브라우저에서 계산한다.
// 같은 입력이면 항상 같은 결과가 나오도록 입력 기반 난수 시드를 쓴다.

export type Range3 = { min: number; mode: number; max: number }; // 0~100(%)

export type SimInput = {
  targetPeople: number; // 목표 실인원
  sessions: number; // 진행 횟수
  targetExtended: number; // 목표 연인원
  budget: number; // 총예산(원), 0이면 비용 계산 생략
  enroll: Range3; // 모집률: 목표 실인원 대비 실제로 1회 이상 참석하는 비율(%, 100 초과 가능)
  dropout: Range3; // 중도 이탈률: 마지막 회차까지 빠져나가는 비율(%)
  attendance: Range3; // 평균 출석률: 남아 있는 사람의 회차별 출석률(%)
};

export type Quantiles = { p10: number; p50: number; p90: number };

export type SimResult = {
  runs: number;
  probPeople: number; // 0~100
  probExtended: number;
  probBoth: number;
  people: Quantiles;
  extended: Quantiles;
  costPerPerson: Quantiles | null;
  costPerExtended: Quantiles | null;
  histogram: { from: number; to: number; count: number }[]; // 연인원 분포
  requiredAttendance: number | null; // 보통 시나리오에서 목표 연인원에 필요한 평균 출석률(%)
  sensitivity: { factor: string; probExtended: number; drop: number }[]; // 한 요인만 비관 값일 때 연인원 달성 확률
  grade: "안정" | "보통" | "주의" | "위험";
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clampPct = (v: number) => Math.max(0, Math.min(150, Number.isFinite(v) ? v : 0));

/** min ≤ mode ≤ max 가 되도록 보정 */
export function normalizeRange(r: Range3): Range3 {
  const mode = clampPct(r.mode);
  return { min: Math.min(clampPct(r.min), mode), mode, max: Math.max(clampPct(r.max), mode) };
}

function triangular(u: number, a: number, c: number, b: number) {
  if (b <= a) return a;
  const f = (c - a) / (b - a);
  return u < f ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c));
}

/** 회차별 남은 인원 비율의 합 = 연인원 계수 (선형으로 이탈) */
function activeSum(enrolled: number, dropoutFrac: number, sessions: number) {
  let sum = 0;
  for (let s = 0; s < sessions; s++) {
    const progress = sessions > 1 ? s / (sessions - 1) : 0;
    sum += enrolled * (1 - dropoutFrac * progress);
  }
  return sum;
}

function quantiles(sorted: number[]): Quantiles {
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return { p10: at(0.1), p50: at(0.5), p90: at(0.9) };
}

type Pin = Partial<Record<"enroll" | "dropout" | "attendance", number>>;

function runOnce(inp: SimInput, rs: { enroll: Range3; dropout: Range3; attendance: Range3 }, rng: () => number, pin: Pin) {
  const e = pin.enroll ?? triangular(rng(), rs.enroll.min, rs.enroll.mode, rs.enroll.max);
  const d = pin.dropout ?? triangular(rng(), rs.dropout.min, rs.dropout.mode, rs.dropout.max);
  const a = pin.attendance ?? triangular(rng(), rs.attendance.min, rs.attendance.mode, rs.attendance.max);
  const people = Math.round((inp.targetPeople * e) / 100);
  const extended = Math.round(activeSum(people, d / 100, inp.sessions) * (a / 100));
  return { people, extended };
}

export function simulate(input: SimInput, runs = 1000): SimResult {
  const rs = { enroll: normalizeRange(input.enroll), dropout: normalizeRange(input.dropout), attendance: normalizeRange(input.attendance) };
  const seed = Math.abs(Math.round(input.targetPeople * 31 + input.sessions * 131 + input.targetExtended * 7 + input.budget / 1000 + rs.enroll.mode * 3 + rs.dropout.mode * 5 + rs.attendance.mode * 11)) + 12345;
  const peopleArr: number[] = [];
  const extArr: number[] = [];
  const rng = mulberry32(seed);
  let hitP = 0, hitE = 0, hitBoth = 0;
  for (let i = 0; i < runs; i++) {
    const r = runOnce(input, rs, rng, {});
    peopleArr.push(r.people);
    extArr.push(r.extended);
    const okP = r.people >= input.targetPeople, okE = r.extended >= input.targetExtended;
    if (okP) hitP++;
    if (okE) hitE++;
    if (okP && okE) hitBoth++;
  }
  const pct = (n: number) => Math.round((n / runs) * 1000) / 10;
  const pS = [...peopleArr].sort((a, b) => a - b);
  const eS = [...extArr].sort((a, b) => a - b);

  // 히스토그램(연인원)
  const lo = eS[0], hi = eS[eS.length - 1];
  const bins = 12;
  const width = Math.max(1, Math.ceil((hi - lo + 1) / bins));
  const histogram = Array.from({ length: bins }, (_, i) => ({ from: lo + i * width, to: lo + (i + 1) * width - 1, count: 0 }));
  for (const v of eS) histogram[Math.min(bins - 1, Math.floor((v - lo) / width))].count++;

  // 비용
  let costPerPerson: Quantiles | null = null, costPerExtended: Quantiles | null = null;
  if (input.budget > 0) {
    const cp = peopleArr.filter((v) => v > 0).map((v) => input.budget / v).sort((a, b) => a - b);
    const ce = extArr.filter((v) => v > 0).map((v) => input.budget / v).sort((a, b) => a - b);
    if (cp.length) costPerPerson = quantiles(cp);
    if (ce.length) costPerExtended = quantiles(ce);
  }

  // 필요 출석률 (보통 시나리오)
  const basePeople = Math.round((input.targetPeople * rs.enroll.mode) / 100);
  const base = activeSum(basePeople, rs.dropout.mode / 100, input.sessions);
  const requiredAttendance = base > 0 ? Math.round((input.targetExtended / base) * 1000) / 10 : null;

  // 민감도: 한 요인만 비관 값에 고정
  const sens: { factor: string; pin: Pin }[] = [
    { factor: "모집률", pin: { enroll: rs.enroll.min } },
    { factor: "중도 이탈", pin: { dropout: rs.dropout.max } },
    { factor: "출석률", pin: { attendance: rs.attendance.min } },
  ];
  const sensitivity = sens
    .map(({ factor, pin }) => {
      const r2 = mulberry32(seed + 99);
      let hit = 0;
      for (let i = 0; i < runs; i++) if (runOnce(input, rs, r2, pin).extended >= input.targetExtended) hit++;
      const p = pct(hit);
      return { factor, probExtended: p, drop: Math.round((pct(hitE) - p) * 10) / 10 };
    })
    .sort((a, b) => b.drop - a.drop);

  const probBoth = pct(hitBoth);
  const grade = probBoth >= 80 ? "안정" : probBoth >= 60 ? "보통" : probBoth >= 40 ? "주의" : "위험";
  return { runs, probPeople: pct(hitP), probExtended: pct(hitE), probBoth, people: quantiles(pS), extended: quantiles(eS), costPerPerson, costPerExtended, histogram, requiredAttendance, sensitivity, grade };
}
