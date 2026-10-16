import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

const sent: any[] = [];
const state = { link: null as null | { userId: number; chatId: string }, user: { id: 7, name: "뇌로", status: "approved", role: "user" } as any, codeUser: 7 as number | null };
const createSchedule = vi.fn(async () => 1);
let llmReply = "";
let aiError: Error | null = null;

vi.mock("./telegramDb", () => ({
  getLinkByChat: vi.fn(async () => state.link),
  consumeLinkCode: vi.fn(async (code: string) => (code === "12345678" ? state.codeUser : null)),
  unlinkUser: vi.fn(async () => { state.link = null; }),
}));
vi.mock("./auth-local", () => ({ findUserById: vi.fn(async () => state.user) }));
vi.mock("./db", () => ({
  createSchedule: (...a: any[]) => (createSchedule as any)(...a),
  getParentProjects: vi.fn(async () => [{ id: 3, projectName: "한국어교실" }]),
  getUpcomingSchedules: vi.fn(async () => []),
}));
vi.mock("./aiGate", () => ({ runWithAi: vi.fn(async (_u: number, _f: string, fn: () => Promise<any>) => { if (aiError) throw aiError; return fn(); }) }));
vi.mock("./simpleLlm", () => ({ simpleLLM: vi.fn(async () => llmReply) }));
vi.mock("./orgStyleDb", () => ({ getOrgStyle: vi.fn(async () => null) }));
vi.mock("./reportData", () => ({ gatherReportFacts: vi.fn(async () => ({ uniquePeople: 4, subs: [{ actualExtended: 20, actualCount: 5 }] })) }));

beforeEach(() => {
  sent.length = 0;
  state.link = null;
  state.user = { id: 7, name: "뇌로", status: "approved", role: "user" };
  aiError = null;
  createSchedule.mockClear();
  process.env.TELEGRAM_BOT_TOKEN = "123:test";
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: any) => {
    sent.push({ url: _url, body: JSON.parse(init.body) });
    return { ok: true, json: async () => ({ ok: true, result: {} }) } as any;
  }));
});

const msg = (text: string, chatId = 100, type = "private") => ({ message_id: 1, chat: { id: chatId, type }, from: { username: "u" }, text });
const texts = () => sent.filter((s) => s.url.endsWith("sendMessage")).map((s) => s.body.text as string);

describe("텔레그램 봇 흐름", () => {
  it("연결 전에는 안내만 하고 기능을 쓰지 못한다", async () => {
    const { handleMessage } = await import("./telegramBot");
    await handleMessage(msg("/번역 영어: 안녕하세요 공지입니다"));
    expect(texts()[0]).toContain("연결되지 않았습니다");
  });

  it("그룹 대화에서는 거부한다", async () => {
    const { handleMessage } = await import("./telegramBot");
    await handleMessage(msg("/도움말", 200, "group"));
    expect(texts()[0]).toContain("1:1");
  });

  it("맞는 코드는 연결되고, 틀린 코드는 거부한다", async () => {
    const { handleMessage } = await import("./telegramBot");
    await handleMessage(msg("/연결 99999999", 101));
    expect(texts()[0]).toContain("맞지 않거나 만료");
    sent.length = 0;
    await handleMessage(msg("/연결 12345678", 102));
    expect(texts()[0]).toContain("연결되었습니다");
  });

  it("번역은 요청한 언어만 돌려주고 AI 번역 경고를 붙인다", async () => {
    const { handleMessage } = await import("./telegramBot");
    state.link = { userId: 7, chatId: "103" };
    llmReply = JSON.stringify({ translations: [{ lang: "en", text: "Hello" }, { lang: "vi", text: "Xin chào" }] });
    await handleMessage(msg("/번역 영어 베트남어: 11월 6일 개강합니다", 103));
    const t = texts().join("\n");
    expect(t).toContain("【영어】");
    expect(t).toContain("Xin chào");
    expect(t).toContain("AI 번역");
  });

  it("일정은 미리보기 후 등록 버튼을 눌러야 저장된다", async () => {
    const { handleMessage, handleCallback } = await import("./telegramBot");
    state.link = { userId: 7, chatId: "104" };
    llmReply = JSON.stringify({ items: [{ title: "개강식", startDate: "2099-11-08", endDate: "2099-11-08", time: "14:00", description: "", projectId: 3, color: "blue" }] });
    await handleMessage(msg("/일정 11월 8일 오후 2시 개강식", 104));
    const preview = sent.find((s) => s.body.reply_markup);
    expect(preview.body.text).toContain("개강식");
    expect(createSchedule).not.toHaveBeenCalled();
    await handleCallback({ id: "cb1", data: "sch:ok", message: { chat: { id: 104 } } });
    expect(createSchedule).toHaveBeenCalledTimes(1);
    // 같은 버튼을 또 눌러도 중복 등록되지 않는다
    await handleCallback({ id: "cb2", data: "sch:ok", message: { chat: { id: 104 } } });
    expect(createSchedule).toHaveBeenCalledTimes(1);
  });

  it("이용 제한에 걸리면 이유를 알려준다(접두어 제거)", async () => {
    const { handleMessage } = await import("./telegramBot");
    state.link = { userId: 7, chatId: "105" };
    aiError = new TRPCError({ code: "FORBIDDEN", message: "[이용제한] 이용 기간이 끝났습니다." });
    await handleMessage(msg("/홍보 인스타 11월 8일 운동회", 105));
    expect(texts()[0]).toBe("이용 기간이 끝났습니다.");
  });

  it("승인되지 않은 계정은 쓸 수 없다", async () => {
    const { handleMessage } = await import("./telegramBot");
    state.link = { userId: 7, chatId: "106" };
    state.user = { id: 7, status: "pending", role: "user" };
    await handleMessage(msg("/요약", 106));
    expect(texts()[0]).toContain("이용할 수 없는 계정");
  });

  it("요약은 AI 없이 사업별 실인원·연인원을 보여준다", async () => {
    const { handleMessage } = await import("./telegramBot");
    state.link = { userId: 7, chatId: "107" };
    await handleMessage(msg("/요약", 107));
    expect(texts().join("\n")).toContain("실인원 4명 · 연인원 20명 · 5회");
  });

  it("같은 update_id는 한 번만 처리한다", async () => {
    const { handleUpdate } = await import("./telegramBot");
    await handleUpdate({ update_id: 9001, message: msg("/도움말", 108) });
    const n = sent.length;
    await handleUpdate({ update_id: 9001, message: msg("/도움말", 108) });
    expect(sent.length).toBe(n);
  });
});
