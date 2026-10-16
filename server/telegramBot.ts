import { TRPCError } from "@trpc/server";
import { BLOCK_PREFIX } from "../shared/plans";
import { MAX_NOTICE_LANGS } from "../shared/languages";
import { runWithAi } from "./aiGate";
import { findUserById } from "./auth-local";
import { createSchedule, getParentProjects, getUpcomingSchedules } from "./db";
import { buildPromoPrompt, parsePromo } from "./promo";
import { buildSchedulePrompt, parseScheduleItems, withTime, type ParsedSchedule } from "./scheduleParse";
import { buildTranslatePrompt, parseTranslations } from "./translateNotice";
import { buildStyleBlock } from "./orgStyle";
import { getOrgStyle } from "./orgStyleDb";
import { gatherReportFacts } from "./reportData";
import { simpleLLM } from "./simpleLlm";
import { adminChatIds, consumeLinkCode, countPendingUsers, getLinkByChat, unlinkUser } from "./telegramDb";
import {
  CHANNEL_HELP, LANGUAGE_HELP, PendingStore, RateLimiter, SeenSet, formatDateRange, isLinkCode, kstDate, parseCommand,
  parsePromoArgs, parseTranslateArgs, secretFromToken, splitMessage,
} from "./telegram";

const TOKEN = () => process.env.TELEGRAM_BOT_TOKEN ?? "";
export const telegramEnabled = () => !!TOKEN();
export const webhookSecret = () => secretFromToken(TOKEN(), process.env.TELEGRAM_WEBHOOK_SECRET);
let botUsername = process.env.TELEGRAM_BOT_USERNAME ?? "";
export const getBotUsername = () => botUsername;

async function api(method: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as any;
  if (!json?.ok) console.warn(`[telegram] ${method} failed`, json?.description ?? res.status);
  return json;
}

async function send(chatId: string, text: string, extra: Record<string, unknown> = {}) {
  const parts = splitMessage(text || "(내용 없음)");
  for (let i = 0; i < parts.length; i++) {
    await api("sendMessage", { chat_id: chatId, text: parts[i], disable_web_page_preview: true, ...(i === parts.length - 1 ? extra : {}) });
  }
}

const todayKst = () => kstDate(new Date());
const limiter = new RateLimiter(12, 60_000);       // 대화당 분당 12건
const linkAttempts = new RateLimiter(5, 10 * 60_000); // 연결 코드 입력 시도: 10분에 5회
const seen = new SeenSet();
const pendingSchedules = new PendingStore<ParsedSchedule[]>(10 * 60_000);

export const HELP_TEXT = `복지실무톡 봇입니다.

[일정]
/일정 11월 8일 오후 2시 한국어교실 개강식
/오늘 · /이번주

[글쓰기]
/홍보 인스타 11월 8일 운동회, 외국인 근로자 대상, 무료
/소식 블로그 지난 주 한국어교실 수료식 진행
(채널: ${CHANNEL_HELP})

[번역]
/번역 영어 베트남어: 11월 6일 19시 한국어교실 개강, 준비물 외국인등록증
(언어를 안 쓰면 영어+베트남어)

[요약]
/요약 — 이번 달 사업별 실인원·연인원

[계정]
/해제 — 텔레그램 연결 끊기

※ 참여자 이름·연락처·상담 내용은 보내지 마세요.`;

const NEED_LINK = "아직 연결되지 않았습니다.\n1) 웹사이트(www.psk.lol) 로그인 → 내 이용 현황 → '텔레그램 연결' 에서 코드 받기\n2) 여기에 /연결 코드번호 입력";

