import { describe, expect, it } from "vitest";
import { pingTypeOf } from "./activityPing";

describe("활동 알림 종류", () => {
  it("기능별로 plan·doc·case·chat 중 하나로 나뉜다", () => {
    expect(pingTypeOf("plan_generate")).toBe("plan");
    expect(pingTypeOf("doc_chat")).toBe("doc");
    expect(pingTypeOf("case_record")).toBe("case");
    expect(pingTypeOf("ideas")).toBe("chat");
    expect(pingTypeOf("bot_chat")).toBe("chat");
  });
});

describe("자동 승인 도우미", () => {
  it("체험 만료일은 14일 뒤, 오늘 시작은 한국 시간 0시", async () => {
    const { trialUntil, kstDayStart } = await import("./auth-local");
    const now = new Date("2026-11-05T10:30:00Z");
    expect(trialUntil(now).toISOString()).toBe("2026-11-19T10:30:00.000Z");
    expect(kstDayStart(now).toISOString()).toBe("2026-11-04T15:00:00.000Z");
    expect(kstDayStart(new Date("2026-11-05T14:59:00Z")).toISOString()).toBe("2026-11-04T15:00:00.000Z");
    expect(kstDayStart(new Date("2026-11-05T15:01:00Z")).toISOString()).toBe("2026-11-05T15:00:00.000Z");
  });
});
