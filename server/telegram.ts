import { createHash, randomInt, timingSafeEqual } from "crypto";
import { NOTICE_LANGUAGES, MAX_NOTICE_LANGS, type NoticeLangId } from "../shared/languages";

// ─── 명령 해석 ───────────────────────────────────────────────────────────────
export type BotCommand = "link" | "unlink" | "help" | "schedule" | "today" | "week" | "promo" | "news" | "translate" | "summary" | "";

const COMMAND_ALIASES: Record<string, BotCommand> = {
  연결: "link", link: "link", connect: "link",
  해제: "unlink", unlink: "unlink",
  도움말: "help", help: "help", start: "help", 시작: "help",
  일정: "schedule", schedule: "schedule",
  오늘: "today", today: "today",
  이번주: "week", 이번주일정: "week", week: "week",
  홍보: "promo", promo: "promo",
  소식: "news", news: "news",
  번역: "translate", translate: "translate",
  요약: "summary", summary: "summary",
};

/** "/연결@봇이름 123" → { cmd:"link", args:"123" }. 슬래시 없는 글은 cmd "". */
export function parseCommand(text: string): { cmd: BotCommand; args: string } {
  const t = (text ?? "").trim();
  if (!t.startsWith("/")) return { cmd: "", args: t };
  const m = t.match(/^\/([^\s@]+)(?:@\S+)?\s*([\s\S]*)$/);
  if (!m) return { cmd: "", args: t };
  return { cmd: COMMAND_ALIASES[m[1].toLowerCase()] ?? "", args: m[2].trim() };
}

// ─── 홍보글 채널 ─────────────────────────────────────────────────────────────
export type BotPromoChannel = "blog" | "instagram" | "facebook" | "kakao" | "press" | "newsletter";
const CHANNEL_WORDS: Record<string, BotPromoChannel> = {
  블로그: "blog", 인스타: "instagram", 인스타그램: "instagram", 페북: "facebook", 페이스북: "facebook",
  카톡: "kakao", 카카오: "kakao", 카카오톡: "kakao", 보도자료: "press", 소식지: "newsletter", 뉴스레터: "newsletter",
};
export const CHANNEL_HELP = "블로그, 인스타, 페이스북, 카톡, 보도자료, 소식지";

export function parsePromoArgs(args: string): { channel: BotPromoChannel; facts: string } | null {
  const m = args.trim().match(/^(\S+)\s+([\s\S]+)$/);
  if (!m) return null;
  const channel = CHANNEL_WORDS[m[1]];
  return channel ? { channel, facts: m[2].trim() } : null;
}

// ─── 번역 언어 ───────────────────────────────────────────────────────────────
const LANG_WORDS: Record<string, NoticeLangId> = {
  영어: "en", 영문: "en", 베트남어: "vi", 베트남: "vi", 중국어: "zh", 중국: "zh", 태국어: "th", 태국: "th",
  우즈벡어: "uz", 우즈베크어: "uz", 우즈벡: "uz", 네팔어: "ne", 네팔: "ne",
  크메르어: "km", 캄보디아어: "km", 캄보디아: "km", 인도네시아어: "id", 인니어: "id", 인도네시아: "id",
  러시아어: "ru", 러시아: "ru", 몽골어: "mn", 몽골: "mn", 미얀마어: "my", 미얀마: "my", 버마어: "my",
  벵골어: "bn", 방글라데시어: "bn", 방글라: "bn", 필리핀어: "tl", 타갈로그어: "tl", 필리핀: "tl",
  싱할라어: "si", 스리랑카어: "si", 카자흐어: "kk", 카자흐스탄어: "kk", 카자흐: "kk",
};
export function langIdsFromWords(words: string[]): NoticeLangId[] {
  const ids = words.map((w) => LANG_WORDS[w.replace(/\s/g, "")]).filter((x): x is NoticeLangId => !!x);
  return Array.from(new Set(ids)).slice(0, MAX_NOTICE_LANGS);
}
export const channelFromWord = (w: string): BotPromoChannel | null => CHANNEL_WORDS[(w ?? "").replace(/\s/g, "")] ?? null;
export const DEFAULT_TRANSLATE_LANGS: NoticeLangId[] = ["en", "vi"];

/** "영어 베트남어: 안내문…" 또는 첫 줄에 언어만 적은 경우를 분리. 언어 표기가 없으면 영어+베트남어. */
export function parseTranslateArgs(args: string): { langs: NoticeLangId[]; text: string; truncated: boolean } {
  const t = args.trim();
  const m = t.match(/^([^\n:：]{1,60})[:：\n]\s*([\s\S]+)$/);
  if (m) {
    const words = m[1].split(/[\s,，、·/및와과]+/).filter(Boolean);
    const ids = words.map((w) => LANG_WORDS[w]);
    if (words.length > 0 && ids.every(Boolean)) {
      const uniq = Array.from(new Set(ids as NoticeLangId[]));
      return { langs: uniq.slice(0, MAX_NOTICE_LANGS), text: m[2].trim(), truncated: uniq.length > MAX_NOTICE_LANGS };
    }
  }
  return { langs: DEFAULT_TRANSLATE_LANGS, text: t, truncated: false };
}
export const LANGUAGE_HELP = NOTICE_LANGUAGES.map((l) => l.label.replace(/\(.*\)/, "")).join(", ");

