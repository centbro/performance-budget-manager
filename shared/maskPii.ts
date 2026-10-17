/** 화면 표시용 개인정보 가리기. 원본은 그대로 두고 보여주는 값만 바꾼다. */

export function maskName(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (!n) return "";
  // 영문 등 공백으로 나뉜 이름: 단어마다 첫 글자만
  if (/\s/.test(n)) return n.split(/\s+/).map((w) => (w.length <= 1 ? w : w[0] + "*".repeat(Math.min(w.length - 1, 4)))).join(" ");
  const chars = Array.from(n);
  if (chars.length === 1) return chars[0];
  if (chars.length === 2) return chars[0] + "*";
  return chars[0] + "*".repeat(chars.length - 2) + chars[chars.length - 1];
}

export function maskPhone(phone: string | null | undefined): string {
  const p = (phone ?? "").trim();
  if (!p) return "";
  const digits = p.replace(/\D/g, "");
  if (digits.length < 7) return "*".repeat(Math.max(p.length - 2, 2)) + p.slice(-2);
  const last4 = digits.slice(-4);
  const head = digits.startsWith("02") ? "02" : digits.length >= 10 ? digits.slice(0, 3) : digits.slice(0, 2);
  return `${head}-****-${last4}`;
}

/** YYYY-MM-DD → 연도만 보임 */
export function maskBirth(birth: string | null | undefined): string {
  const b = (birth ?? "").trim();
  const m = b.match(/^(\d{4})-\d{2}-\d{2}$/);
  return m ? `${m[1]}-**-**` : b ? "****-**-**" : "";
}
