import { describe, expect, it } from "vitest";
import { buildCasePrompt, computeCaseStats, normalizeDate, parseCaseResult } from "./caseRecord";
import type { TemplateAnalysis } from "./docTemplate";

const analysis: TemplateAnalysis = {
  docKind: "상담일지",
  tone: "개조식",
  sections: [
    { heading: "상담내용", guide: "상담 내용", format: "개조식" },
    { heading: "조치사항", guide: "조치", format: "개조식" },
  ],
};

describe("buildCasePrompt", () => {
  it("항목 순서를 담고 개인정보를 가린다", () => {
    const { system, user } = buildCasePrompt(analysis, "A씨 010-1234-5678 방문", "2026-10-16");
    expect(system).toContain("1. 상담내용");
    expect(system).toContain("2026-10-16");
    expect(user).toContain("[전화번호]");
    expect(user).not.toContain("5678");
  });
});

describe("normalizeDate", () => {
  it("올바른 날짜만 통과", () => {
    expect(normalizeDate("2026-3-5")).toBe("2026-03-05");
    expect(normalizeDate("2026.10.16")).toBe("2026-10-16");
    expect(normalizeDate("2026-02-31", "x")).toBe("x");
    expect(normalizeDate("어제", "x")).toBe("x");
  });
});

describe("parseCaseResult", () => {
  it("양식 순서로 정렬하고 메타를 정리한다", () => {
    const raw = JSON.stringify({
      meta: { recordDate: "2026-10-14", subject: "A씨", category: "", summary: "임금체불 상담" },
      sections: [{ heading: "조치사항", content: "노동청 안내" }, { heading: "상담내용", content: "임금체불 문의" }],
    });
    const r = parseCaseResult(analysis, raw, "2026-10-16");
    expect(r.sections.map((s) => s.heading)).toEqual(["상담내용", "조치사항"]);
    expect(r.sections[0].content).toBe("임금체불 문의");
    expect(r.meta).toMatchObject({ recordDate: "2026-10-14", category: "미분류", subject: "A씨" });
  });
  it("깨진 응답이면 빈 항목과 오늘 날짜", () => {
    const r = parseCaseResult(analysis, "not json", "2026-10-16");
    expect(r.sections.every((s) => s.content === "")).toBe(true);
    expect(r.meta.recordDate).toBe("2026-10-16");
  });
});

describe("computeCaseStats", () => {
  it("월·유형별 집계와 실인원", () => {
    const s = computeCaseStats([
      { recordDate: "2026-09-02", subject: "A", category: "법률상담", templateName: "상담일지" },
      { recordDate: "2026-09-20", subject: "A", category: "통역", templateName: "상담일지" },
      { recordDate: "2026-10-01", subject: "B", category: "법률상담", templateName: "상담일지" },
      { recordDate: "2026-10-02", subject: "", category: "법률상담", templateName: "상담일지" },
    ]);
    expect(s.total).toBe(4);
    expect(s.uniqueSubjects).toBe(2);
    expect(s.extended).toBe(4);
    expect(s.people).toBe(2);
    expect(s.byMonth).toEqual([{ key: "2026-09", count: 2, people: 1 }, { key: "2026-10", count: 2, people: 1 }]);
    expect(s.byCategory[0]).toEqual({ key: "법률상담", count: 3, people: 2 });
  });
});
