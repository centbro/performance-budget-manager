import { describe, expect, it } from "vitest";
import {
  PendingStore, RateLimiter, SeenSet, formatDateRange, isLinkCode, kstDate, makeLinkCode, parseCommand, parsePromoArgs,
  parseTranslateArgs, secretFromToken, secretsMatch, splitMessage,
} from "./telegram";

describe("명령 해석", () => {
  it("한글·영문 명령과 봇 이름 접미사를 처리한다", () => {
    expect(parseCommand("/연결 12345678")).toEqual({ cmd: "link", args: "12345678" });
    expect(parseCommand("/link@psk_bot 1234")).toEqual({ cmd: "link", args: "1234" });
    expect(parseCommand("/start")).toEqual({ cmd: "help", args: "" });
    expect(parseCommand("/이번주")).toEqual({ cmd: "week", args: "" });
    expect(parseCommand("/일정 11월 8일\n오후 2시 회의").args).toContain("오후 2시");
  });
  it("모르는 명령과 일반 글은 cmd가 비어 있다", () => {
    expect(parseCommand("/모름 abc").cmd).toBe("");
    expect(parseCommand("안녕하세요")).toEqual({ cmd: "", args: "안녕하세요" });
  });
});

describe("홍보·번역 인자", () => {
  it("채널과 내용을 분리한다", () => {
    expect(parsePromoArgs("인스타 11월 8일 운동회")).toEqual({ channel: "instagram", facts: "11월 8일 운동회" });
    expect(parsePromoArgs("페북 모집")?.channel).toBe("facebook");
    expect(parsePromoArgs("모르는채널 내용")).toBeNull();
    expect(parsePromoArgs("인스타")).toBeNull();
  });
  it("번역 언어를 앞부분에서 읽고, 없으면 영어+베트남어", () => {
    expect(parseTranslateArgs("영어 베트남어: 11월 6일 개강")).toMatchObject({ langs: ["en", "vi"], text: "11월 6일 개강" });
    expect(parseTranslateArgs("태국어, 우즈벡어\n내일 휴관")).toMatchObject({ langs: ["th", "uz"], text: "내일 휴관" });
    expect(parseTranslateArgs("11월 6일: 한국어교실 개강").langs).toEqual(["en", "vi"]);
    expect(parseTranslateArgs("11월 6일: 한국어교실 개강").text).toBe("11월 6일: 한국어교실 개강");
  });
  it("언어는 최대 5개까지만", () => {
    const r = parseTranslateArgs("영어 베트남어 중국어 태국어 우즈벡어 네팔어: 공지입니다");
    expect(r.langs).toHaveLength(5);
    expect(r.truncated).toBe(true);
  });
});

describe("메시지·날짜", () => {
  it("긴 글을 4096자 안으로 나눈다", () => {
    const text = Array.from({ length: 300 }, (_, i) => `줄 ${i} ${"가".repeat(30)}`).join("\n");
    const parts = splitMessage(text);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= 3800)).toBe(true);
    expect(parts.join("\n").replace(/\s/g, "")).toBe(text.replace(/\s/g, ""));
  });
  it("KST 날짜와 요일 표기", () => {
    expect(kstDate(new Date("2026-10-16T16:00:00Z"))).toBe("2026-10-17");
    expect(formatDateRange("2026-11-08", "2026-11-08")).toBe("11/8(일)");
    expect(formatDateRange("2026-11-08", "2026-11-10")).toBe("11/8(일)~11/10(화)");
  });
});

describe("연결 코드·비밀값", () => {
  it("8자리 숫자 코드", () => {
    for (let i = 0; i < 50; i++) expect(isLinkCode(makeLinkCode())).toBe(true);
    expect(isLinkCode("1234")).toBe(false);
    expect(isLinkCode("1234567a")).toBe(false);
  });
  it("웹훅 비밀값 비교", () => {
    const sec = secretFromToken("123:abc");
    expect(sec).toBe(secretFromToken("123:abc"));
    expect(sec).not.toBe(secretFromToken("123:abd"));
    expect(secretsMatch(sec, sec)).toBe(true);
    expect(secretsMatch("wrong", sec)).toBe(false);
    expect(secretsMatch(undefined, sec)).toBe(false);
    expect(secretFromToken("t", "x".repeat(20))).toBe("x".repeat(20));
  });
});

describe("속도 제한·임시 보관", () => {
  it("창 안에서 한도를 넘으면 막고, 창이 지나면 풀린다", () => {
    const r = new RateLimiter(2, 1000);
    expect(r.allow("a", 0)).toBe(true);
    expect(r.allow("a", 10)).toBe(true);
    expect(r.allow("a", 20)).toBe(false);
    expect(r.allow("b", 20)).toBe(true);
    expect(r.allow("a", 1500)).toBe(true);
  });
  it("임시 보관은 한 번만 꺼내고 시간이 지나면 사라진다", () => {
    const p = new PendingStore<string>(1000);
    p.set("c", "x", 0);
    expect(p.take("c", 500)).toBe("x");
    expect(p.take("c", 600)).toBeUndefined();
    p.set("c", "y", 0);
    expect(p.take("c", 2000)).toBeUndefined();
  });
  it("같은 update_id는 한 번만 처리", () => {
    const s = new SeenSet(2);
    expect(s.seen(1)).toBe(false);
    expect(s.seen(1)).toBe(true);
    s.seen(2); s.seen(3);
    expect(s.seen(1)).toBe(false); // 오래된 id는 밀려남
  });
});
