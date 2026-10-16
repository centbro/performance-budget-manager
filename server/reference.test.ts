import { describe, expect, it } from "vitest";
import { lintOfficialStyle, OFFICIAL_STYLE_RULES } from "./officialStyle";
import { chunkPage, formatReferences } from "./referenceLib";
import { tokenize, scoreText } from "./caseSearch";
import { buildDocPrompt } from "./workTools";
import { buildFillPrompt } from "./docTemplate";
import { buildGeneratePrompt } from "./grantPlan";
import { appRouter } from "./routers";

const ref = { docId: 1, docName: "사업안내 지침", page: 12, text: "종사자 보수교육은 연 8시간 이상 실시한다." };

describe("lintOfficialStyle", () => {
  it("규칙에 맞는 문서는 경고가 없다", () => {
    const ok = "1. 일시: 2025. 1. 6.(월) 13:00~15:00\n2. 금액: 금500,000원(금오십만원)\n붙임  계획서 1부.  끝.";
    expect(lintOfficialStyle(ok, { requireEnd: true })).toEqual([]);
  });
  it("날짜 마침표 누락·한글 날짜를 잡는다", () => {
    const w = lintOfficialStyle("행사는 2025. 1. 6 에 열린다. 2025년 3월 4일에도 한다.");
    expect(w.filter((x) => x.rule === "날짜 표기").length).toBeGreaterThanOrEqual(2);
  });
  it("오전/오후·쌍점 띄움·24시를 잡는다", () => {
    const w = lintOfficialStyle("오후 2시에 시작, 13 : 20 종료, 2025. 2. 21. 24시까지");
    expect(w.filter((x) => x.rule === "시간 표기").length).toBe(3);
  });
  it("금액 띄움과 중첩 표현을 잡는다", () => {
    const w = lintOfficialStyle("금 13,500원, 2월달 기간 동안");
    expect(w.map((x) => x.rule)).toContain("금액 표기");
    expect(w.filter((x) => x.rule === "쉬운 표현").length).toBe(2);
  });
  it("끝 표시가 없으면 알린다", () => {
    expect(lintOfficialStyle("1. 내용입니다.", { requireEnd: true }).map((x) => x.rule)).toContain("끝 표시");
    expect(lintOfficialStyle("1. 내용입니다.  끝.", { requireEnd: true })).toEqual([]);
  });
});

describe("chunkPage", () => {
  it("짧은 글은 한 덩어리, 너무 짧으면 버린다", () => {
    expect(chunkPage("짧음")).toEqual([]);
    expect(chunkPage("가".repeat(100))).toHaveLength(1);
  });
  it("긴 글은 나누되 모든 글자를 보존한다", () => {
    const long = Array.from({ length: 60 }, (_, i) => `${i}번째 줄 ${"내용".repeat(20)}`).join("\n");
    const chunks = chunkPage(long);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 1700)).toBe(true);
    expect(chunks.join("\n").includes("59번째 줄")).toBe(true);
  });
});

describe("참고자료 반영", () => {
  it("검색 점수는 관련 있는 글이 더 높다", () => {
    const t = tokenize("종사자 보수교육 시간");
    expect(scoreText(ref.text, t)).toBeGreaterThan(scoreText("주차장 이용 안내", t));
  });
  it("프롬프트에 자료 인용 규칙과 출처가 들어간다", () => {
    const block = formatReferences([ref]);
    expect(block).toContain("「사업안내 지침」 p.12");
    expect(block).toContain("지어내지 말고");
    expect(formatReferences([])).toBe("");
  });
  it("문서·양식·사업계획서 프롬프트에 공문서 규칙과 자료가 반영된다", () => {
    expect(buildDocPrompt({ type: "official", title: "t", org: "", facts: "f" }, [ref]).system).toContain("공문서 작성 규칙");
    expect(buildDocPrompt({ type: "official", title: "t", org: "", facts: "f" }, [ref]).system).toContain("보수교육");
    const analysis = { docKind: "기안서", tone: "개조식", sections: [{ heading: "1. 목적", guide: "g", format: "개조식" }] };
    const fill = buildFillPrompt(analysis, { title: "t", facts: "f" }, null, [ref]).system;
    expect(fill).toContain("공문서 표기·표현 규칙");
    expect(fill).not.toContain("■ 구성");
    expect(fill).toContain("p.12");
    const quick = buildGeneratePrompt({ title: "t", year: 2026, field: "", region: "", targetDescription: "d", targetCount: 1, budget: 1, period: "p", desiredEffect: "e" }, [ref]).system;
    expect(quick).toContain("p.12");
    expect(OFFICIAL_STYLE_RULES).toContain("끝.");
  });
});

describe("references API", () => {
  const ctx = (u: any) => ({ user: u, localUser: null, req: {} as any, res: {} as any });
  it("비로그인은 자료 목록·검색을 볼 수 없다", async () => {
    await expect(appRouter.createCaller(ctx(null)).tools.references()).rejects.toThrow();
    await expect(appRouter.createCaller(ctx(null)).tools.searchReferences({ query: "x" })).rejects.toThrow();
  });
});
