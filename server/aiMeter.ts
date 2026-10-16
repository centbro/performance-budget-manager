import { AsyncLocalStorage } from "node:async_hooks";

/** 요청 단위로 "누가 어떤 기능으로 AI를 쓰는지"를 들고 다니는 저장소 */
export const aiStore = new AsyncLocalStorage<{ userId: number; feature: string }>();

type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
type Sink = (e: { userId: number; feature: string; model: string; promptTokens: number; completionTokens: number }) => void;
let sink: Sink | null = null;
export const setUsageSink = (s: Sink) => { sink = s; };

/** invokeLLM이 성공할 때마다 호출 — 토큰 사용량을 기록한다(실패해도 본 기능에는 영향 없음). */
export function reportUsage(model: string, usage: Usage) {
  const ctx = aiStore.getStore();
  if (!ctx || !sink) return;
  try {
    sink({
      userId: ctx.userId,
      feature: ctx.feature,
      model,
      promptTokens: usage?.prompt_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? Math.max(0, (usage?.total_tokens ?? 0) - (usage?.prompt_tokens ?? 0)),
    });
  } catch (e) {
    console.warn("[aiMeter] usage sink failed", e);
  }
}
