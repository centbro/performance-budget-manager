import { useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Copy, FileUp, HelpCircle, Sparkles, XCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Rubric = {
  programName: string; basis: "stated" | "estimated";
  criteria: { id: string; name: string; maxScore: number; description: string }[];
  requirements: { id: string; kind: string; text: string }[];
};

/** PDF를 올리거나 글을 붙여 넣는 입력 칸 */
function TextSource({ label, text, setText, hint, minHeight }: { label: string; text: string; setText: (t: string) => void; hint: string; minHeight: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/extract-text", { method: "POST", body: fd, credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "PDF를 읽지 못했습니다.");
      setText(body.text);
      toast.success(`${label}을(를) 읽었습니다 (${Number(body.chars).toLocaleString()}자).`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input ref={ref} type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <Button variant="outline" size="sm" disabled={busy} onClick={() => ref.current?.click()}>
          {busy ? <Spinner className="w-4 h-4 mr-2" /> : <FileUp className="w-4 h-4 mr-2" />}PDF 올리기
        </Button>
        <span className="text-xs text-muted-foreground">{text ? `${text.length.toLocaleString()}자 입력됨` : "또는 아래에 직접 붙여 넣기"}</span>
      </div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} className={`text-sm ${minHeight}`} placeholder={hint} />
    </div>
  );
}

const statusStyle = {
  충족: { icon: CheckCircle2, cls: "text-emerald-600" },
  미충족: { icon: XCircle, cls: "text-rose-600" },
  확인불가: { icon: HelpCircle, cls: "text-amber-600" },
} as const;

export default function GrantReviewPage() {
  const [guideline, setGuideline] = useState("");
  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [plan, setPlan] = useState("");
  const [prev, setPrev] = useState<number | null>(null);
  const plans = trpc.businessPlans.list.useQuery();
  const utils = trpc.useUtils();

  const analyze = trpc.grantReview.analyze.useMutation({
    onSuccess: (d) => {
      setRubric(d.rubric);
      if (d.truncated) toast.message("모집요강이 길어 앞부분 위주로 분석했습니다.");
    },
    onError: (e) => toast.error(e.message),
  });
  const evaluate = trpc.grantReview.evaluate.useMutation({
    onError: (e) => toast.error(e.message),
  });
  const review = evaluate.data?.review;

  const loadPlan = async (id: string) => {
    try {
      const p = await utils.businessPlans.get.fetch({ id: Number(id) });
      const text = p.generatedContent.map((s) => `## ${s.title}\n${s.content}`).join("\n\n").trim();
      if (!text) return toast.error("이 사업계획서에는 아직 생성된 내용이 없습니다.");
      setPlan(`${p.title}\n\n${text}`);
      toast.success("사업계획서를 불러왔습니다.");
    } catch {
      toast.error("불러오지 못했습니다.");
    }
  };

  const run = () => {
    if (!rubric) return toast.error("먼저 모집요강을 분석해 주세요.");
    if (plan.trim().length < 200) return toast.error("평가할 사업계획서를 입력해 주세요.");
    if (review) setPrev(review.total);
    evaluate.mutate({ rubric, planText: plan.trim(), guidelineText: guideline.trim() || undefined });
  };

  const copyReport = () => {
    if (!review) return;
    const t = [
      `[공모사업 점수 평가] ${rubric?.programName ?? ""}`,
      `총점 ${review.total}/${review.maxTotal} (${review.percent}점 환산)`,
      review.summary,
      "",
      ...review.criteria.flatMap((c) => [`■ ${c.name} ${c.score}/${c.maxScore}`, ...c.strengths.map((s) => `  + ${s}`), ...c.improvements.map((s) => `  - 보완: ${s}`)]),
      "",
      "■ 우선 보완 3가지",
      ...review.priorities.map((p, i) => `${i + 1}. ${p.title} (${p.expectedGain}) - ${p.why}`),
    ].join("\n");
    navigator.clipboard.writeText(t).then(() => toast.success("평가 결과를 복사했습니다."));
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardCheck className="w-6 h-6" />공모사업 점수 평가</h1>
          <p className="text-muted-foreground text-sm mt-1">모집요강(지침)을 첨부하면 그 심사기준에 맞춰 사업계획서를 채점하고, 잘된 점·보완할 점·요건 충족 여부를 알려 드립니다.</p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">1. 모집요강·지침 첨부</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <TextSource label="모집요강" text={guideline} setText={(t) => { setGuideline(t); setRubric(null); }} minHeight="min-h-[150px]" hint="공모 안내문(심사기준·배점·신청자격·예산 규정이 있는 부분)을 PDF로 올리거나 붙여 넣으세요." />
              <Button className="w-full" variant="outline" disabled={analyze.isPending} onClick={() => guideline.trim().length >= 200 ? analyze.mutate({ text: guideline.trim() }) : toast.error("모집요강을 먼저 입력해 주세요.")}>
                {analyze.isPending ? <Spinner className="w-4 h-4 mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                {analyze.isPending ? "심사기준 찾는 중…" : "모집요강 분석"}
              </Button>
              {rubric && (
                <div className="rounded-lg border p-3 space-y-2 text-sm">
                  <p className="font-medium">{rubric.programName || "심사기준"}</p>
                  {rubric.basis === "estimated" && (
                    <p className="flex gap-1 text-xs text-amber-700"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />지침에서 배점을 찾지 못해 항목별 균등 배점으로 가정했습니다. 실제 배점과 다를 수 있습니다.</p>
                  )}
                  <ul className="space-y-1">
                    {rubric.criteria.map((c) => (
                      <li key={c.id} className="flex gap-2"><Badge variant="secondary" className="shrink-0">{c.maxScore}점</Badge><span><b>{c.name}</b>{c.description ? <span className="text-muted-foreground"> — {c.description}</span> : null}</span></li>
                    ))}
                  </ul>
                  {rubric.requirements.length > 0 && <p className="text-xs text-muted-foreground">필수 요건 {rubric.requirements.length}개도 함께 확인합니다.</p>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">2. 평가할 사업계획서</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(plans.data ?? []).length > 0 && (
                <Select onValueChange={loadPlan}>
                  <SelectTrigger><SelectValue placeholder="작성해 둔 사업계획서 불러오기" /></SelectTrigger>
                  <SelectContent>{(plans.data ?? []).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.year}년 · {p.title}</SelectItem>)}</SelectContent>
                </Select>
              )}
              <TextSource label="사업계획서" text={plan} setText={setPlan} minHeight="min-h-[190px]" hint="사업계획서 전문을 PDF로 올리거나 붙여 넣으세요. 고친 뒤 다시 평가하면 점수 변화를 볼 수 있습니다." />
              <Button className="w-full" disabled={evaluate.isPending || !rubric} onClick={run}>
                {evaluate.isPending ? <Spinner className="w-4 h-4 mr-2" /> : <ClipboardCheck className="w-4 h-4 mr-2" />}
                {evaluate.isPending ? "채점 중… (최대 1~2분)" : review ? "고친 내용으로 다시 평가" : "점수 평가하기"}
              </Button>
              {!rubric && <p className="text-xs text-muted-foreground">먼저 왼쪽에서 모집요강을 분석해야 평가할 수 있습니다.</p>}
            </CardContent>
          </Card>
        </div>

        {review && (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-5 flex flex-wrap items-center gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">예상 점수</p>
                  <p className="text-4xl font-bold">{review.total}<span className="text-lg text-muted-foreground"> / {review.maxTotal}</span></p>
                  {rubric?.basis === "stated" && review.maxTotal !== 100 && <p className="text-xs text-muted-foreground">100점 환산 {review.percent}점</p>}
                  {prev !== null && <p className={`text-sm mt-1 ${review.total >= prev ? "text-emerald-600" : "text-rose-600"}`}>이전 평가 {prev}점 → {review.total >= prev ? "+" : ""}{review.total - prev}점</p>}
                </div>
                <p className="flex-1 min-w-[240px] text-sm leading-relaxed">{review.summary}</p>
                <Button variant="outline" size="sm" onClick={copyReport}><Copy className="w-4 h-4 mr-1" />결과 복사</Button>
              </CardContent>
            </Card>

            {review.priorities.length > 0 && (
              <Card className="border-primary/40">
                <CardHeader className="pb-2"><CardTitle className="text-sm">가장 먼저 보완하면 좋은 3가지</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {review.priorities.map((p, i) => (
                    <div key={i} className="flex gap-2"><Badge className="shrink-0 h-5">{i + 1}</Badge><div><b>{p.title}</b> {p.expectedGain && <Badge variant="outline" className="ml-1">{p.expectedGain}</Badge>}<p className="text-muted-foreground">{p.why}</p></div></div>
                  ))}
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              {review.criteria.map((c) => (
                <Card key={c.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between"><span>{c.name}</span><span>{c.score} / {c.maxScore}</span></CardTitle>
                    <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary/70" style={{ width: `${c.maxScore ? (c.score / c.maxScore) * 100 : 0}%` }} /></div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {c.evidence && <p className="text-xs text-muted-foreground">근거: “{c.evidence}”</p>}
                    {c.strengths.map((s, i) => <p key={i} className="flex gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />{s}</p>)}
                    {c.improvements.map((s, i) => <p key={i} className="flex gap-1.5"><AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />{s}</p>)}
                  </CardContent>
                </Card>
              ))}
            </div>

            {review.requirements.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">필수 요건 점검</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {review.requirements.map((r) => {
                    const st = statusStyle[r.status];
                    return (
                      <div key={r.id} className="flex gap-2">
                        <st.icon className={`w-4 h-4 mt-0.5 shrink-0 ${st.cls}`} />
                        <div><span className="text-xs text-muted-foreground">[{r.kind}]</span> {r.text} <b className={st.cls}>{r.status}</b>{r.comment && <p className="text-muted-foreground">{r.comment}</p>}</div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
            <p className="text-xs text-muted-foreground">이 점수는 AI가 모집요강 기준으로 추정한 값으로, 실제 심사 결과와 다를 수 있습니다. 제출 전 모집요강 원문과 대조해 확인하세요.{evaluate.data?.planTruncated ? " 계획서가 길어 앞부분 위주로 평가했습니다." : ""}</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
