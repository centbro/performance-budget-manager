import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// 대략적 비용 추정(Gemini 3.8 Flash 2026-12-31까지 단가, 달러/100만 토큰). 환율 1,400원 가정.
const USD_IN = 0.75, USD_OUT = 3.75, KRW = 1400;
const won = (i: number, o: number) => Math.round(((i * USD_IN + o * USD_OUT) / 1_000_000) * KRW);

/** 관리자: 이번 달 AI 사용량·추정 비용 */
export default function AdminUsageCard() {
  const { data } = trpc.plan.adminUsage.useQuery();
  if (!data) return null;
  const tot = data.byFeature.reduce((a, r) => ({ c: a.c + r.calls, i: a.i + r.inTok, o: a.o + r.outTok }), { c: 0, i: 0, o: 0 });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">이번 달 AI 사용량·추정 비용</CardTitle>
        <CardDescription>
          총 {tot.c}회 · 입력 {tot.i.toLocaleString()} / 출력 {tot.o.toLocaleString()} 토큰 · 추정 약 {won(tot.i, tot.o).toLocaleString()}원
          (flash 단가 기준 추정, 정확한 금액은 Google 청구서 기준)
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2 text-sm">
        <div>
          <p className="font-medium mb-2">기능별</p>
          {data.byFeature.length === 0 ? <p className="text-muted-foreground">아직 기록이 없습니다.</p> :
            data.byFeature.map((r) => (
              <div key={r.feature} className="flex justify-between py-1 border-b last:border-0">
                <span>{r.label}</span><span className="text-muted-foreground">{r.calls}회 · 약 {won(r.inTok, r.outTok).toLocaleString()}원</span>
              </div>
            ))}
        </div>
        <div>
          <p className="font-medium mb-2">사용자별 (상위)</p>
          {data.byUser.length === 0 ? <p className="text-muted-foreground">아직 기록이 없습니다.</p> :
            data.byUser.map((r) => (
              <div key={r.userId} className="flex justify-between py-1 border-b last:border-0">
                <span>{r.name}</span><span className="text-muted-foreground">{r.calls}회 · 약 {won(r.inTok, r.outTok).toLocaleString()}원</span>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
