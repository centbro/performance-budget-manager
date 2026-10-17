import { describe, expect, it } from "vitest";
import { maskBirth, maskName, maskPhone } from "../shared/maskPii";

describe("maskPii", () => {
  it("이름", () => {
    expect(maskName("김영수")).toBe("김*수");
    expect(maskName("김철")).toBe("김*");
    expect(maskName("남궁민수")).toBe("남**수");
    expect(maskName("Nguyen Van A")).toBe("N**** V** A");
    expect(maskName("")).toBe("");
  });
  it("전화번호", () => {
    expect(maskPhone("010-1234-5678")).toBe("010-****-5678");
    expect(maskPhone("01012345678")).toBe("010-****-5678");
    expect(maskPhone("031-123-4567")).toBe("031-****-4567");
    expect(maskPhone("123")).toBe("**23");
  });
  it("생년월일은 연도만", () => {
    expect(maskBirth("1980-03-21")).toBe("1980-**-**");
  });
});

describe("서울 지역번호", () => {
  it("02는 두 자리", () => { expect(maskPhone("02-123-4567")).toBe("02-****-4567"); });
});

import { maskedLabels } from "../shared/maskPii";
describe("maskedLabels", () => {
  it("가려진 이름이 겹치면 번호를 붙인다", () => {
    const m = maskedLabels([{ id: 1, name: "김영수" }, { id: 2, name: "김민수" }, { id: 3, name: "박철" }]);
    expect(m.get(1)).toBe("김*수 #1");
    expect(m.get(2)).toBe("김*수 #2");
    expect(m.get(3)).toBe("박*");
  });
});
