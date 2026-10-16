import { describe, expect, it } from "vitest";
import { buildGeneratePrompt, normalizeQuickInput, parseGeneratedSections, parseSelfCheck } from "./grantPlan";
import { searchCases, tokenize, caseStats } from "./caseSearch";
import { PLAN_SECTIONS } from "../shared/businessPlanData";

const base = {
  title: "이주노동자 한국어 교실",
  year: 2026,
  field: "교육/자립",
  region: "화성시",
  targetDescription: "화성시 이주노동자",
  targetCount: 40,
  budget: 12_000_000,
  period: "",
  desiredEffect: "한국어 의사소통 능력과 사회적 고립감 개선",
};

describe("normalizeQuickInput", () => {
  it("기간이 비면 해당 연도 전체로 채운다", () => {
    expect(normalizeQuickInput(base).period).toBe("2026. 1. 1. ~ 12. 31.");
  });
  it("필수값이 없으면 거부한다", () => {
    expect(() => normalizeQuickInput({ ...base, desiredEffect: " " })).toThrow();
    expect(() => normalizeQuickInput({ ...base, budget: 0 })).toThrow();
    expect(() => normalizeQuickInput({ ...base, targetCount: -1 })).toThrow();
  });
});

describe("buildGeneratePrompt", () => {
  it("예산과 모든 섹션 id를 포함한다", () => {
    const { system, user } = buildGeneratePrompt(normalizeQuickInput(base));
    expect(user).toContain("12,000,000원");
    for (const s of PLAN_SECTIONS) expect(system).toContain(`"${s.id}"`);
  });
});

describe("parseGeneratedSections", () => {
  it("코드펜스가 있어도 파싱한다", () => {
    const raw = '```json\n{"overview":"개요 내용","budget":"예산 내용"}\n```';
    const r = parseGeneratedSections(raw);
    expect(r).toHaveLength(PLAN_SECTIONS.length);
    expect(r.find((s) => s.sectionId === "overview")?.content).toBe("개요 내용");
    expect(r.find((s) => s.sectionId === "goal")?.content).toBe("");
  });
  it("JSON이 아니면 원문을 첫 섹션에 보존한다", () => {
    const r = parseGeneratedSections("그냥 텍스트");
    expect(r[0].content).toBe("그냥 텍스트");
  });
});

describe("parseSelfCheck", () => {
  it("점수를 0~100으로 보정한다", () => {
    const r = parseSelfCheck('{"overall":120,"summary":"s","criteria":[{"id":"budget","score":-5,"strengths":["a"],"improvements":"x"}],"missing":["m"]}');
    expect(r.overall).toBe(100);
    expect(r.criteria[0].score).toBe(0);
    expect(r.criteria[0].improvements).toEqual([]);
  });
  it("해석 불가 응답은 오류", () => {
    expect(() => parseSelfCheck("모르겠음")).toThrow();
  });
});

describe("caseSearch", () => {
  it("색인이 로드된다", () => {
    expect(caseStats().total).toBeGreaterThan(100);
  });
  it("토큰화는 2글자 조각을 만든다", () => {
    expect(tokenize("이주배경청소년")).toContain("이주");
  });
  it("검색 결과는 연도 필터를 지킨다", () => {
    const r = searchCases({ query: "이주배경청소년 진로", year: 2024 });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((c) => c.year === 2024)).toBe(true);
  });
  it("빈 검색어는 빈 결과", () => {
    expect(searchCases({ query: "  " })).toEqual([]);
  });
});