function explain(e: unknown): string {
  if (e instanceof TRPCError) {
    if (e.code === "FORBIDDEN") return e.message.replace(BLOCK_PREFIX, "");
    if (e.code === "BAD_REQUEST" || e.code === "NOT_FOUND") return e.message;
  }
  console.error("[telegram] command failed", e);
  return "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

type Ctx = { chatId: string; userId: number; today: string };

async function doSchedule(c: Ctx, args: string) {
  if (!args) return send(c.chatId, "일정을 문장으로 적어 주세요.\n예) /일정 11월 8일 오후 2시 한국어교실 개강식");
  const year = Number(c.today.slice(0, 4));
  const projects = [...(await getParentProjects(c.userId, year)), ...(await getParentProjects(c.userId, year + 1))].map((p) => ({ id: p.id, name: p.projectName }));
  const items = await runWithAi(c.userId, "schedule", async () => {
    const { system, user } = buildSchedulePrompt(args, c.today, projects);
    return parseScheduleItems(await simpleLLM(system, user, true, 4000), projects.map((p) => p.id), c.today);
  });
  if (items.length === 0) return send(c.chatId, "날짜가 있는 일정을 찾지 못했습니다. 날짜(예: 11월 8일, 다음 주 화요일)를 함께 적어 주세요.");
  pendingSchedules.set(c.chatId, items);
  const name = (id: number | null) => projects.find((p) => p.id === id)?.name ?? "개인 업무";
  const lines = items.map((it) => `• ${formatDateRange(it.startDate, it.endDate)} ${it.time ? it.time + " " : ""}${it.title}\n  (${name(it.projectId)})`);
  await send(c.chatId, `이렇게 등록할까요?\n\n${lines.join("\n")}`, {
    reply_markup: { inline_keyboard: [[{ text: "✅ 등록", callback_data: "sch:ok" }, { text: "취소", callback_data: "sch:no" }]] },
  });
}

async function doAgenda(c: Ctx, days: number, label: string) {
  const rows = await getUpcomingSchedules(c.userId, days);
  const end = kstDate(new Date(Date.now() + (days - 1) * 86_400_000));
  const mine = rows
    .map((r) => ({ ...r, s: kstDate(r.startDate as any), e: kstDate(r.endDate as any) }))
    .filter((r) => r.s <= end && r.e >= c.today);
  if (mine.length === 0) return send(c.chatId, `${label} 일정이 없습니다.`);
  await send(c.chatId, `${label} 일정 ${mine.length}건\n\n` + mine.map((r) => `• ${formatDateRange(r.s, r.e)} ${r.title}${r.projectName ? ` (${r.projectName})` : ""}`).join("\n"));
}

async function doPromo(c: Ctx, kind: "recruit" | "news", args: string) {
  const p = parsePromoArgs(args);
  if (!p) return send(c.chatId, `채널과 내용을 적어 주세요.\n예) /${kind === "news" ? "소식" : "홍보"} 인스타 11월 8일 운동회, 외국인 근로자 대상\n채널: ${CHANNEL_HELP}`);
  const style = await getOrgStyle(c.userId);
  const v = await runWithAi(c.userId, "promo", async () => {
    const { system, user } = buildPromoPrompt({ kind, channel: p.channel, org: style?.orgName ?? "", facts: p.facts.slice(0, 3000), count: 1 }, []);
    return parsePromo(await simpleLLM(system + buildStyleBlock(style), user, true, 4000))[0];
  });
  if (!v) return send(c.chatId, "글을 만들지 못했습니다. 내용을 조금 더 자세히 적어 다시 시도해 주세요.");
  await send(c.chatId, [v.title, v.body, v.hashtags.join(" ")].filter(Boolean).join("\n\n") + "\n\n— 다른 안과 수정은 웹사이트 '홍보·소식글'에서 할 수 있어요. [확인 필요] 표시는 직접 채워 주세요.");
}

async function doTranslate(c: Ctx, args: string) {
  const { langs, text, truncated } = parseTranslateArgs(args);
  if (text.length < 5) return send(c.chatId, `번역할 안내문을 적어 주세요.\n예) /번역 영어 베트남어: 11월 6일 19시 한국어교실 개강\n언어: ${LANGUAGE_HELP}`);
  const out = await runWithAi(c.userId, "translate", async () => {
    const { system, user } = buildTranslatePrompt({ text: text.slice(0, 3000), langs, easyKorean: false });
    return parseTranslations(await simpleLLM(system, user, true, 8000), langs);
  });
  if (out.translations.length === 0) return send(c.chatId, "번역하지 못했습니다. 다시 시도해 주세요.");
  const notes = truncated ? `\n(언어는 한 번에 ${MAX_NOTICE_LANGS}개까지만 처리했습니다)` : "";
  await send(c.chatId, out.translations.map((t) => `【${t.label}】\n${t.text}`).join("\n\n") + `\n\n※ AI 번역입니다. 일시·장소 등 핵심 정보를 확인하고, 중요한 공지는 검수 후 보내세요.${notes}`);
}

async function doSummary(c: Ctx) {
  const year = Number(c.today.slice(0, 4));
  const month = Number(c.today.slice(5, 7));
  const parents = await getParentProjects(c.userId, year);
  if (parents.length === 0) return send(c.chatId, `${year}년에 등록된 사업이 없습니다.`);
  const lines: string[] = [];
  let people = 0, ext = 0;
  for (const p of parents.slice(0, 15)) {
    const f = await gatherReportFacts({ parentId: p.id, userId: c.userId, year, period: "custom", customStartMonth: month, customEndMonth: month, includeAttendance: false, includeCases: false });
    if (!f) continue;
    const e = f.subs.reduce((s, x) => s + x.actualExtended, 0);
    const n = f.subs.reduce((s, x) => s + x.actualCount, 0);
    people += f.uniquePeople; ext += e;
    lines.push(`• ${p.projectName}: 실인원 ${f.uniquePeople}명 · 연인원 ${e}명 · ${n}회`);
  }
  await send(c.chatId, `${year}년 ${month}월 실적 (입력된 기록 기준)\n\n${lines.join("\n")}\n\n합계(사업별 단순 합): 실인원 ${people}명 · 연인원 ${ext}명\n※ 사업 간 중복 참여자는 합계에서 중복될 수 있습니다.`);
}

export async function handleMessage(msg: any) {
  const chat = msg?.chat;
  if (!chat || !msg.text) return;
  const chatId = String(chat.id);
  if (chat.type !== "private") {
    await send(chatId, "복지실무톡 봇은 1:1 대화에서만 사용할 수 있습니다.");
    return;
  }
  if (!limiter.allow(chatId)) { await send(chatId, "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."); return; }
  const { cmd, args } = parseCommand(msg.text);

  if (cmd === "link" || (cmd === "" && isLinkCode(args))) {
    if (!linkAttempts.allow(chatId)) { await send(chatId, "연결 시도가 너무 많습니다. 10분 뒤 새 코드로 다시 시도해 주세요."); return; }
    const code = args.replace(/\s/g, "");
    if (!isLinkCode(code)) { await send(chatId, "웹사이트의 '텔레그램 연결'에서 받은 8자리 코드를 함께 입력해 주세요.\n예) /연결 12345678"); return; }
    const userId = await consumeLinkCode(code, chatId, msg.from?.username ?? null);
    if (!userId) { await send(chatId, "코드가 맞지 않거나 만료되었습니다. 웹사이트에서 새 코드를 받아 주세요."); return; }
    const u = await findUserById(userId);
    await send(chatId, `연결되었습니다. ${u?.name ?? ""}님, 반갑습니다!\n\n${HELP_TEXT}`);
    return;
  }

  const link = await getLinkByChat(chatId);
  if (!link) { await send(chatId, cmd === "help" ? HELP_TEXT + "\n\n" + NEED_LINK : NEED_LINK); return; }
  const user = await findUserById(link.userId);
  if (!user || user.status !== "approved") { await send(chatId, "이용할 수 없는 계정입니다. 관리자에게 문의해 주세요."); return; }
  const c: Ctx = { chatId, userId: user.id, today: todayKst() };

  try {
    if (cmd === "unlink") { await unlinkUser(user.id); await send(chatId, "연결을 해제했습니다. 다시 쓰려면 웹사이트에서 새 코드를 받아 주세요."); return; }
    if (cmd === "help" || cmd === "") { await send(chatId, HELP_TEXT); return; }
    await api("sendChatAction", { chat_id: chatId, action: "typing" });
    if (cmd === "schedule") return await doSchedule(c, args);
    if (cmd === "today") return await doAgenda(c, 1, "오늘");
    if (cmd === "week") return await doAgenda(c, 7, "앞으로 7일");
    if (cmd === "promo") return await doPromo(c, "recruit", args);
    if (cmd === "news") return await doPromo(c, "news", args);
    if (cmd === "translate") return await doTranslate(c, args);
    if (cmd === "summary") return await doSummary(c);
  } catch (e) {
    await send(chatId, explain(e));
  }
}

export async function handleCallback(cb: any) {
  const chatId = cb?.message?.chat?.id != null ? String(cb.message.chat.id) : "";
  if (!chatId) return;
  await api("answerCallbackQuery", { callback_query_id: cb.id });
  const link = await getLinkByChat(chatId);
  if (!link) return;
  if (cb.data === "sch:no") { pendingSchedules.take(chatId); await send(chatId, "취소했습니다."); return; }
  if (cb.data !== "sch:ok") return;
  const items = pendingSchedules.take(chatId);
  if (!items) { await send(chatId, "시간이 지났습니다. 일정을 다시 보내 주세요."); return; }
  try {
    const u = await findUserById(link.userId);
    if (!u || u.status !== "approved") return;
    for (const it of items) {
      await createSchedule({ projectId: it.projectId ?? 0, userId: u.id, title: it.title, description: withTime(it.description, it.time), startDate: it.startDate, endDate: it.endDate, color: it.color });
    }
    await send(chatId, `${items.length}건을 등록했습니다.`);
  } catch (e) {
    await send(chatId, explain(e));
  }
}

/** 웹훅으로 들어온 update 1건 처리(에러는 삼킨다 — 텔레그램 재전송 폭주 방지) */
export async function handleUpdate(update: any) {
  try {
    if (typeof update?.update_id === "number" && seen.seen(update.update_id)) return;
    if (update?.callback_query) await handleCallback(update.callback_query);
    else if (update?.message) await handleMessage(update.message);
  } catch (e) {
    console.error("[telegram] update failed", e);
  }
}

/** 서버 시작 시: 봇 이름 확인 + 웹훅 등록 */
export async function setupTelegram() {
  if (!telegramEnabled()) { console.log("[telegram] TELEGRAM_BOT_TOKEN 미설정 — 봇 비활성"); return; }
  try {
    const me = await api("getMe", {});
    if (me?.ok && me.result?.username) botUsername = me.result.username;
    const base = (process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "");
    if (!base) { console.warn("[telegram] PUBLIC_BASE_URL/RENDER_EXTERNAL_URL 없음 — 웹훅 미등록"); return; }
    const r = await api("setWebhook", { url: `${base}/api/telegram/webhook`, secret_token: webhookSecret(), allowed_updates: ["message", "callback_query"], drop_pending_updates: true });
    console.log(`[telegram] 웹훅 ${r?.ok ? "등록 완료" : "등록 실패"} (@${botUsername || "?"})`);
  } catch (e) {
    console.error("[telegram] setup failed", e);
  }
}

const notifyLimiter = new RateLimiter(10, 10 * 60_000); // 가입 폭주 시 관리자 알림 폭탄 방지
const clip = (v: string, n: number) => v.replace(/\s+/g, " ").trim().slice(0, n);

/** 새 가입 신청을 텔레그램이 연결된 관리자에게 알린다. 실패해도 가입 처리에는 영향이 없도록 예외를 삼킨다. */
export async function notifyNewSignup(name: string, email: string) {
  if (!telegramEnabled()) return;
  try {
    if (!notifyLimiter.allow("signup")) return;
    const chats = await adminChatIds();
    if (chats.length === 0) return;
    const pending = await countPendingUsers();
    const base = (process.env.PUBLIC_BASE_URL || "https://www.psk.lol").replace(/\/$/, "");
    const text = `🔔 새 가입 신청\n이름: ${clip(name, 40)}\n이메일: ${clip(email, 80)}\n\n승인 대기 ${pending}명\n승인·이용기간·요금제 설정: ${base}/admin`;
    for (const chatId of chats) await send(chatId, text);
  } catch (e) {
    console.error("[telegram] signup notify failed", e);
  }
}
