import { PROMO_CHANNELS, PROMO_KINDS, type PromoChannelId, type PromoKindId } from "../shared/promo";
import { extractJson } from "./docTemplate";

export type PromoSample = { name: string; channel: string; body: string };
export type PromoVariant = { label: string; title: string; body: string; hashtags: string[] };

const channelOf = (id: string) => PROMO_CHANNELS.find((c) => c.id === id) ?? PROMO_CHANNELS[0];
const kindOf = (id: string) => PROMO_KINDS.find((k) => k.id === id) ?? PROMO_KINDS[0];

function sampleBlock(samples: PromoSample[]) {
  if (!samples.length) return "";
  const body = samples
    .slice(0, 3)
    .map((s, i) => `[샘플 ${i + 1}: ${s.name}${s.channel ? ` / ${s.channel}` : ""}]\n${s.body.slice(0, 2500)}`)
    .join("\n\n");
  return `\n[기관이 평소 쓰는 글(샘플)]\n말투·문장 길이·이모지 사용·글의 구성·마무리 방식만 따라 하세요. 샘플의 행사명·일시·숫자·문장은 절대 가져오지 않습니다.\n${body}\n`;
}

export function buildPromoPrompt(
  input: { kind: PromoKindId; channel: PromoChannelId; org: string; facts: string; extra?: string; count?: number },
  samples: PromoSample[]
) {
  const ch = channelOf(input.channel);
  const kind = kindOf(input.kind);
  const n = Math.min(3, Math.max(1, input.count ?? 3));
  const system = `당신은 사회복지기관의 홍보 담당자를 돕는 카피라이터입니다. 담당자가 몇 가지만 알려 주면 ${kind.label}을 ${ch.label}용으로 씁니다.

[원칙]
- 담당자가 준 사실만 씁니다. 일시·장소·대상·신청방법·문의처·수치 중 주어지지 않은 것은 지어내지 말고 "[확인 필요: 항목]"으로 표시합니다.
- ${input.kind === "news" ? "참여자 이름·얼굴·개인 사연은 본인 동의가 확인된 경우에만 쓰도록, 이름은 담당자가 준 표기 그대로만 사용합니다. 과장된 성과 표현을 피합니다." : "참가 대상과 신청 방법이 한눈에 보이게 쓰고, 과장·허위 표현(\"무조건\", \"100%\")은 쓰지 않습니다."}
- 채널 형식: ${ch.spec}
- 서로 다른 접근의 안 ${n}개를 만듭니다(예: 정보 중심 / 감성 중심 / 짧고 강렬). 각 안에 label(접근 이름)을 붙입니다.
- 기관명: ${input.org || "(미지정)"}${sampleBlock(samples)}
JSON 객체 하나만 출력(코드블록 금지): {"variants":[{"label":"","title":"","body":"","hashtags":["#...","#..."]}]}
title은 보도자료·블로그·소식지에서는 제목, 그 외 채널은 첫 줄 문구입니다. hashtags는 해당 채널에서 쓰지 않으면 빈 배열입니다.`;
  const user = `알리려는 내용:\n${input.facts}${input.extra ? `\n추가 요청: ${input.extra}` : ""}`;
  return { system, user };
}

export function parsePromo(raw: string): PromoVariant[] {
  const o = extractJson(raw);
  const arr: any[] = Array.isArray(o?.variants) ? o.variants : [];
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const list = arr
    .map((v) => ({
      label: str(v?.label) || "초안",
      title: str(v?.title),
      body: str(v?.body),
      hashtags: Array.isArray(v?.hashtags) ? v.hashtags.map(String).map((h: string) => h.trim()).filter(Boolean).slice(0, 20) : [],
    }))
    .filter((v) => v.body)
    .slice(0, 3);
  if (list.length === 0 && raw.trim() && !o) return [{ label: "초안", title: "", body: raw.trim(), hashtags: [] }];
  return list;
}

export function buildRefinePrompt(
  input: { channel: PromoChannelId; title: string; body: string; instruction: string },
  samples: PromoSample[]
) {
  const ch = channelOf(input.channel);
  const system = `당신은 사회복지기관 홍보 글 편집자입니다. 아래 글을 담당자의 요청대로만 고쳐 다시 씁니다.
- 요청하지 않은 사실·수치는 바꾸거나 추가하지 않고, 없는 정보는 "[확인 필요: 항목]"으로 둡니다.
- 채널 형식: ${ch.label} — ${ch.spec}${sampleBlock(samples)}
JSON 객체 하나만 출력(코드블록 금지): {"variants":[{"label":"수정본","title":"","body":"","hashtags":[]}]}`;
  const user = `[현재 글]\n제목: ${input.title}\n${input.body}\n\n[수정 요청]\n${input.instruction}`;
  return { system, user };
}
