import { Lock, Info } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import type { AiFeatureKey } from "@shared/plans";

/** 프리미엄 전용/월 한도 기능 위에 붙이는 안내. 쓸 수 있고 한도도 넉넉하면 아무것도 표시하지 않음. */
export default function PlanNotice({ feature }: { feature: AiFeatureKey }) {
  const { data } = trpc.plan.status.useQuery(undefined, { staleTime: 30_000 });
  const [, setLocation] = useLocation();
  const f = data?.features.find((x) => x.key === feature);
  if (!data || !f || data.isAdmin) return null;
  if (f.locked) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        <Lock className="h-4 w-4 shrink-0" />
        <span className="flex-1">'{f.label}'은(는) <b>프리미엄 요금제</b> 전용입니다. 현재 요금제: 프로</span>
        <button className="underline font-medium" onClick={() => setLocation("/my-plan")}>요금제 보기</button>
      </div>
    );
  }
  if (f.limit !== null) {
    const left = Math.max(0, f.limit - f.used);
    return (
      <div className="mb-4 flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <Info className="h-4 w-4 shrink-0" />
        <span className="flex-1">이번 달 '{f.label}' <b className={left === 0 ? "text-rose-600" : "text-foreground"}>{left}회</b> 남음 ({f.used}/{f.limit})</span>
        <button className="underline" onClick={() => setLocation("/my-plan")}>자세히</button>
      </div>
    );
  }
  return null;
}
