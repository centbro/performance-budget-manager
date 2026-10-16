import { describe, expect, it } from "vitest";
import { mdToPlain } from "../shared/markdownText";
import { parseReport } from "./resultReport";
import { cleanDocOutput } from "./workTools";

describe("mdToPlain", () => {
  it("제목·굵게·불릿 기호를 정리한다", () => {
    const r = mdToPlain("### I. 사업개요\n\n* **사업명**: 화성 라이프\n* **기간**: 12개월");
    expect(r).toBe("I. 사업개요\n\n- 사업명: 화성 라이프\n- 기간: 12개월");
  });
  it("표는 탭으로, 구분선·가로줄은 제거한다", () => {
    const r = mdToPlain("| 항목 | 금액 |\n|---|---|\n| 강사비 | 1,000 |\n\n---\n\n끝");
    expect(r).toBe("항목\t금액\n강사비\t1,000\n\n끝");
  });
  it("곱셈 기호나 평범한 문장은 건드리지 않는다", () => {
    expect(mdToPlain("단가 5,000 × 10명 = 50,000원\n3 * 4 = 12")).toBe("단가 5,000 × 10명 = 50,000원\n3 * 4 = 12");
  });
  it("보고서·문서 생성 결과에도 적용된다", () => {
    const sec = parseReport(JSON.stringify({ sections: [{ key: "overview", content: "**사업 개요**\n* 목적: 정착" }] }));
    expect(sec[0].content).toBe("사업 개요\n- 목적: 정착");
    expect(cleanDocOutput("## 제목\n**본문**")).toBe("제목\n본문");
  });
});
