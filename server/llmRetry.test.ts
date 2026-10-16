import { afterEach, describe, expect, it, vi } from "vitest";

process.env.GEMINI_API_KEY = "k";
const ok = () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "{}" } }] }) }) as any;
const bad = (status: number) => ({ ok: false, status, statusText: "x", text: async () => "err" }) as any;

afterEach(() => vi.unstubAllGlobals());

describe("invokeLLM 재시도", () => {
  it("503이 한 번 나도 재시도해서 성공한다", async () => {
    const f = vi.fn().mockResolvedValueOnce(bad(503)).mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", f);
    const { invokeLLM } = await import("./_core/llm");
    const r = await invokeLLM({ messages: [{ role: "user", content: "hi" }] });
    expect(r.choices[0].message.content).toBe("{}");
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("400은 재시도하지 않고, 계속 429면 3번 뒤 사유가 담긴 오류", async () => {
    const f400 = vi.fn().mockResolvedValue(bad(400));
    vi.stubGlobal("fetch", f400);
    const { invokeLLM, llmFailureMessage } = await import("./_core/llm");
    await expect(invokeLLM({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow();
    expect(f400).toHaveBeenCalledTimes(1);
    const f429 = vi.fn().mockResolvedValue(bad(429));
    vi.stubGlobal("fetch", f429);
    const e = await invokeLLM({ messages: [{ role: "user", content: "hi" }] }).catch((x) => x);
    expect(f429).toHaveBeenCalledTimes(3);
    expect(llmFailureMessage(e)).toContain("몰렸습니다");
  });
});

describe("예비 모델", () => {
  it("기본 모델이 계속 503이면 예비 모델로 한 번 더 시도한다", async () => {
    process.env.GEMINI_MODEL_FALLBACK = "backup-model";
    vi.resetModules();
    const models: string[] = [];
    const f = vi.fn(async (_u: string, init: any) => {
      const m = JSON.parse(init.body).model; models.push(m);
      return m === "backup-model" ? ok() : bad(503);
    });
    vi.stubGlobal("fetch", f);
    const { invokeLLM } = await import("./_core/llm");
    const r = await invokeLLM({ messages: [{ role: "user", content: "hi" }] });
    expect(r.choices[0].message.content).toBe("{}");
    expect(models.filter((m) => m !== "backup-model").length).toBe(3);
    expect(models[models.length - 1]).toBe("backup-model");
    delete process.env.GEMINI_MODEL_FALLBACK;
  });
});