// ─── 메시지 분할·서식 ────────────────────────────────────────────────────────
/** 텔레그램 한 메시지 한도(4096자)를 넘지 않게 줄바꿈 기준으로 나눈다. */
export function splitMessage(text: string, max = 3800): string[] {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n", max);
    if (cut < max * 0.5) cut = max;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

const WD = ["일", "월", "화", "수", "목", "금", "토"];
/** Date/문자열 → KST 날짜(YYYY-MM-DD) */
export function kstDate(v: Date | string): string {
  const d = typeof v === "string" ? new Date(v) : v;
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
export const mdWithWeekday = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${m}/${d}(${WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
};
export function formatDateRange(start: string, end: string) {
  return start === end ? mdWithWeekday(start) : `${mdWithWeekday(start)}~${mdWithWeekday(end)}`;
}

// ─── 연결 코드·비밀값 ────────────────────────────────────────────────────────
export const LINK_CODE_MINUTES = 10;
export const makeLinkCode = () => String(randomInt(0, 100_000_000)).padStart(8, "0");
export const isLinkCode = (s: string) => /^\d{8}$/.test(s.trim());

export function secretFromToken(token: string, explicit?: string): string {
  return explicit && explicit.length >= 16 ? explicit : createHash("sha256").update(`psk-telegram:${token}`).digest("hex").slice(0, 48);
}
export function secretsMatch(given: string | undefined, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ─── 속도 제한·임시 보관 ─────────────────────────────────────────────────────
/** 고정 창 속도 제한(메모리). 단일 서버 기준. */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private max: number, private windowMs: number) {}
  allow(key: string, now = Date.now()): boolean {
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (arr.length >= this.max) { this.hits.set(key, arr); return false; }
    arr.push(now);
    this.hits.set(key, arr);
    if (this.hits.size > 5000) this.hits.forEach((v, k) => { if (!v.some((t) => now - t < this.windowMs)) this.hits.delete(k); });
    return true;
  }
}

export class PendingStore<T> {
  private m = new Map<string, { v: T; exp: number }>();
  constructor(private ttlMs: number) {}
  set(key: string, v: T, now = Date.now()) { this.m.set(key, { v, exp: now + this.ttlMs }); }
  take(key: string, now = Date.now()): T | undefined {
    const e = this.m.get(key);
    this.m.delete(key);
    return e && e.exp > now ? e.v : undefined;
  }
}

/** 이미 처리한 update_id를 기억해 텔레그램 재전송으로 같은 요청이 두 번 실행되는 것을 막는다. */
export class SeenSet {
  private ids: number[] = [];
  constructor(private size = 300) {}
  seen(id: number): boolean {
    if (this.ids.includes(id)) return true;
    this.ids.push(id);
    if (this.ids.length > this.size) this.ids.shift();
    return false;
  }
}

// ─── 자연어 대화 ─────────────────────────────────────────────────────────────
export type QuickIntent = "help" | "today" | "week" | "summary" | null;
const WRITE_VERBS = /(등록|추가|잡아|넣어|만들|생성|취소|삭제|변경|수정|옮겨)/;

/** AI 없이 바로 알 수 있는 짧은 질문. 헷갈리면 null(→ AI 해석). */
export function quickIntent(text: string): QuickIntent {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length > 30) return null;
  if (/^(도움말|도움|사용법|help|뭐\s*(할\s*수|해줘\??$)|무엇을\s*할\s*수|기능)/i.test(t)) return "help";
  if (WRITE_VERBS.test(t)) return null;
  if (/(이번\s*주|금주|일주일|7일)/.test(t) && /(일정|스케줄)/.test(t)) return "week";
  if (/(오늘|금일)/.test(t) && /(일정|스케줄|할\s*일)/.test(t)) return "today";
  if (/(이번\s*달|이달|이번달|월간)/.test(t) && /(실적|요약|실인원|연인원|현황)/.test(t)) return "summary";
  return null;
}

export type ChatTurn = { role: "user" | "assistant"; text: string };
/** 대화당 최근 몇 턴만 잠깐 기억(되묻고 답하는 흐름용). 메모리 보관, 20분 후 사라짐. */
export class ChatMemory {
  private m = new Map<string, { turns: ChatTurn[]; exp: number }>();
  constructor(private ttlMs = 20 * 60_000, private maxTurns = 6) {}
  get(chatId: string, now = Date.now()): ChatTurn[] {
    const e = this.m.get(chatId);
    if (!e || e.exp <= now) { this.m.delete(chatId); return []; }
    return e.turns;
  }
  push(chatId: string, turn: ChatTurn, now = Date.now()) {
    const cur = this.get(chatId, now);
    const next = [...cur, { role: turn.role, text: turn.text.slice(0, 600) }].slice(-this.maxTurns);
    this.m.set(chatId, { turns: next, exp: now + this.ttlMs });
    if (this.m.size > 3000) this.m.forEach((v, k) => { if (v.exp <= now) this.m.delete(k); });
  }
  clear(chatId: string) { this.m.delete(chatId); }
}
