import { describe, it, expect } from "vitest";
import { parseNoteContent, pickEmoji } from "../shared/noteImage";

const mk = (n: number) => JSON.stringify({ title: "다문화 부모교육", subtitle: "한눈에 보는 요약", footer: "화성시외국인복지센터",
  items: Array.from({ length: n }, (_, i) => ({ emoji: "🌱", heading: `항목${i + 1}`, desc: "설명입니다" })) });

describe("노트 이미지 내용 파싱", () => {
  it("정상 응답을 읽는다", () => {
    const c = parseNoteContent(mk(7))!;
    expect(c.items).toHaveLength(7);
    expect(c.title).toBe("다문화 부모교육");
  });
  it("항목은 최대 8개, 너무 적으면 null", () => {
    expect(parseNoteContent(mk(12))!.items).toHaveLength(8);
    expect(parseNoteContent(mk(2))).toBeNull();
  });
  it("JSON 앞뒤 잡글·마크다운 기호를 정리한다", () => {
    const raw = "```json\n" + JSON.stringify({ title: "**제목**", items: [1, 2, 3, 4].map((i) => ({ emoji: "x", heading: `## 소제목${i}`, desc: "d" })) }) + "\n```";
    const c = parseNoteContent(raw)!;
    expect(c.title).toBe("제목");
    expect(c.items[0].heading).toBe("소제목1");
    expect(c.items[0].emoji).toBe("📌");
  });
  it("깨진 응답은 null", () => {
    expect(parseNoteContent("죄송합니다")).toBeNull();
    expect(parseNoteContent("{}")).toBeNull();
  });
  it("긴 글자는 잘린다", () => {
    const c = parseNoteContent(JSON.stringify({ title: "가".repeat(50), items: [1,2,3,4].map(() => ({ emoji: "🎯", heading: "나".repeat(30), desc: "다".repeat(100) })) }))!;
    expect(Array.from(c.title).length).toBeLessThanOrEqual(24);
    expect(Array.from(c.items[0].desc).length).toBeLessThanOrEqual(48);
  });
  it("이모지 고르기", () => {
    expect(pickEmoji("🎯 목표")).toBe("🎯");
    expect(pickEmoji("abc")).toBe("📌");
  });
});
