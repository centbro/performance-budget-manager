import { describe, expect, it } from "vitest";
import { checkAiAccess, monthStartKst, FAIR_USE_MONTHLY_CALLS } from "../shared/plans";

const base = { role: "user", plan: "pro", accessUntil: null, usedThisFeature: 0, usedTotal: 0, now: new Date("2026-10-16T03:00:00Z") } as const;

describe("checkAiAccess", () => {
  it("관리자는 항상 허용", () => {
    expect(checkAiAccess({ ...base, role: "admin", feature: "plan_generate", accessUntil: new Date("2020-01-01") }).ok).toBe(true);
  });
  it("만료되면 AI 차단(이용제한 접두어)", () => {
    const d = checkAiAccess({ ...base, feature: "promo", accessUntil: new Date("2026-10-15T14:59:59Z") });
    expect(d.ok).toBe(false);
    if (!d.ok) { expect(d.reason).toBe("expired"); expect(d.message.startsWith("[이용제한]")).toBe(true); }
  });
  it("프로는 사업계획서 생성·점수 평가 불가, 프리미엄은 가능", () => {
    for (const f of ["plan_generate", "plan_chat", "grant_review"] as const) {
      expect(checkAiAccess({ ...base, feature: f }).ok).toBe(false);
      expect(checkAiAccess({ ...base, plan: "premium", feature: f }).ok).toBe(true);
    }
  });
  it("아이디어: 프로 월 20회, 프리미엄 무제한", () => {
    expect(checkAiAccess({ ...base, feature: "ideas", usedThisFeature: 19 }).ok).toBe(true);
    const d = checkAiAccess({ ...base, feature: "ideas", usedThisFeature: 20 });
    expect(d.ok).toBe(false);
    expect(checkAiAccess({ ...base, plan: "premium", feature: "ideas", usedThisFeature: 5000 }).ok).toBe(true);
  });
  it("공정 사용 한도", () => {
    const d = checkAiAccess({ ...base, plan: "premium", feature: "promo", usedTotal: FAIR_USE_MONTHLY_CALLS });
    expect(d.ok).toBe(false);
  });
  it("알 수 없는 요금제는 프로로 취급", () => {
    expect(checkAiAccess({ ...base, plan: "x", feature: "plan_generate" }).ok).toBe(false);
  });
  it("이번 달 1일(KST) 계산", () => {
    expect(monthStartKst(new Date("2026-10-31T16:00:00Z")).toISOString()).toBe("2026-10-31T15:00:00.000Z"); // 11/1 00:00 KST
    expect(monthStartKst(new Date("2026-10-16T03:00:00Z")).toISOString()).toBe("2026-09-30T15:00:00.000Z");
  });
});
