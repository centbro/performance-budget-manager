// 참여자 엑셀 대량 등록 — 내국인/외국인 양식별 열 해석 (서버·클라이언트 공통)
export type ParticipantKind = "foreigner" | "domestic";

export const KIND_LABEL: Record<ParticipantKind, string> = { foreigner: "외국인", domestic: "내국인" };

/** 양식(엑셀 첫 행) 열 순서 */
export const TEMPLATE_HEADERS: Record<ParticipantKind, string[]> = {
  foreigner: ["이름", "성별", "국적", "전화번호", "비자종류", "거주지역", "생년월일", "반", "비고"],
  domestic: ["이름", "성별", "생년월일", "전화번호", "거주지역", "반", "비고"],
};

export type ImportRow = {
  name: string;
  gender: "male" | "female";
  nationality?: string;
  phone?: string;
  visaType?: string;
  region?: string;
  birthDate?: string;
  className?: string;
  note?: string;
  error?: string;
};

type Field = "name" | "gender" | "nationality" | "phone" | "visaType" | "region" | "birthDate" | "className" | "note";

const ALIASES: Record<Field, string[]> = {
  name: ["이름", "성명", "name"],
  gender: ["성별", "gender", "sex"],
  nationality: ["국적", "nationality"],
  phone: ["전화번호", "연락처", "휴대폰", "핸드폰", "phone"],
  visaType: ["비자종류", "비자", "체류자격", "visa"],
  region: ["거주지역", "지역", "주소", "region"],
  birthDate: ["생년월일", "생일", "birth", "birthdate"],
  className: ["반", "반명", "반이름", "class"],
  note: ["비고", "메모", "note"],
};

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, "");

export function parseGender(raw: unknown): "male" | "female" | null {
  const s = norm(raw);
  if (["남", "남성", "남자", "male", "m"].includes(s)) return "male";
  if (["여", "여성", "여자", "female", "f"].includes(s)) return "female";
  return null;
}

/** 다양한 생년월일 표기 → YYYY-MM-DD. 해석 불가면 null, 비어 있으면 undefined */
export function normalizeBirth(raw: unknown): string | null | undefined {
  if (raw == null || String(raw).trim() === "") return undefined;
  if (typeof raw === "number" && raw > 1 && raw < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(raw) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})일?$/) ?? s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (y < 1900 || dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** 시트 행들(첫 행이 머리글이면 머리글 기준, 아니면 양식 순서 기준)을 해석 */
export function parseParticipantRows(rows: unknown[][], kind: ParticipantKind): ImportRow[] {
  if (rows.length === 0) return [];
  const known = new Set(Object.values(ALIASES).flat().map(norm));
  const first = rows[0].map(norm);
  const hasHeader = first.some((c) => ["이름", "성명", "name"].includes(c));
  let colOf: Partial<Record<Field, number>> = {};
  if (hasHeader) {
    first.forEach((c, i) => {
      if (!known.has(c)) return;
      for (const f of Object.keys(ALIASES) as Field[]) if (ALIASES[f].map(norm).includes(c) && colOf[f] === undefined) colOf[f] = i;
    });
  } else {
    const order: Field[] = kind === "foreigner"
      ? ["name", "gender", "nationality", "phone", "visaType", "region", "birthDate", "className", "note"]
      : ["name", "gender", "birthDate", "phone", "region", "className", "note"];
    order.forEach((f, i) => (colOf[f] = i));
  }
  const cell = (row: unknown[], f: Field) => (colOf[f] === undefined ? undefined : row[colOf[f]!]);
  const text = (row: unknown[], f: Field) => String(cell(row, f) ?? "").trim() || undefined;

  const out: ImportRow[] = [];
  for (const row of rows.slice(hasHeader ? 1 : 0)) {
    const name = text(row, "name");
    if (!name) continue;
    const g = parseGender(cell(row, "gender"));
    const birth = normalizeBirth(cell(row, "birthDate"));
    const base = {
      name,
      nationality: kind === "foreigner" ? text(row, "nationality") : undefined,
      visaType: kind === "foreigner" ? text(row, "visaType") : undefined,
      phone: text(row, "phone"),
      region: text(row, "region"),
      className: text(row, "className"),
      note: text(row, "note"),
    };
    if (!g) out.push({ ...base, gender: "male", error: `성별 인식 불가: "${String(cell(row, "gender") ?? "")}"` });
    else if (birth === null) out.push({ ...base, gender: g, error: `생년월일 형식 확인: "${String(cell(row, "birthDate"))}"` });
    else out.push({ ...base, gender: g, birthDate: birth });
  }
  return out;
}
