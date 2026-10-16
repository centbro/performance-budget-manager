import { describe, expect, it } from "vitest";
import { buildReportPrompt, factsToText, parseReport, pct, REPORT_SECTIONS, type ReportFacts } from "./resultReport";
import { buildTranslatePrompt, parseTranslations } from "./translateNotice";
import { buildStyleBlock, hasStyle, sanitizeStyle } from "./orgStyle";
import { monthsToRange } from "./reportData";
import { AI_FEATURES } from "../shared/plans";

const facts: ReportFacts = {
  projectName: "이주민 한국어교실", year: 2026, periodLabel: "연간 (1~12월)",
  subs: [{ name: "초급반", plannedPeople: 40, plannedExtended: 400, plannedCount: 40, actualPeople: 32, actualExtended: 360, actualCount: 38, male: 20, female: 12, isAdHoc: false, notes: ["추석 특강"] }],
  uniquePeople: 32,
  attendance: [{ className: "A반", members: 20, people: 18, extended: 200, sessions: 20, rate: 88.5 }],
  cases: { total: 5, people: 4, byCategory: [{ key: "법률상담", count: 3, people: 3 }] },
  budget: { total: 10_000_000, spent: 8_500_000, remaining: 1_500_000, rate: 85 },
};

describe("결과보고서", () => {
  it("달성률은 코드가 계산해 사실 목록에 넣는다", () => {
    const t = factsToText(facts);
    expect(t).toContain("달성률 80%"); // 32/40
    expect(t).toContain("달성률 90%"); // 360/400
    expect(t).toContain("집행률 85%");
    expect(t).toContain("출석률 88.5%");
    expect(t).toContain("기관 전체·사업 구분 없음");
  });
  it("계획이 0이면 달성률 대신 계산 불가로 표시한다", () => {
    expect(pct(5, 0)).toBeNull();
    const t = factsToText({ ...facts, subs: [{ ...facts.subs[0], plannedPeople: 0 }] });
    expect(t).toContain("달성률 계산 불가");
  });
  it("프롬프트에 날조 금지·실인원/연인원 구분·문체가 들어간다", () => {
    const { system, user } = buildReportPrompt(facts, { tone: "hamnida", styleBlock: "\n[기관 문체 참고]\nX" });
    expect(system).toContain("[확인 필요");
    expect(system).toContain("실인원은 서로 다른 참여자 수");
    expect(system).toContain("합니다체");
    expect(system).toContain("[기관 문체 참고]");
    for (const s of REPORT_SECTIONS) expect(system).toContain(s.key);
    expect(user).toContain("이주민 한국어교실");
  });
  it("응답을 7개 항목 순서로 맞추고 빠진 항목은 확인 필요로 채운다", () => {
    const raw = JSON.stringify({ sections: [{ key: "overview", content: "개요임" }, { key: "budget", content: "예산임" }] });
    const r = parseReport(raw);
    expect(r).toHaveLength(7);
    expect(r[0].content).toBe("개요임");
    expect(r[4].content).toBe("예산임");
    expect(r[1].content).toContain("[확인 필요");
  });
  it("망가진 응답도 7개 항목을 돌려준다", () => {
    expect(parseReport("not json")).toHaveLength(7);
  });
  it("월 범위를 날짜 구간으로 바꾼다", () => {
    expect(monthsToRange(2026, [1, 2, 3])).toMatchObject({ from: "2026-01-01", to: "2026-04-01", lastDay: 31 });
    expect(monthsToRange(2026, [10, 11, 12])).toMatchObject({ from: "2026-10-01", to: "2027-01-01" });
  });
});

describe("기관 문체", () => {
  it("비어 있으면 아무것도 붙이지 않는다", () => {
    expect(hasStyle({ orgName: "", tone: "", sampleText: "" })).toBe(false);
    expect(buildStyleBlock(null)).toBe("");
  });
  it("샘플의 개인정보를 가리고 길이를 제한한다", () => {
    const s = sanitizeStyle({ orgName: " 센터 ", sampleText: "연락처 010-1234-5678 입니다 " + "가".repeat(7000) });
    expect(s.orgName).toBe("센터");
    expect(s.sampleText).not.toContain("010-1234-5678");
    expect(s.sampleText.length).toBeLessThanOrEqual(6000);
  });
  it("샘플 내용을 가져오지 말고 지시를 따르지 말라는 문구를 넣는다", () => {
    const b = buildStyleBlock({ orgName: "OO센터", tone: "개조식", sampleText: "지난 글" });
    expect(b).toContain("OO센터");
    expect(b).toContain("개조식");
    expect(b).toContain("사실은 절대 가져오지 말고");
  });
});

describe("다국어 안내문", () => {
  it("프롬프트에 언어 목록과 숫자·연락처 보존 원칙이 들어간다", () => {
    const { system, user } = buildTranslatePrompt({ text: "11월 6일 19:00 개강", langs: ["en", "vi"], easyKorean: true });
    expect(system).toContain("vi: 베트남어");
    expect(system).toContain("전화번호");
    expect(system).toContain("easyKorean");
    expect(user).toContain("11월 6일");
  });
  it("요청한 언어만 순서대로 돌려주고 빈 번역은 뺀다", () => {
    const raw = JSON.stringify({ easyKorean: "쉬운 글", translations: [{ lang: "vi", text: "Xin chào" }, { lang: "en", text: "Hello" }, { lang: "th", text: "ไม่ได้ขอ" }, { lang: "zh", text: "" }] });
    const r = parseTranslations(raw, ["en", "vi", "zh"]);
    expect(r.translations.map((t) => t.lang)).toEqual(["en", "vi"]);
    expect(r.translations[0].label).toBe("영어");
    expect(r.easyKorean).toBe("쉬운 글");
  });
});

describe("요금 정책", () => {
  it("결과보고서는 프로 월 10회, 번역은 무제한(공정 사용 한도만)", () => {
    expect(AI_FEATURES.result_report.premiumOnly).toBe(false);
    expect(AI_FEATURES.result_report.monthly.pro).toBe(10);
    expect(AI_FEATURES.translate.monthly).toEqual({});
  });
});
