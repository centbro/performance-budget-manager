import { describe, it, expect } from "vitest";
import { createVault, unlockVault, encryptSecret, decryptSecret, encryptText, decryptText, validateVaultPassword } from "../shared/vaultCrypto";
import { maskName, maskPhone } from "../shared/maskPii";

const FAST = 1000; // 테스트는 반복 횟수를 줄여 빠르게

describe("대상자 잠금 암호화", () => {
  it("암호화한 뒤 같은 비밀번호로 풀면 원래 값이 나온다", async () => {
    const { meta, key } = await createVault("correct-horse-battery", FAST);
    const enc = await encryptSecret(key, { name: "김영수", phone: "010-1234-5678", birthDate: "1980-01-02" });
    expect(enc).not.toContain("김영수");
    const key2 = await unlockVault("correct-horse-battery", meta);
    expect(key2).not.toBeNull();
    expect(await decryptSecret(key2!, enc)).toEqual({ name: "김영수", phone: "010-1234-5678", birthDate: "1980-01-02" });
  });
  it("틀린 비밀번호는 열리지 않는다", async () => {
    const { meta } = await createVault("correct-horse-battery", FAST);
    expect(await unlockVault("wrong-password-123", meta)).toBeNull();
  });
  it("다른 비밀번호로는 복호화되지 않고, 변조된 데이터도 거부된다", async () => {
    const a = await createVault("password-number-one", FAST);
    const b = await createVault("password-number-two", FAST);
    const enc = await encryptText(a.key, "비밀");
    await expect(decryptText(b.key, enc)).rejects.toBeTruthy();
    const [iv, ct] = enc.split(".");
    const bytes = Buffer.from(ct, "base64"); bytes[0] ^= 1;
    await expect(decryptText(a.key, `${iv}.${bytes.toString("base64")}`)).rejects.toBeTruthy();
  });
  it("같은 내용도 매번 다른 암호문이 나온다", async () => {
    const { key } = await createVault("password-number-one", FAST);
    expect(await encryptText(key, "x")).not.toBe(await encryptText(key, "x"));
  });
  it("비밀번호 규칙", () => {
    expect(validateVaultPassword("짧음")).toBeTruthy();
    expect(validateVaultPassword("aaaaaaaaaaaa")).toBeTruthy();
    expect(validateVaultPassword("정상적인비밀번호12")).toBeNull();
  });
  it("이미 가려진 값은 다시 가리지 않는다", () => {
    expect(maskName("김*수")).toBe("김*수");
    expect(maskPhone("010-****-5678")).toBe("010-****-5678");
  });
});

import { assertMaskedInput } from "./vault";
describe("서버 입력 검사(잠금 사용자)", () => {
  it("원문 이름·전화를 보내면 거부한다", () => {
    expect(() => assertMaskedInput({ name: "김영수", encPayload: "aaaa.bbbb" })).toThrow();
    expect(() => assertMaskedInput({ name: "김*수", phone: "01012345678", encPayload: "aaaa.bbbb" })).toThrow();
    expect(() => assertMaskedInput({ name: "김*수", birthDate: "1980-01-02", encPayload: "aaaa.bbbb" })).toThrow();
  });
  it("암호문이 없으면 거부하고, 가려진 값 + 암호문은 통과한다", () => {
    expect(() => assertMaskedInput({ name: "김*수" })).toThrow();
    expect(() => assertMaskedInput({ name: "김*수", phone: "010-****-5678", birthDate: "1980-**-**", encPayload: "aaaa.bbbb" })).not.toThrow();
    expect(() => assertMaskedInput({ name: "김", encPayload: "aaaa.bbbb" })).not.toThrow();
  });
});
