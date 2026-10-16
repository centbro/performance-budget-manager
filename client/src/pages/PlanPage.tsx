import { Check, Lock, Minus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import TelegramCard from "@/components/TelegramCard";
import { accessLabel } from "@/components/AccessDialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AI_FEATURES, FAIR_USE_MONTHLY_CALLS, PLANS, type AiFeatureKey } from "@shared/plans";

export default function PlanPage() {
  const { data, isLoading } = trpc.plan.status.useQuery();
  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold">내 이용 현황·요금제</h1>
          <p className="text-muted-foreground text-sm mt-1">요금제, 남은 이용 기간, 이번 달 AI 사용량을 확인할 수 있습니다.</p>
        </div>
        {isLoading || !data ? <Skeleton className="h-40 w-full" /> : (
          <>
            <Card>
              <CardContent className="pt-6 grid gap-4 sm:grid-cols-3">
                <div><p className="text-xs text-muted-foreground">현재 요금제</p>
                  <p className="text-lg font-semibold mt-1">{data.isAdmin ? "관리자" : PLANS[data.plan].label} {!data.isAdmin && <span className="text-sm font-normal text-muted-foreground">월 {PLANS[data.plan].price.toLocaleString()}원</span>}</p></div>
                <div><p className="text-xs text-muted-foreground">이용 기간</p>
                  <p className={`text-lg font-semibold mt-1 ${data.isAdmin ? "" : accessLabel(data.accessUntil).cls}`}>{data.isAdmin ? "제한 없음" : accessLabel(data.accessUntil).text}</p></div>
                <div><p className="text-xs text-muted-foreground">이번 달 AI 사용</p>
                  <p className="text-lg font-semibold mt-1">{data.total}회 <span className="text-sm font-normal text-muted-foreground">/ 공정 사용 {FAIR_USE_MONTHLY_CALLS}회</span></p></div>
              </CardContent>
            </Card>

            <TelegramCard />

            <Card>
              <CardHeader><CardTitle className="text-base">기능별 이번 달 사용량</CardTitle>
                <CardDescription>매월 1일(한국 시간)에 초기화됩니다. 이용 기간이 끝나도 만든 기록·일정은 계속 볼 수 있고, AI 생성 기능만 멈춥니다.</CardDescription></CardHeader>
              <CardContent className="divide-y">
                {data.features.map((f) => (
                  <div key={f.key} className="flex items-center justify-between py-2 text-sm">
                    <span>{f.label}</span>
                    {f.locked ? <Badge variant="outline" className="gap-1 text-amber-700"><Lock className="h-3 w-3" />프리미엄 전용</Badge>
                      : <span className="text-muted-foreground">{f.used}회 사용{f.limit !== null ? ` / 월 ${f.limit}회` : " · 제한 없음"}</span>}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">요금제 비교</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left border-b"><th className="py-2 pr-3">기능</th>
                    {(["pro", "premium"] as const).map((p) => <th key={p} className="py-2 px-3">{PLANS[p].label}<div className="text-xs font-normal text-muted-foreground">월 {PLANS[p].price.toLocaleString()}원</div></th>)}</tr></thead>
                  <tbody className="divide-y">
                    {(Object.keys(AI_FEATURES) as AiFeatureKey[]).map((k) => {
                      const pol = AI_FEATURES[k];
                      const cell = (p: "pro" | "premium") => pol.premiumOnly && p === "pro" ? <Minus className="h-4 w-4 text-muted-foreground" />
                        : pol.monthly[p] !== undefined ? <span>월 {pol.monthly[p]}회</span> : <span className="flex items-center gap-1 text-emerald-600"><Check className="h-4 w-4" />제한 없음</span>;
                      return <tr key={k}><td className="py-2 pr-3">{pol.label}</td><td className="py-2 px-3">{cell("pro")}</td><td className="py-2 px-3">{cell("premium")}</td></tr>;
                    })}
                  </tbody>
                </table>
                <p className="text-xs text-muted-foreground mt-3">사업 관리·사례 기록 저장·일정·실적 조회 등 AI를 쓰지 않는 기능은 두 요금제 모두 제한이 없습니다. 요금제 변경·연장은 의견 게시판으로 문의해 주세요.</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
