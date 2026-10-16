import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { REVIEW_CRITERIA } from "@shared/grantGuide";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Progress } from "@/components/ui/progress";

type Result = {
  overall: number;
  summary: string;
  criteria: { id: string; score: number; strengths: string[]; improvements: string[] }[];
  missing: string[];
};

type Props = { planId: number; saved?: { at: number; result: Result } | null };

/** 공동모금회 심사 관점(필요성·목표 타당성·예산·일관성)으로 사업계획서를 진단한다. */
export default function SelfCheckPanel({ planId, saved }: Props) {
  const utils = trpc.useUtils();
  const mutation = trpc.businessPlans.selfCheck.useMutation({
    onSuccess: () => {
      utils.businessPlans.get.invalidate({ id: planId });
      toast.success("자가진단이 완료되었습니다.");
    },
    onError: (e) => toast.error(e.message || "자가진단에 실패했습니다."),
  });

  const result: Result | null = mutation.data ?? saved?.result ?? null;
  const titleOf = (id: string) => REVIEW_CRITERIA.find((c) => c.id === id)?.title ?? id;

  return (
    <Card className="mb-6 border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4" />
            심사기준 자가진단
          </CardTitle>
          <Button size="sm" onClick={() => mutation.mutate({ planId })} disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner className="w-4 h-4 mr-2" /> : null}
            {result ? "다시 진단" : "진단하기"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          필요성 · 목표/평가 타당성 · 예산 합리성 · 일관성 관점의 AI 점검입니다. 참고용이며, 실제 심사는 해당 연도
          공고문의 기준을 따릅니다.
        </p>
      </CardHeader>
      {result && (
        <CardContent className="space-y-4">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold">{result.overall}</span>
            <span className="text-sm text-muted-foreground">/ 100 · {result.summary}</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {result.criteria.map((c) => (
              <div key={c.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>{titleOf(c.id)}</span>
                  <span>{c.score}점</span>
                </div>
                <Progress value={c.score} />
                {c.strengths.length > 0 && (
                  <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                    {c.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                )}
                {c.improvements.length > 0 && (
                  <ul className="text-xs list-disc pl-4 space-y-0.5 text-foreground">
                    {c.improvements.map((s, i) => (
                      <li key={i}>
                        <span className="font-medium">보완: </span>
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
          {result.missing.length > 0 && (
            <div className="text-xs">
              <p className="font-medium mb-1">비어 있거나 확인이 필요한 항목</p>
              <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                {result.missing.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
