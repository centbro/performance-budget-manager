import { describe, expect, it } from "vitest";
import { buildPromoPrompt, buildRefinePrompt, parsePromo } from "./promo";

describe("buildPromoPrompt", () => {
  it("페이스북 채널 규격이 프롬프트에 반영된다", () => {
    const { system } = buildPromoPrompt({ kind: "recruit", channel: "facebook", org: "OO센터", facts: "11월 8일 운동회", count: 2 }, []);
    expect(system).toContain("페이스북");
    expect(system).toContain("더 보기");
    expect(system).toContain("[링크 확인 필요]");
  });
  it("채널 형식·샘플·확인 필요 원칙을 담는다", () => {
    const { system, user } = buildPromoPrompt(
      { kind: "recruit", channel: "instagram", org: "OO센터", facts: "11월 8일 운동회", count: 3 },
      [{ name: "지난 후기", channel: "blog", body: "안녕하세요 오늘은 즐거운 하루였어요 ".repeat(5) }]
    );
    expect(system).toContain("인스타그램");
    expect(system).toContain("[확인 필요");
    expect(system).toContain("샘플 1: 지난 후기");
    expect(system).toContain("절대 가져오지 않습니다");
    expect(user).toContain("11월 8일 운동회");
  });
  it("샘플이 없으면 샘플 블록이 없다", () => {
    expect(buildPromoPrompt({ kind: "news", channel: "blog", org: "", facts: "x" }, []).system).not.toContain("[샘플 1");
  });
  it("소식글에는 동의 확인 원칙", () => {
    expect(buildPromoPrompt({ kind: "news", channel: "blog", org: "", facts: "x" }, []).system).toContain("동의");
  });
});

describe("parsePromo", () => {
  it("안 목록을 정리하고 최대 3개", () => {
    const raw = JSON.stringify({ variants: [1, 2, 3, 4].map((i) => ({ label: `안${i}`, title: "t", body: `본문${i}`, hashtags: ["#a", " #b "] })) });
    const r = parsePromo(raw);
    expect(r).toHaveLength(3);
    expect(r[0].hashtags).toEqual(["#a", "#b"]);
  });
  it("본문 없는 안은 제외, 비 JSON이면 원문 보존", () => {
    expect(parsePromo(JSON.stringify({ variants: [{ label: "a", body: "" }] }))).toEqual([]);
    expect(parsePromo("그냥 글입니다")[0].body).toBe("그냥 글입니다");
  });
});

describe("buildRefinePrompt", () => {
  it("현재 글과 요청을 담는다", () => {
    const { system, user } = buildRefinePrompt({ channel: "kakao", title: "T", body: "B", instruction: "더 짧게" }, []);
    expect(system).toContain("카카오");
    expect(user).toContain("더 짧게");
  });
});
