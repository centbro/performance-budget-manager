import { describe, expect, it } from "vitest";
import { alignFilled, buildFillPrompt, maskPersonalInfo, parseAnalysis, type TemplateAnalysis } from "./docTemplate";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const analysis: TemplateAnalysis = {
  docKind: "기안서",
  tone: "개조식",
  sections: [
    { heading: "1. 목적", guide: "추진 목적", format: "개조식" },
    { heading: "2. 추진내용", guide: "일시·장소", format: "개조식" },
    { heading: "3. 예산", guide: "소요 예산", format: "표" },
  ],
};

describe("maskPersonalInfo", () => {
  it("전화번호·이메일·주민번호를 가린다", () => {
    const t = maskPersonalInfo("문의 031-123-4567, 010-1234-5678, a.b@x.co.kr, 900101-1234567");
    expect(t).not.toMatch(/031-123-4567|010-1234-5678|a\.b@x\.co\.kr|900101-1234567/);
    expect(t).toContain("[전화번호]");
    expect(t).toContain("[이메일]");
    expect(t).toContain("[주민번호]");
  });
});

describe("parseAnalysis", () => {
  it("항목이 없으면 null", () => {
    expect(parseAnalysis('{"sections":[]}')).toBeNull();
    expect(parseAnalysis("모름")).toBeNull();
  });
  it("항목명이 빈 것은 버리고 형식 기본값을 채운다", () => {
    const a = parseAnalysis('{"docKind":"기안서","tone":"개조식","sections":[{"heading":"1. 목적","guide":"g"},{"heading":""}]}');
    expect(a?.sections).toHaveLength(1);
    expect(a?.sections[0].format).toBe("서술");
  });
});

describe("alignFilled", () => {
  it("양식 항목 순서와 이름을 유지한다(응답 순서가 뒤섞여도)", () => {
    const raw = JSON.stringify({ sections: [
      { heading: "3. 예산", content: "표" },
      { heading: "1. 목적", content: "목적 내용" },
    ] });
    const r = alignFilled(analysis, raw);
    expect(r.map((x) => x.heading)).toEqual(["1. 목적", "2. 추진내용", "3. 예산"]);
    expect(r[0].content).toBe("목적 내용");
    expect(r[2].content).toBe("표");
    expect(r[1].content).toBe("");
  });
  it("항목명이 달라지면 순서로 대응한다", () => {
    const raw = JSON.stringify({ sections: [{ heading: "목적", content: "a" }, { heading: "내용", content: "b" }] });
    const r = alignFilled(analysis, raw);
    expect(r[0].content).toBe("a");
    expect(r[1].content).toBe("b");
  });
});

describe("buildFillPrompt", () => {
  it("항목 목록과 날조 금지 규칙을 포함한다", () => {
    const { system } = buildFillPrompt(analysis, { title: "t", facts: "f" });
    expect(system).toContain("2. 추진내용");
    expect(system).toContain("[확인 필요");
  });
});

describe("templates API", () => {
  const ctx = (u: TrpcContext["user"]): TrpcContext => ({ user: u, localUser: null, req: {} as any, res: {} as any });
  it("비로그인은 양식 목록을 볼 수 없다", async () => {
    await expect(appRouter.createCaller(ctx(null)).tools.templates()).rejects.toThrow();
  });
});
