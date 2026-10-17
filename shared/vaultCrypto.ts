/**
 * 대상자 개인정보 잠금(브라우저에서 암호화).
 * 비밀번호 → PBKDF2-SHA256 → AES-GCM 키. 키와 비밀번호는 서버로 보내지 않는다.
 * 서버에는 salt, 반복 횟수, '확인용 암호문'(verifier)만 저장한다. 비밀번호를 잊으면 복구할 수 없다.
 */

export const VAULT_ITERATIONS = 600_000;
export const VAULT_MIN_PASSWORD = 10;
const VERIFIER_TEXT = "psk-vault-v1";

export type VaultMeta = { salt: string; iterations: number; verifier: string };
export type ParticipantSecret = { name: string; phone?: string; birthDate?: string };

function subtle(): SubtleCrypto {
  const c = (globalThis as any).crypto;
  if (!c?.subtle) throw new Error("이 브라우저에서는 암호화를 사용할 수 없습니다. (https 연결이 필요합니다)");
  return c.subtle;
}

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function deriveVaultKey(password: string, saltB64: string, iterations: number): Promise<CryptoKey> {
  const base = await subtle().importKey("raw", new TextEncoder().encode(password.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: fromB64(saltB64), iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** 암호화: "iv.암호문"(base64) 문자열. */
export async function encryptText(key: CryptoKey, text: string): Promise<string> {
  const iv = (globalThis as any).crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12))) as Uint8Array<ArrayBuffer>;
  const ct = await subtle().encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text));
  return `${toB64(iv)}.${toB64(ct)}`;
}

/** 복호화. 비밀번호가 틀리거나 데이터가 바뀌었으면 오류를 던진다. */
export async function decryptText(key: CryptoKey, payload: string): Promise<string> {
  const [iv, ct] = payload.split(".");
  if (!iv || !ct) throw new Error("잘못된 암호문입니다.");
  const pt = await subtle().decrypt({ name: "AES-GCM", iv: fromB64(iv) }, key, fromB64(ct));
  return new TextDecoder().decode(pt);
}

/** 새 잠금 만들기: 서버에 저장할 메타정보와 키. */
export async function createVault(password: string, iterations = VAULT_ITERATIONS): Promise<{ meta: VaultMeta; key: CryptoKey }> {
  const salt = toB64((globalThis as any).crypto.getRandomValues(new Uint8Array(16)));
  const key = await deriveVaultKey(password, salt, iterations);
  const verifier = await encryptText(key, VERIFIER_TEXT);
  return { meta: { salt, iterations, verifier }, key };
}

/** 비밀번호가 맞으면 키를, 틀리면 null. */
export async function unlockVault(password: string, meta: VaultMeta): Promise<CryptoKey | null> {
  try {
    const key = await deriveVaultKey(password, meta.salt, meta.iterations);
    return (await decryptText(key, meta.verifier)) === VERIFIER_TEXT ? key : null;
  } catch {
    return null;
  }
}

export async function encryptSecret(key: CryptoKey, secret: ParticipantSecret): Promise<string> {
  return encryptText(key, JSON.stringify(secret));
}

export async function decryptSecret(key: CryptoKey, payload: string): Promise<ParticipantSecret> {
  const o = JSON.parse(await decryptText(key, payload));
  return { name: String(o.name ?? ""), phone: o.phone ? String(o.phone) : undefined, birthDate: o.birthDate ? String(o.birthDate) : undefined };
}

export function validateVaultPassword(pw: string): string | null {
  if (pw.length < VAULT_MIN_PASSWORD) return `비밀번호는 ${VAULT_MIN_PASSWORD}자 이상으로 해 주세요.`;
  if (/^(.)\1+$/.test(pw)) return "같은 글자만 반복하지 마세요.";
  return null;
}
