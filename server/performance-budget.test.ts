import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import { isOwnedProject } from "./projectAccess";
import { resolveEvaluationPeriod } from "./evaluationPeriod";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: Array<{ name: string; options: Record<string, unknown> }> } {
  const clearedCookies: Array<{ name: string; options: Record<string, unknown> }> = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "local",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1 });
  });
});

describe("Project ownership isolation", () => {
  it("only allows the owning account to manage a project", () => {
    const project = { userId: 7, parentId: null };
    expect(isOwnedProject(project, 7)).toBe(true);
    expect(isOwnedProject(project, 8)).toBe(false);
  });

  it("only allows an owned parent project as a sub-project container", () => {
    expect(isOwnedProject({ userId: 7, parentId: null }, 7, { parentOnly: true })).toBe(true);
    expect(isOwnedProject({ userId: 7, parentId: 42 }, 7, { parentOnly: true })).toBe(false);
    expect(isOwnedProject({ userId: 8, parentId: null }, 7, { parentOnly: true })).toBe(false);
  });
});

describe("Budget calculation logic", () => {
  it("correctly calculates quarter from date", () => {
    const getQuarter = (dateStr: string) => {
      const month = parseInt(dateStr.slice(5, 7), 10);
      if (month <= 3) return 1;
      if (month <= 6) return 2;
      if (month <= 9) return 3;
      return 4;
    };
    expect(getQuarter("2026-01-15")).toBe(1);
    expect(getQuarter("2026-04-01")).toBe(2);
    expect(getQuarter("2026-07-31")).toBe(3);
    expect(getQuarter("2026-10-01")).toBe(4);
    expect(getQuarter("2026-12-31")).toBe(4);
  });

  it("correctly splits total budget into quarters", () => {
    const splitBudget = (total: number) => {
      const quarter = Math.floor(total / 4);
      const remainder = total - quarter * 4;
      return {
        q1: quarter + remainder,
        q2: quarter,
        q3: quarter,
        q4: quarter,
      };
    };
    const result = splitBudget(10000000);
    expect(result.q1 + result.q2 + result.q3 + result.q4).toBe(10000000);
    expect(result.q2).toBe(result.q3);
    expect(result.q3).toBe(result.q4);
  });

  it("calculates usage rate correctly", () => {
    const usageRate = (spent: number, budget: number) =>
      budget > 0 ? Math.round((spent / budget) * 100) : 0;
    expect(usageRate(500000, 1000000)).toBe(50);
    expect(usageRate(1000000, 1000000)).toBe(100);
    expect(usageRate(0, 1000000)).toBe(0);
    expect(usageRate(0, 0)).toBe(0);
  });
});

describe("BusinessPlan chat progression logic", () => {
  const QUESTIONS = [
    { question: "Q1", hint: "hint1" },
    { question: "Q2", hint: "hint2" },
    { question: "Q3", hint: "" },
  ];

  const simulateChat = (answeredCount: number) => {
    // answeredCount: 이미 저장된 답변 수 (이번 답변 저장 전)
    const newAnsweredCount = answeredCount + 1;
    const nextQuestion = QUESTIONS[newAnsweredCount];
    const hasMoreQuestions = newAnsweredCount < QUESTIONS.length;
    return { nextQuestion, hasMoreQuestions, newAnsweredCount };
  };

  it("첫 번째 답변 후 두 번째 질문을 안내한다", () => {
    const { nextQuestion, hasMoreQuestions } = simulateChat(0);
    expect(hasMoreQuestions).toBe(true);
    expect(nextQuestion?.question).toBe("Q2");
  });

  it("두 번째 답변 후 세 번째 질문을 안내한다", () => {
    const { nextQuestion, hasMoreQuestions } = simulateChat(1);
    expect(hasMoreQuestions).toBe(true);
    expect(nextQuestion?.question).toBe("Q3");
  });

  it("마지막 답변 후 섹션 완료 안내를 한다", () => {
    const { hasMoreQuestions } = simulateChat(2);
    expect(hasMoreQuestions).toBe(false);
  });

  it("첫 번째 답변 후 첫 번째 질문이 다시 나오지 않는다 (중복 방지)", () => {
    const { nextQuestion } = simulateChat(0);
    expect(nextQuestion?.question).not.toBe("Q1");
  });
});

describe("Performance achievement rate logic", () => {
  it("calculates achievement rate correctly", () => {
    const achievementRate = (actual: number, planned: number) =>
      planned > 0 ? Math.min(Math.round((actual / planned) * 100), 999) : null;
    expect(achievementRate(50, 100)).toBe(50);
    expect(achievementRate(100, 100)).toBe(100);
    expect(achievementRate(120, 100)).toBe(120);
    expect(achievementRate(0, 0)).toBeNull();
  });

  it("correctly identifies unique participants by gender", () => {
    const participants = [
      { id: 1, gender: "male" },
      { id: 2, gender: "female" },
      { id: 3, gender: "male" },
      { id: 1, gender: "male" }, // duplicate
    ];
    const uniqueMap = new Map<number, string>();
    participants.forEach((p) => uniqueMap.set(p.id, p.gender));
    const maleCount = [...uniqueMap.values()].filter((g) => g === "male").length;
    const femaleCount = [...uniqueMap.values()].filter((g) => g === "female").length;
    expect(maleCount).toBe(2);
    expect(femaleCount).toBe(1);
    expect(uniqueMap.size).toBe(3);
  });
});

describe("AI evaluation custom month period", () => {
  it("returns only the selected consecutive months", () => {
    expect(resolveEvaluationPeriod("custom", 3, 5)).toEqual({
      label: "3~5월",
      months: [3, 4, 5],
    });
  });

  it("supports a single month", () => {
    expect(resolveEvaluationPeriod("custom", 8, 8)).toEqual({
      label: "8~8월",
      months: [8],
    });
  });

  it("rejects an inverted custom range", () => {
    expect(() => resolveEvaluationPeriod("custom", 7, 4)).toThrow();
  });

  it("keeps predefined period behavior unchanged", () => {
    expect(resolveEvaluationPeriod("q2")).toEqual({
      label: "2분기(4~6월)",
      months: [4, 5, 6],
    });
  });
});
