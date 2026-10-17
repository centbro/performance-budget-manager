import { useEffect, useState, useSyncExternalStore } from "react";
import { decryptSecret, encryptSecret, type ParticipantSecret } from "@shared/vaultCrypto";
import { maskBirth, maskName, maskPhone } from "@shared/maskPii";

/** 잠금 해제 키는 이 탭의 메모리에만 있다. 저장하지 않고, 일정 시간 안 쓰면 스스로 지운다. */
export const AUTO_LOCK_MS = 3 * 60 * 1000;

let currentKey: CryptoKey | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function lockVault() {
  currentKey = null;
  if (timer) clearTimeout(timer);
  timer = null;
  emit();
}
export function setVaultKey(key: CryptoKey) {
  currentKey = key;
  touchVault();
  emit();
}
/** 사용할 때마다 자동 잠금 시간을 다시 잰다. */
export function touchVault() {
  if (!currentKey) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(lockVault, AUTO_LOCK_MS);
}
export function getVaultKey() { return currentKey; }

export function useVaultKey(): CryptoKey | null {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => currentKey,
    () => null
  );
}

/** 서버에 보낼 값: 가려진 값 + 암호문. 원문은 보내지 않는다. */
export async function buildLockedFields(key: CryptoKey, s: ParticipantSecret) {
  touchVault();
  return {
    name: maskName(s.name) || "*",
    phone: s.phone ? maskPhone(s.phone) : undefined,
    birthDate: s.birthDate ? maskBirth(s.birthDate) : undefined,
    encPayload: await encryptSecret(key, s),
  };
}

/** 잠금이 풀려 있으면 목록의 암호문을 모두 풀어 id → 원문으로 돌려준다. 잠기면 비운다. */
export function useDecryptedSecrets(rows: { id: number; encPayload?: string | null }[], key: CryptoKey | null) {
  const [map, setMap] = useState<Map<number, ParticipantSecret>>(new Map());
  const [failed, setFailed] = useState(0);
  const sig = rows.map((r) => `${r.id}:${r.encPayload?.length ?? 0}`).join(",");
  useEffect(() => {
    let cancelled = false;
    if (!key) { setMap(new Map()); setFailed(0); return; }
    (async () => {
      const m = new Map<number, ParticipantSecret>();
      let bad = 0;
      for (const r of rows) {
        if (!r.encPayload) continue;
        try { m.set(r.id, await decryptSecret(key, r.encPayload)); } catch { bad++; }
      }
      if (!cancelled) { setMap(m); setFailed(bad); touchVault(); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, sig]);
  return { secrets: map, failed };
}
