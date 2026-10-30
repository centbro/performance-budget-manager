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
