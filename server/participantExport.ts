import XlsxPopulate from "xlsx-populate";

export const MIN_EXPORT_PASSWORD = 8;
export const MAX_EXPORT_PASSWORD = 64;

export type ExportParticipant = {
  name: string; kind: string; gender: string; nationality: string | null; phone: string | null;
  visaType: string | null; region: string | null; birthDate: string | null; note: string | null;
};

export function validateExportPassword(pw: unknown): string | null {
  if (typeof pw !== "string") return "비밀번호를 입력해 주세요.";
  if (pw.length < MIN_EXPORT_PASSWORD) return `비밀번호는 ${MIN_EXPORT_PASSWORD}자 이상이어야 합니다.`;
  if (pw.length > MAX_EXPORT_PASSWORD) return `비밀번호는 ${MAX_EXPORT_PASSWORD}자 이하로 입력해 주세요.`;
  return null;
}

/** 엑셀 수식·매크로로 해석될 수 있는 시작 문자를 막는다(CSV/엑셀 인젝션 방지). */
const safeCell = (v: string | null | undefined) => {
  const s = (v ?? "").toString();
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
};

/** 비밀번호로 암호화된 .xlsx 버퍼를 만든다. 비밀번호는 저장·기록하지 않는다. */
export async function buildEncryptedParticipantsXlsx(rows: ExportParticipant[], projectName: string, password: string): Promise<Buffer> {
  const err = validateExportPassword(password);
  if (err) throw new Error(err);
  const wb = await XlsxPopulate.fromBlankAsync();
  const sh = wb.sheet(0);
  sh.name("참여자");
  const header = ["번호", "이름", "구분", "성별", "국적", "연락처", "비자종류", "거주지역", "생년월일", "메모"];
  const body = rows.map((r, i) => [
    i + 1, safeCell(r.name), r.kind === "domestic" ? "내국인" : "외국인", r.gender === "male" ? "남" : "여",
    safeCell(r.nationality), safeCell(r.phone), safeCell(r.visaType), safeCell(r.region), safeCell(r.birthDate), safeCell(r.note),
  ]);
  sh.cell("A1").value([header, ...body]);
  sh.row(1).style({ bold: true, fill: "EEF2F7" });
  [6, 16, 8, 6, 14, 16, 12, 14, 12, 24].forEach((w, i) => sh.column(i + 1).width(w));
  sh.freezePanes(0, 1);
  return await wb.outputAsync({ password });
}
