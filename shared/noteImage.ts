/** 한 장짜리 노트 이미지(손그림 노트·마인드맵)에 들어갈 내용 */
export type NoteItem = { emoji: string; heading: string; desc: string };
export type NoteContent = { title: string; subtitle: string; items: NoteItem[]; footer: string };

export const NOTE_MIN_ITEMS = 4;
export const NOTE_MAX_ITEMS = 8;

const clip = (s: unknown, n: number) => {
  const t = String(s ?? "").replace(/\s+/g, " ").replace(/[*#`_]/g, "").trim();
  const a = Array.from(t);
  return a.length > n ? a.slice(0, n - 1).join("") + "…" : t;
};

/** 이모지 한 글자(또는 조합 한 개)만 남긴다. 없으면 기본 아이콘. */
export function pickEmoji(v: unknown, fallback = "📌"): string {
  const cps = Array.from(String(v ?? "").trim());
  const first = cps[0];
  if (!first || (first.codePointAt(0) ?? 0) < 0x2190) return fallback;
  return cps[1] === "\uFE0F" ? first + "\uFE0F" : first;
}

/** AI 응답(JSON 문자열)을 안전하게 NoteContent로 바꾼다. 쓸 수 없으면 null. */
export function parseNoteContent(raw: string): NoteContent | null {
  let o: any;
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    o = JSON.parse(m ? m[0] : raw);
  } catch { return null; }
  if (!o || !Array.isArray(o.items)) return null;
  const items: NoteItem[] = o.items
    .map((it: any) => ({ emoji: pickEmoji(it?.emoji), heading: clip(it?.heading, 12), desc: clip(it?.desc, 48) }))
    .filter((it: NoteItem) => it.heading)
    .slice(0, NOTE_MAX_ITEMS);
  if (items.length < NOTE_MIN_ITEMS) return null;
  const title = clip(o.title, 24);
  if (!title) return null;
  return { title, subtitle: clip(o.subtitle, 36), items, footer: clip(o.footer, 40) };
}
