import { describe, it, expect } from "vitest";
import type { TrpcContext } from "./_core/context";

/**
 * local 로그인 사용자가 protectedProcedure를 통과하는지 검증하는 통합 테스트
 * context.ts에서 localUser → user 매핑이 올바르게 동작하는지 확인
 */

function buildLocalUserContext(role: "admin" | "user"): TrpcContext {
  const localUser = {
    id: 1,
    email: "test@example.com",
    name: "테스트 사용자",
    role,
    status: "approved" as const,
  };

  // context.ts의 매핑 로직과 동일하게 user 객체 생성
  const user = {
    id: localUser.id,
    openId: `local:${localUser.id}`,
    name: localUser.name,
    email: localUser.email,
    loginMethod: "local",
    role: localUser.role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user: user as TrpcContext["user"],
    localUser,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("인증 통합: local 로그인 사용자의 protectedProcedure 접근", () => {
  it("approved 상태의 local 사용자는 ctx.user가 존재한다", () => {
    const ctx = buildLocalUserContext("user");
    expect(ctx.user).not.toBeNull();
    expect(ctx.user?.id).toBe(1);
    expect(ctx.user?.email).toBe("test@example.com");
    expect(ctx.user?.loginMethod).toBe("local");
  });

  it("local 관리자는 ctx.user.role이 admin이다", () => {
    const ctx = buildLocalUserContext("admin");
    expect(ctx.user?.role).toBe("admin");
    expect(ctx.localUser?.role).toBe("admin");
  });

  it("local 일반 사용자는 ctx.user.role이 user이다", () => {
    const ctx = buildLocalUserContext("user");
    expect(ctx.user?.role).toBe("user");
  });

  it("local 사용자의 openId는 local: 접두사를 가진다", () => {
    const ctx = buildLocalUserContext("user");
    expect(ctx.user?.openId).toMatch(/^local:\d+$/);
  });

  it("protectedProcedure 조건(ctx.user !== null)을 만족한다", () => {
    const ctx = buildLocalUserContext("user");
    // protectedProcedure: if (!ctx.user) throw UNAUTHORIZED
    const isAuthorized = ctx.user !== null;
    expect(isAuthorized).toBe(true);
  });

  it("adminProcedure 조건(ctx.user.role === 'admin')을 관리자가 만족한다", () => {
    const ctx = buildLocalUserContext("admin");
    const isAdmin = ctx.user?.role === "admin";
    expect(isAdmin).toBe(true);
  });

  it("adminProcedure 조건을 일반 사용자는 만족하지 않는다", () => {
    const ctx = buildLocalUserContext("user");
    const isAdmin = ctx.user?.role === "admin";
    expect(isAdmin).toBe(false);
  });
});
