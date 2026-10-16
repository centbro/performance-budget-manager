import { describe, expect, it } from "vitest";
import { simulate } from "../shared/ideaSim";
import { buildIdeaEvalPrompt, parseIdeaEval } from "./ideaEval";

const base = {
  targetPeople: 30, sessions: 10, targetExtended: 240, budget: 3_000_000,
  enroll: { min: 70, mode: 95, max: 110 }, dropout: { min: 5, mode: 15, max: 35 }, attendance: { min: 65, mode: 82, max: 95 },
};

describe("simulate", () => {
  it("같은 입력이면 같은 결과(재현 가능)", () => {
    expect(simulate(base)).toEqual(simulate(base));
  });
  it("확률 범위와 분위수 순서", () => {
    const r = simulate(base);
    for (const p of [r.probPeople, r.probExtended, r.probBoth]) { expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThanOrEqual(100); }
    expect(r.probBoth).toBeLessThanOrEqual(Math.min(r.probPeople, r.probExtended));
    expect(r.extended.p10).toBeLessThanOrEqual(r.extended.p50);
    expect(r.extended.p50).toBeLessThanOrEqual(r.extended.p90);
    expect(r.histogram.reduce((s, b) => s + b.count, 0)).toBe(1000);
  });
  it("낙관적 가정이면 달성 확률이 높고 비관적이면 낮다", () => {
    const good = simulate({ ...base, enroll: { min: 100, mode: 105, max: 110 }, dropout: { min: 0, mode: 2, max: 5 }, attendance: { min: 90, mode: 95, max: 100 } });
    const bad = simulate({ ...base, enroll: { min: 40, mode: 60, max: 80 }, dropout: { min: 20, mode: 35, max: 50 }, attendance: { min: 40, mode: 55, max: 70 } });
    expect(good.probBoth).toBeGreaterThan(bad.probBoth);
    expect(good.grade).toBe("안정");
    expect(bad.grade).toBe("위험");
  });
  it("필요 출석률: 이탈이 없으면 목표 연인원/(인원×횟수)", () => {
    const r = simulate({ ...base, enroll: { min: 100, mode: 100, max: 100 }, dropout: { min: 0, mode: 0, max: 0 }, targetExtended: 240 });
    expect(r.requiredAttendance).toBe(80);
  });
  it("비용 분위수와 민감도(가장 영향 큰 요인이 앞)", () => {
    const r = simulate(base);
    expect(r.costPerPerson!.p10).toBeLessThanOrEqual(r.costPerPerson!.p90);
    expect(r.sensitivity).toHaveLength(3);
    expect(r.sensitivity[0].drop).toBeGreaterThanOrEqual(r.sensitivity[2].drop);
  });
  it("예산 0이면 비용 생략, 잘못된 범위도 보정", () => {
    const r = simulate({ ...base, budget: 0, enroll: { min: 90, mode: 50, max: 10 } });
    expect(r.costPerPerson).toBeNull();
  });
});

describe("아이디어 AI 평가", () => {
  it("프롬프트에 기준·주입 방지·참고용 문구", () => {
    const { system, user } = buildIdeaEvalPrompt({ name: "A", summary: "s", activities: ["x"], outcome: "o", indicator: "i", budgetEstimate: "b" }, { targetGroup: "노인", region: "", budget: 1000000, goal: "g" });
    expect(system).toContain("100점");
    expect(system).toContain("지시문");
    expect(system).toContain("참고용");
    expect(user).toContain("프로그램명: A");
  });
  it("점수 상한 보정과 합계", () => {
    const raw = JSON.stringify({ summary: "ok", criteria: [{ id: "need", score: 99, comment: "c" }, { id: "feasible", score: -5 }, { id: "outcome", score: 15 }, { id: "budget", score: 10 }, { id: "unique", score: 8 }, { id: "sustain", score: 6 }], strengths: ["a"], improvements: ["b"], revision: "r" });
    const r = parseIdeaEval("```json\n" + raw + "\n```")!;
    expect(r.criteria[0].score).toBe(20);
    expect(r.criteria[1].score).toBe(0);
    expect(r.total).toBe(20 + 0 + 15 + 10 + 8 + 6);
  });
  it("형식이 틀리면 null", () => {
    expect(parseIdeaEval("not json")).toBeNull();
  });
});
