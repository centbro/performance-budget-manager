// 홍보글·소식글 작성 설정 (클라이언트·서버 공용)
export const PROMO_KINDS = [
  { id: "recruit", label: "홍보·모집글", hint: "행사·프로그램 참가자 모집, 안내" },
  { id: "news", label: "소식·후기글", hint: "행사를 마친 뒤 결과와 분위기를 전하는 글" },
] as const;
export type PromoKindId = (typeof PROMO_KINDS)[number]["id"];

export const PROMO_CHANNELS = [
  { id: "blog", label: "블로그", spec: "제목 + 소제목이 있는 본문 800~1,500자. 도입 → 핵심 내용 → 안내/마무리 순서." },
  { id: "instagram", label: "인스타그램", spec: "첫 줄에 눈길을 끄는 한 문장, 본문 300~600자, 줄바꿈 많이, 이모지는 적당히, 해시태그 8~12개." },
  { id: "facebook", label: "페이스북", spec: "'더 보기' 전에 보이는 첫 2~3줄에 핵심(무엇을·언제·누구에게)을 담고, 본문 400~900자의 친근한 존댓말. 일시·장소·신청방법은 항목으로 정리하고 신청 링크 자리는 [링크 확인 필요]로 표시. 이모지는 적당히, 해시태그는 3~5개." },
  { id: "kakao", label: "카카오채널·문자", spec: "공백 포함 400자 이내, 일시·장소·신청방법을 항목으로 분명하게. 이모지는 최소." },
  { id: "press", label: "보도자료", spec: "제목·부제 + 리드문(육하원칙) + 본문 + 기관 소개 순서의 보도자료 문체(~했다/~한다)." },
  { id: "newsletter", label: "기관 소식지", spec: "차분한 존댓말, 600~1,000자, 행사 의미와 참여자 이야기 중심." },
] as const;
export type PromoChannelId = (typeof PROMO_CHANNELS)[number]["id"];
