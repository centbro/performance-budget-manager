import { TRPCError } from "@trpc/server";
import { AI_FEATURES, checkAiAccess, monthStartKst, type AiFeatureKey } from "../shared/plans";
import { aiStore, setUsageSink } from "./aiMeter";
import { getMonthlyCounts, logAiUsage } from "./aiUsageDb";
import { findUserById } from "./auth-local";
import { protectedProcedure } from "./_core/trpc";
import { pingActivity } from "./activityPing";

setUsageSink((e) => { void logAiUsage(e).catch((err) => console.warn("[aiUsage] log failed", err?.message)); });

/** 요금제·이용기간·월 한도를 확인한 뒤 fn을 실행(사용량은 이 요청 안의 AI 호출마다 기록됨). 막히면 FORBIDDEN. */
export async function runWithAi<T>(userId: number, feature: AiFeatureKey, fn: () => Promise<T>): Promise<T> {
  const u = await findUserById(userId);
  if (!u) throw new TRPCError({ code: "UNAUTHORIZED" });
  if (u.role !== "admin") {
    const counts = await getMonthlyCounts(userId, monthStartKst());
    const usedTotal = Object.values(counts).reduce((a, b) => a + b, 0);
    const d = checkAiAccess({ role: u.role, plan: u.plan, accessUntil: u.accessUntil, feature, usedThisFeature: counts[feature] ?? 0, usedTotal });
    if (!d.ok) throw new TRPCError({ code: "FORBIDDEN", message: d.message });
  }
  // 요금제·한도를 통과한 뒤 AI 요청을 시작할 때 "어떤 종류의 일인지"만 알린다(결과를 기다리지 않음).
  pingActivity(feature, "start");
  try {
    const r = await aiStore.run({ userId, feature }, fn);
    // tRPC 미들웨어는 오류를 던지지 않고 { ok:false }로 돌려주므로 그것도 실패로 센다.
    const failed = typeof r === "object" && r !== null && "ok" in r && (r as { ok?: unknown }).ok === false;
    pingActivity(feature, failed ? "error" : "end");
    return r;
  } catch (e) {
    pingActivity(feature, "error");
    throw e;
  }
}

/** AI를 쓰는 프로시저용 */
export const aiProcedure = (feature: AiFeatureKey) =>
  protectedProcedure.use(async ({ ctx, next }) => runWithAi(ctx.user.id, feature, () => next()));

export { AI_FEATURES };
