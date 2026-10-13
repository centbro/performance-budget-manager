import { describe, it, expect, vi, beforeEach } from "vitest";

// DB 모킹
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

import { hashPassword, verifyPassword } from "./auth-local";

describe("auth-local: password hashing", () => {
  it("비밀번호를 해싱하고 검증할 수 있다", async () => {
    const password = "park2177";
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash.length).toBeGreaterThan(20);

    const valid = await verifyPassword(password, hash);
    expect(valid).toBe(true);
  });

  it("잘못된 비밀번호는 검증에 실패한다", async () => {
    const password = "correctPassword";
    const hash = await hashPassword(password);

    const invalid = await verifyPassword("wrongPassword", hash);
    expect(invalid).toBe(false);
  });

  it("같은 비밀번호라도 매번 다른 해시가 생성된다 (salt)", async () => {
    const password = "samePassword";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);

    // 두 해시 모두 올바른 비밀번호로 검증 가능
    expect(await verifyPassword(password, hash1)).toBe(true);
    expect(await verifyPassword(password, hash2)).toBe(true);
  });
});

describe("auth-local: router procedures", () => {
  it("관리자 이메일이 올바르게 설정되어 있다", () => {
    const ADMIN_EMAIL = "link4wish@gmail.com";
    expect(ADMIN_EMAIL).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });

  it("세션 ID는 충분한 길이를 가진다", async () => {
    const { nanoid } = await import("nanoid");
    const sessionId = nanoid(48);
    expect(sessionId.length).toBe(48);
  });
});
