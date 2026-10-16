import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function ctxWith(user: TrpcContext["user"]): TrpcContext {
  return { user, localUser: null, req: { protocol: "https", headers: {} } as any, res: {} as any };
}
const user = {
  id: 7, openId: "local:7", email: "a@b.c", name: "t", loginMethod: "local",
  role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
} as NonNullable<TrpcContext["user"]>;

describe("cases API", () => {
  it("로그인하지 않으면 사례 검색을 거부한다", async () => {
    await expect(appRouter.createCaller(ctxWith(null)).cases.search({ query: "노인" })).rejects.toThrow();
  });
  it("로그인하면 검색 결과를 돌려준다", async () => {
    const r = await appRouter.createCaller(ctxWith(user)).cases.search({ query: "이주배경청소년", limit: 5 });
    expect(r.length).toBeGreaterThan(0);
    expect(r.length).toBeLessThanOrEqual(5);
  });
});

describe("quickGenerate 입력 검증", () => {
  const caller = appRouter.createCaller(ctxWith(user));
  const ok = {
    title: "t", year: 2026, targetDescription: "d", targetCount: 10, budget: 1000, desiredEffect: "e",
  };
  it("예산이 0이면 LLM 호출 전에 거부한다", async () => {
    await expect(caller.businessPlans.quickGenerate({ ...ok, budget: 0 })).rejects.toThrow();
  });
  it("비로그인은 거부한다", async () => {
    await expect(appRouter.createCaller(ctxWith(null)).businessPlans.quickGenerate(ok)).rejects.toThrow();
  });
});
