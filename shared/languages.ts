// 외국인 참여자 안내문 번역 대상 언어. 센터 이용자 비중이 큰 순서(대략)로 나열.
export const NOTICE_LANGUAGES = [
  { id: "en", label: "영어", native: "English" },
  { id: "vi", label: "베트남어", native: "Tiếng Việt" },
  { id: "zh", label: "중국어(간체)", native: "简体中文" },
  { id: "th", label: "태국어", native: "ภาษาไทย" },
  { id: "uz", label: "우즈베크어", native: "Oʻzbekcha" },
  { id: "ne", label: "네팔어", native: "नेपाली" },
  { id: "km", label: "크메르어(캄보디아)", native: "ភាសាខ្មែរ" },
  { id: "id", label: "인도네시아어", native: "Bahasa Indonesia" },
  { id: "ru", label: "러시아어", native: "Русский" },
  { id: "mn", label: "몽골어", native: "Монгол" },
  { id: "my", label: "미얀마어", native: "မြန်မာ" },
  { id: "bn", label: "벵골어(방글라데시)", native: "বাংলা" },
  { id: "tl", label: "필리핀어(타갈로그)", native: "Filipino" },
  { id: "si", label: "싱할라어(스리랑카)", native: "සිංහල" },
  { id: "kk", label: "카자흐어", native: "Қазақша" },
] as const;
export type NoticeLangId = (typeof NOTICE_LANGUAGES)[number]["id"];
export const NOTICE_LANG_IDS = NOTICE_LANGUAGES.map((l) => l.id) as unknown as [NoticeLangId, ...NoticeLangId[]];
export const MAX_NOTICE_LANGS = 5;
