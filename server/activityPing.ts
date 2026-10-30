/**
 * 활동 알림(ping): AI가 "어떤 종류의 일"을 하는지만 별도 서버에 알린다.
 * 보내는 값은 type과 phase 둘뿐이다. 사용자 입력·파일명·이름·문서 내용·사용자 식별 정보는 어떤 형태로도 보내지 않는다.
 * 실패하거나 느려도 사이트 기능에 영향이 없도록 기다리지 않고(fire-and-forget) 오류는 무시한다. 비밀키는 쓰지 않는다.
 */
import type { AiFeatureKey } from "../shared/plans";

export type PingType = "plan" | "doc" | "case" | "chat";
export type PingPhase = "start" | "end" | "error";

const PING_URL = "https://yageun-office.sunakapark.workers.dev/api/ping";

/** 사업계획서 생성=plan, 공문서=doc, 사례 기록=case, 그 밖의 실무 질문=chat */
const TYPE_OF: Partial<Record<AiFeatureKey, PingType>> = {
  plan_chat: "plan", plan_generate: "plan", grant_review: "plan",
  doc: "doc", template_fill: "doc", template_upload: "doc", doc_chat: "doc", doc_chat_pick: "doc", result_report: "doc", evaluation: "doc", translate: "doc", folder_summary: "doc",
  case_record: "case",
};
export const pingTypeOf = (feature: AiFeatureKey): PingType => TYPE_OF[feature] ?? "chat";

export function pingActivity(feature: AiFeatureKey, phase: PingPhase): void {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) return;
  try {
    // 서버에서 부르므로 Origin 헤더를 직접 붙인다. 응답은 기다리지 않는다.
    void fetch(PING_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain", Origin: "https://www.psk.lol" },
      body: JSON.stringify({ type: pingTypeOf(feature), phase }),
      signal: AbortSignal.timeout(3000),
    }).catch(() => { /* 무시 */ });
  } catch { /* 무시 */ }
}
