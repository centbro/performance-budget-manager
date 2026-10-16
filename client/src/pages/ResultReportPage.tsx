import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Copy, Download, FileCheck, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import OrgStyleCard from "@/components/OrgStyleCard";
import PlanNotice from "@/components/PlanNotice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const thisYear = new Date().getFullYear();
const PERIODS = [
  { value: "q1", label: "1분기 (1~3월)" }, { value: "q2", label: "2분기 (4~6월)" },
  { value: "q3", label: "3분기 (7~9월)" }, { value: "q4", label: "4분기 (10~12월)" },
  { value: "h1", label: "상반기 (1~6월)" }, { value: "h2", label: "하반기 (7~12월)" },
  { value: "annual", label: "연간 (1~12월)" }, { value: "custom", label: "사용자 지정" },
] as const;
type Period = (typeof PERIODS)[number]["value"];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

type Section = { key: string; heading: string; content: string };

export default function ResultReportPage() {
  const [year, setYear] = useState(thisYear);
  const [parentId, setParentId] = useState("");
  const [period, setPeriod] = useState<Period>("annual");
  const [startM, setStartM] = useState(1);
  const [endM, setEndM] = useState(12);
  const [att, setAtt] = useState(true);
  const [cases, setCases] = useState(false);
  const [tone, setTone] = useState<"eumseum" | "hamnida">("eumseum");
  const [extra, setExtra] = useState("");
  const [sections, setSections] = useState<Section[] | null>(null);
  const [meta, setMeta] = useState("");
  const [showFacts, setShowFacts] = useState(false);

  const parents = trpc.projects.listParents.useQuery({ year });
  const periodOk = period !== "custom" || startM <= endM;
  const common = useMemo(() => parentId && periodOk ? {
    parentId: Number(parentId), year, period,
    customStartMonth: period === "custom" ? startM : undefined,
    customEndMonth: period === "custom" ? endM : undefined,
    includeAttendance: att, includeCases: cases,
  } : null, [parentId, year, period, startM, endM, att, cases, periodOk]);

  const facts = trpc.reports.facts.useQuery(common as NonNullable<typeof common>, { enabled: !!common, retry: false });
  const gen = trpc.reports.generate.useMutation({
    onSuccess: (r) => { setSections(r.sections); setMeta(`${r.year}년 ${r.projectName} ${r.periodLabel} 결과보고서`); toast.success("결과보고서 초안을 만들었습니다. [확인 필요] 표시를 채워 주세요."); },
    onError: (e) => toast.error(e.message || "생성에 실패했습니다."),
  });

  const fullText = () => `${meta}\n\n` + (sections ?? []).map((s, i) => `${i + 1}. ${s.heading}\n${s.content}`).join("\n\n");
  const copy = async () => { try { await navigator.clipboard.writeText(fullText()); toast.success("전체를 복사했습니다."); } catch { toast.error("복사에 실패했습니다."); } };
  const download = () => {
    const blob = new Blob([fullText()], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${meta || "결과보고서"}.txt`; a.click(); URL.revokeObjectURL(a.href);
  };
  const pending = (sections ?? []).filter((s) => s.content.includes("[확인 필요")).length;
  const f = facts.data?.facts;

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold flex items-center gap-2"><FileCheck className="w-6 h-6" />결과보고서</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-5">이미 입력해 둔 실적·출석부·예산을 자동으로 모아 결과보고서 7개 항목을 한 번에 씁니다. 데이터에 없는 내용은 지어내지 않고 [확인 필요]로 표시합니다.</p>
        <PlanNotice feature="result_report" />
        <OrgStyleCard />
        <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">1. 어떤 사업의 보고서인가요?</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">연도</Label>
                    <Select value={String(year)} onValueChange={(v) => { setYear(Number(v)); setParentId(""); }}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{[thisYear - 2, thisYear - 1, thisYear, thisYear + 1].map((y) => <SelectItem key={y} value={String(y)}>{y}년</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">기간</Label>
                    <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                {period === "custom" && (
                  <div className="flex items-center gap-2 text-sm">
                    <Select value={String(startM)} onValueChange={(v) => setStartM(Number(v))}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((m) => <SelectItem key={m} value={String(m)}>{m}월</SelectItem>)}</SelectContent></Select>
                    ~
                    <Select value={String(endM)} onValueChange={(v) => setEndM(Number(v))}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((m) => <SelectItem key={m} value={String(m)}>{m}월</SelectItem>)}</SelectContent></Select>
                    {!periodOk && <span className="text-xs text-rose-600">시작월이 더 빨라야 합니다</span>}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs">사업</Label>
                  <Select value={parentId} onValueChange={setParentId}>
                    <SelectTrigger className="w-full"><SelectValue placeholder={parents.data?.length === 0 ? `${year}년에 등록된 사업이 없습니다` : "사업 선택"} /></SelectTrigger>
                    <SelectContent>{(parents.data ?? []).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.projectName}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <label className="flex items-start gap-2 text-sm"><Checkbox checked={att} onCheckedChange={(v) => setAtt(v === true)} className="mt-0.5" /><span>출석부 기록 포함<span className="block text-xs text-muted-foreground">반별 실인원·연인원·출석률</span></span></label>
                <label className="flex items-start gap-2 text-sm"><Checkbox checked={cases} onCheckedChange={(v) => setCases(v === true)} className="mt-0.5" /><span>사례 기록 통계 포함<span className="block text-xs text-muted-foreground">사업 구분 없이 기관 전체 기준입니다</span></span></label>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">2. 문체와 추가 설명</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Select value={tone} onValueChange={(v) => setTone(v as "eumseum" | "hamnida")}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eumseum">음슴체 (~함, ~임)</SelectItem>
                    <SelectItem value="hamnida">합니다체 (~하였습니다)</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea value={extra} onChange={(e) => setExtra(e.target.value)} className="min-h-[90px] text-sm" maxLength={2000}
                  placeholder="데이터에 없는 사실이 있으면 적어 주세요. 예: 사업 목적, 협력 기관, 참여자 반응, 특이사항" />
                <Button className="w-full" disabled={!common || gen.isPending} onClick={() => common && gen.mutate({ ...common, tone, extra: extra.trim() || undefined })}>
                  {gen.isPending ? <Spinner className="w-4 h-4 mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  {gen.isPending ? "작성 중… (최대 1분)" : "결과보고서 생성"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 min-w-0">
            {common && (
              <Card>
                <button type="button" className="w-full flex items-center gap-2 px-4 py-3 text-left" onClick={() => setShowFacts((v) => !v)}>
                  <span className="flex-1 text-sm font-medium">보고서에 들어갈 데이터 확인</span>
                  {facts.isLoading && <Spinner className="w-4 h-4" />}
                  {f && <span className="text-xs text-muted-foreground">실인원 {f.uniquePeople}명 · 연인원 {f.subs.reduce((s, x) => s + x.actualExtended, 0)}명</span>}
                  {showFacts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showFacts && (
                  <CardContent className="pt-0">
                    {facts.error ? <p className="text-sm text-rose-600">{facts.error.message}</p> : <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed bg-muted/40 rounded-md p-3 max-h-72 overflow-y-auto">{facts.data?.text}</pre>}
                  </CardContent>
                )}
              </Card>
            )}

            {!sections && !gen.isPending && (
              <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">사업과 기간을 고르고 ‘결과보고서 생성’을 누르면 여기에 7개 항목이 나옵니다.</CardContent></Card>
            )}
            {gen.isPending && <Card><CardContent className="py-12 text-center text-sm text-muted-foreground"><Spinner className="w-5 h-5 mx-auto mb-2" />실적과 출석 데이터를 바탕으로 보고서를 쓰고 있습니다…</CardContent></Card>}

            {sections && !gen.isPending && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="flex-1 text-sm font-medium min-w-0 break-words">{meta}</p>
                  <Button variant="outline" size="sm" onClick={copy}><Copy className="w-4 h-4 mr-1" />전체 복사</Button>
                  <Button variant="outline" size="sm" onClick={download}><Download className="w-4 h-4 mr-1" />텍스트 저장</Button>
                </div>
                {pending > 0 && <p className="text-xs rounded-md border border-amber-300/60 bg-amber-50 text-amber-800 px-3 py-2">[확인 필요]가 {pending}개 항목에 있습니다. 데이터에 없어 비워 둔 부분이니 직접 채운 뒤 제출하세요.</p>}
                {sections.map((s, i) => (
                  <Card key={s.key}>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">{i + 1}. {s.heading}</CardTitle></CardHeader>
                    <CardContent>
                      <Textarea value={s.content} onChange={(e) => setSections(sections.map((x, j) => (j === i ? { ...x, content: e.target.value } : x)))} className="min-h-[140px] text-sm leading-relaxed" />
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
