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
