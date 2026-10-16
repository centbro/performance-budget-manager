import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { buildDocPrompt, buildIdeasPrompt, cleanDocOutput, parseIdeas } from "./workTools";
import type { TrpcContext } from "./_core/context";

const user = {
  id: 7, openId: "local:7", email: "a@b.c", name: "t", loginMethod: "local",
  role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
} as NonNullable<TrpcContext["user"]>;
const ctx = (u: TrpcContext["user"]): TrpcContext => ({ user: u, localUser: null, req: {} as any, res: {} as any });

describe("parseIdeas", () => {
  it("코드펜스 JSON에서 아이디어를 읽는다", () => {
    const raw = '```json\n{"ideas":[{"name":"A","summary":"s","activities":["x","y"],"outcome":"o","indicator":"i","budgetEstimate":"b"},{"name":""}]}\n```';
    const r = parseIdeas(raw);
    expect(r).toHaveLength(1);
    expect(r[0].activities).toEqual(["x", "y"]);
  });
  it("깨진 응답은 빈 배열", () => {
    expect(parseIdeas("죄송합니다")).toEqual([]);
  });
});

describe("prompts", () => {
  it("아이디어 프롬프트에 예산과 참고 사례가 들어간다", () => {
    const { user: u } = buildIdeasPrompt({ targetGroup: "노인", region: "", budget: 5_000_000, goal: "고립 감소", count: 3 }, ["ref1"]);
    expect(u).toContain("5,000,000원");
    expect(u).toContain("ref1");
  });
  it("서식 프롬프트는 종류별 형식을 쓰고 사실 날조를 금지한다", () => {
    const { system } = buildDocPrompt({ type: "report", title: "t", org: "", facts: "f" });
    expect(system).toContain("결과보고서 형식");
    expect(system).toContain("[확인 필요");
  });
  it("마크다운 코드펜스를 벗긴다", () => {
    expect(cleanDocOutput("```markdown\n본문\n```")).toBe("본문");
  });
});

describe("tools API 검증", () => {
  it("비로그인은 거부", async () => {
    await expect(appRouter.createCaller(ctx(null)).tools.draftDocument({ type: "draft", title: "t", facts: "f" })).rejects.toThrow();
  });
  it("잘못된 문서 종류는 거부", async () => {
    await expect(appRouter.createCaller(ctx(user)).tools.draftDocument({ type: "x" as any, title: "t", facts: "f" })).rejects.toThrow();
  });
  it("예산 0은 거부", async () => {
    await expect(appRouter.createCaller(ctx(user)).tools.programIdeas({ targetGroup: "노인", budget: 0, goal: "g", count: 3, region: "" })).rejects.toThrow();
  });
});
