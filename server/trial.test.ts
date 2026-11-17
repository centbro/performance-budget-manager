import { describe, expect, it } from "vitest";
import { trialLabel, trialUntil } from "../shared/trial";

describe("신규 가입 무료 기간", () => {
  it("올해 말까지는 12월 31일 23:59:59(한국 시간)까지 무료", () => {
    expect(trialUntil(new Date("2026-11-17T03:00:00Z")).toISOString()).toBe("2026-12-31T14:59:59.000Z");
    expect(trialUntil(new Date("2026-12-31T14:00:00Z")).toISOString()).toBe("2026-12-31T14:59:59.000Z");
    expect(trialLabel(new Date("2026-11-17T03:00:00Z"))).toContain("2026년 12월 31일까지");
  });
  it("무료 기간이 끝난 뒤 가입하면 14일 체험", () => {
    const now = new Date("2027-01-05T00:00:00Z");
    expect(trialUntil(now).toISOString()).toBe("2027-01-19T00:00:00.000Z");
    expect(trialLabel(now)).toContain("14일");
  });
});
