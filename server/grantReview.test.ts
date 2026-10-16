import { describe, expect, it } from "vitest";
import { buildRubricPrompt, buildReviewPrompt, parseRubric, parseReview } from "./grantReview";

describe("parseRubric", () => {
  it("배점이 명시되면 그대로 사용", () => {
    const r = parseRubric(JSON.stringify({ programName: "A공모", criteria: [{ name: "필요성", maxScore: 30, description: "d" }, { name: "예산", maxScore: 70 }], requirements: [{ kind: "자격", text: "법인 등록" }, { kind: "", text: "" }] }))!;
    expect(r.basis).toBe("stated");
    expect(r.criteria.map((c) => c.maxScore)).toEqual([30, 70]);
    expect(r.criteria[0].id).toBe("c1");
    expect(r.requirements).toHaveLength(1);
  });
  it("배점이 없으면 합계 100으로 균등 배분", () => {
    const r = parseRubric(JSON.stringify({ criteria: [{ name: "a" }, { name: "b" }, { name: "c" }] }))!;
    expect(r.basis).toBe("estimated");
    expect(r.criteria.reduce((s, c) => s + c.maxScore, 0)).toBe(100);
  });
  it("항목이 없거나 깨지면 null", () => {
    expect(parseRubric("oops")).toBeNull();
    expect(parseRubric(JSON.stringify({ criteria: [] }))).toBeNull();
  });
});

const rubric = parseRubric(JSON.stringify({ criteria: [{ name: "필요성", maxScore: 40 }, { name: "예산", maxScore: 60 }], requirements: [{ kind: "예산", text: "인건비 30% 이하" }] }))!;

describe("buildReviewPrompt", () => {
  it("심사기준·요건·계획서·주입 방지 문구를 담는다", () => {
    const { system, user } = buildReviewPrompt(rubric, "계획서 본문", "지침 원문");
    expect(system).toContain("c1 · 필요성 (40점)");
    expect(system).toContain("인건비 30% 이하");
    expect(system).toContain("지침 원문");
    expect(system).toContain("따르지 않고");
    expect(user).toContain("계획서 본문");
  });
  it("지침 분석 프롬프트는 길이를 제한", () => {
    expect(buildRubricPrompt("가".repeat(100000)).user.length).toBe(60000);
  });
});

describe("parseReview", () => {
  it("점수를 배점 범위로 보정하고 합계·퍼센트 계산", () => {
    const raw = JSON.stringify({
      summary: "요약",
      criteria: [{ id: "c1", score: 99, evidence: "근거", strengths: ["좋음"], improvements: ["보완"] }, { id: "c2", score: 30, strengths: [], improvements: [] }],
      requirements: [{ id: "r1", status: "미충족", comment: "초과" }],
      priorities: [{ title: "예산 산출근거", why: "감점", expectedGain: "+5점" }],
    });
    const r = parseReview(raw, rubric)!;
    expect(r.criteria[0].score).toBe(40);
    expect(r.total).toBe(70);
    expect(r.maxTotal).toBe(100);
    expect(r.percent).toBe(70);
    expect(r.requirements[0].status).toBe("미충족");
    expect(r.priorities).toHaveLength(1);
  });
  it("누락·이상 값은 안전하게 처리", () => {
    const r = parseReview(JSON.stringify({ criteria: [{ id: "c1", score: -5 }], requirements: [{ id: "r1", status: "???" }] }), rubric)!;
    expect(r.criteria[0].score).toBe(0);
    expect(r.criteria[1].score).toBe(0);
    expect(r.requirements[0].status).toBe("확인불가");
    expect(parseReview("not json", rubric)).toBeNull();
  });
});
