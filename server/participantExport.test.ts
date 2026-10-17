import { describe, expect, it } from "vitest";
import { buildEncryptedParticipantsXlsx, validateExportPassword } from "./participantExport";

const rows = [
  { name: "김영수", kind: "domestic", gender: "male", nationality: null, phone: "010-1234-5678", visaType: null, region: "화성", birthDate: "1980-03-21", note: "=1+1" },
  { name: "Nguyen Van A", kind: "foreigner", gender: "female", nationality: "베트남", phone: "010-9999-0000", visaType: "E-9", region: null, birthDate: null, note: null },
];

describe("암호 엑셀 내보내기", () => {
  it("비밀번호 규칙", () => {
    expect(validateExportPassword("short")).toContain("8자");
    expect(validateExportPassword("x".repeat(65))).toContain("64자");
    expect(validateExportPassword(undefined)).not.toBeNull();
    expect(validateExportPassword("goodpass1!")).toBeNull();
  });
  it("암호화된 OLE 컨테이너로 만들어지고 평문 이름이 파일에 없다", async () => {
    const buf = await buildEncryptedParticipantsXlsx(rows, "사업", "goodpass1!");
    expect(buf.subarray(0, 8).toString("hex")).toBe("d0cf11e0a1b11ae1"); // 암호화 xlsx(CFB). 일반 xlsx는 'PK'(zip)로 시작
    expect(buf.toString("utf8").includes("김영수")).toBe(false);
    expect(buf.toString("utf16le").includes("김영수")).toBe(false);
  });
  it("약한 비밀번호는 만들지 않는다", async () => {
    await expect(buildEncryptedParticipantsXlsx(rows, "사업", "1234")).rejects.toThrow();
  });
});
