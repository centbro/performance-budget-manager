import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

const sent: any[] = [];
const state = { link: null as null | { userId: number; chatId: string }, user: { id: 7, name: "뇌로", status: "approved", role: "user" } as any, codeUser: 7 as number | null, admins: [] as string[] };
const createSchedule = vi.fn(async () => 1);
let llmReply = "";
const llmQueue: string[] = [];
let aiError: Error | null = null;

vi.mock("./telegramDb", () => ({
  getLinkByChat: vi.fn(async () => state.link),
  consumeLinkCode: vi.fn(async (code: string) => (code === "12345678" ? state.codeUser : null)),
  unlinkUser: vi.fn(async () => { state.link = null; }),
  adminChatIds: vi.fn(async () => state.admins),
  countPendingUsers: vi.fn(async () => 3),
}));
vi.mock("./auth-local", () => ({ findUserById: vi.fn(async () => state.user) }));
vi.mock("./db", () => ({
  createSchedule: (...a: any[]) => (createSchedule as any)(...a),
  getParentProjects: vi.fn(async () => [{ id: 3, projectName: "한국어교실" }]),
  getUpcomingSchedules: vi.fn(async () => []),
}));
vi.mock("./aiGate", () => ({ runWithAi: vi.fn(async (_u: number, _f: string, fn: () => Promise<any>) => { if (aiError) throw aiError; return fn(); }) }));
vi.mock("./simpleLlm", () => ({ simpleLLM: vi.fn(async () => (llmQueue.length ? llmQueue.shift()! : llmReply)) }));
vi.mock("./orgStyleDb", () => ({ getOrgStyle: vi.fn(async () => null) }));
vi.mock("./reportData", () => ({ gatherReportFacts: vi.fn(async () => ({ uniquePeople: 4, subs: [{ actualExtended: 20, actualCount: 5 }] })) }));

beforeEach(() => {
  sent.length = 0;
  llmQueue.length = 0;
  state.link = null;
  state.user = { id: 7, name: "뇌로", status: "approved", role: "user" };
  aiError = null;
  state.admins = [];
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

  it("새 가입 신청이 오면 연결된 관리자에게 알린다", async () => {
    const { notifyNewSignup } = await import("./telegramBot");
    state.admins = ["900", "901"];
    await notifyNewSignup("홍길동", "hong@example.com");
    const to = sent.filter((s) => s.url.endsWith("sendMessage"));
    expect(to.map((s) => s.body.chat_id).sort()).toEqual(["900", "901"]);
    expect(to[0].body.text).toContain("홍길동");
    expect(to[0].body.text).toContain("hong@example.com");
    expect(to[0].body.text).toContain("승인 대기 3명");
    expect(to[0].body.text).toContain("/admin");
  });

  it("텔레그램이 연결된 관리자가 없으면 아무것도 보내지 않는다", async () => {
    const { notifyNewSignup } = await import("./telegramBot");
    await notifyNewSignup("홍길동", "hong@example.com");
    expect(sent).toHaveLength(0);
  });

  it("봇이 꺼져 있으면(토큰 없음) 조용히 넘어간다", async () => {
    const { notifyNewSignup } = await import("./telegramBot");
    state.admins = ["900"];
    delete process.env.TELEGRAM_BOT_TOKEN;
    await notifyNewSignup("홍길동", "hong@example.com");
    expect(sent).toHaveLength(0);
  });
});

describe("텔레그램 자연어 대화", () => {
  const link = (id: number) => { state.link = { userId: 7, chatId: String(id) }; };

  it("'이번 주 일정 알려줘'는 AI 없이 바로 조회한다", async () => {
    const { handleMessage } = await import("./telegramBot");
    link(301);
    llmReply = "SHOULD_NOT_BE_USED";
    await handleMessage(msg("이번 주 일정 알려줘", 301));
    expect(texts()[0]).toContain("일정이 없습니다");
  });

  it("일정 문장을 해석해 확인 버튼과 함께 미리보기를 보여 준다", async () => {
    const { handleMessage } = await import("./telegramBot");
    link(302);
    llmQueue.push(JSON.stringify({ intent: "schedule", text: "11월 8일 오후 2시 한국어교실 개강식" }));
    llmQueue.push(JSON.stringify({ items: [{ title: "한국어교실 개강식", startDate: "2026-11-08", endDate: "2026-11-08", time: "14:00", projectId: 3 }] }));
    await handleMessage(msg("11월 8일 오후 2시 한국어교실 개강식 잡아줘", 302));
    expect(texts().join("\n")).toContain("이렇게 등록할까요");
    expect(createSchedule).not.toHaveBeenCalled();
  });

  it("정보가 부족하면 되묻고, 이어진 답을 합쳐 처리한다", async () => {
    const { handleMessage } = await import("./telegramBot");
    link(303);
    llmQueue.push(JSON.stringify({ intent: "chat", reply: "어떤 행사인가요? 날짜와 대상도 알려 주세요." }));
    await handleMessage(msg("홍보글 써줘", 303));
    expect(texts()[0]).toContain("어떤 행사");
    sent.length = 0;
    llmQueue.push(JSON.stringify({ intent: "promo", channel: "인스타", text: "11월 8일 운동회, 외국인 근로자 대상" }));
    llmQueue.push(JSON.stringify({ variants: [{ title: "운동회", body: "함께해요", hashtags: ["#운동회"] }] }));
    await handleMessage(msg("11월 8일 운동회야 외국인 근로자 대상, 인스타로", 303));
    expect(texts().join("\n")).toContain("운동회");
  });

  it("번역 언어를 말하지 않으면 어떤 언어인지 되묻는다", async () => {
    const { handleMessage } = await import("./telegramBot");
    link(304);
    llmQueue.push(JSON.stringify({ intent: "translate", languages: [], text: "11월 6일 19시 한국어교실 개강합니다" }));
    await handleMessage(msg("이거 번역해줘 11월 6일 19시 한국어교실 개강합니다", 304));
    expect(texts()[0]).toContain("어떤 언어");
  });

  it("AI가 엉뚱한 형식을 주면 안전하게 되묻는다", async () => {
    const { handleMessage } = await import("./telegramBot");
    link(305);
    llmQueue.push("죄송합니다 잘 모르겠어요");
    await handleMessage(msg("음 그게 말이지", 305));
    expect(texts()[0]).toContain("무엇을 도와드릴까요");
  });

  it("이용 제한 상태에서는 접두어를 떼고 안내한다", async () => {
    const { handleMessage } = await import("./telegramBot");
    link(306);
    aiError = new TRPCError({ code: "FORBIDDEN", message: "[이용제한] 이용 기간이 만료되었습니다" });
    await handleMessage(msg("홍보글 써줘 인스타로 운동회", 306));
    expect(texts()[0]).toContain("이용 기간이 만료");
    expect(texts()[0]).not.toContain("[이용제한]");
  });
});
