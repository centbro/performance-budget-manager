import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BarChart3, Download, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { simulate, type Range3, type SimInput, type SimResult } from "@shared/ideaSim";
import type { ProgramIdea } from "@shared/workTools";

export type IdeaContext = { targetGroup: string; region: string; budget: number; goal: string; extra?: string };

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const GRADE_STYLE: Record<SimResult["grade"], string> = {
  안정: "bg-emerald-100 text-emerald-700",
  보통: "bg-sky-100 text-sky-700",
  주의: "bg-amber-100 text-amber-700",
  위험: "bg-rose-100 text-rose-700",
};
const scoreTone = (pct: number) => (pct >= 80 ? "text-emerald-600" : pct >= 65 ? "text-sky-600" : pct >= 50 ? "text-amber-600" : "text-rose-600");

/** 아이디어 카드 아래에 붙는 평가 패널: AI 점수 평가 + 달성 확률 시뮬레이션 */
export default function IdeaEvalPanel({ idea, ctx }: { idea: ProgramIdea; ctx: IdeaContext }) {
  const [tab, setTab] = useState<"ai" | "sim" | null>(null);
  return (
    <div className="px-4 sm:px-6 pb-5 min-w-0">
      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button size="sm" variant={tab === "ai" ? "default" : "outline"} onClick={() => setTab(tab === "ai" ? null : "ai")}><Sparkles className="w-4 h-4 mr-1.5" />AI 점수 평가</Button>
        <Button size="sm" variant={tab === "sim" ? "default" : "outline"} onClick={() => setTab(tab === "sim" ? null : "sim")}><BarChart3 className="w-4 h-4 mr-1.5" />달성 확률 시뮬레이션</Button>
      </div>
      {tab === "ai" && <AiScore idea={idea} ctx={ctx} />}
      {tab === "sim" && <SimPanel ctx={ctx} />}
    </div>
  );
}

// ─── A. AI 점수 평가 ──────────────────────────────────────────────────────────
function AiScore({ idea, ctx }: { idea: ProgramIdea; ctx: IdeaContext }) {
  const m = trpc.tools.evaluateIdea.useMutation({ onError: (e) => { if (!e.message.startsWith("[이용제한]")) toast.error(e.message || "평가에 실패했습니다."); } });
  const run = () => m.mutate({ idea, context: ctx });
  const r = m.data;
  return (
    <div className="mt-4 space-y-4">
      {!r && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={run} disabled={m.isPending}>{m.isPending ? <Spinner className="w-4 h-4 mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}{m.isPending ? "심사 중…" : "점수 평가하기"}</Button>
          <p className="text-xs text-muted-foreground">필요성·실현가능성·성과지표·예산·차별성·지속성 6개 기준으로 채점하고 보완점을 알려 드립니다.</p>
        </div>
      )}
      {r && (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <div className={`text-5xl font-bold tabular-nums ${scoreTone(r.total)}`}>{r.total}<span className="text-lg font-normal text-muted-foreground"> / 100</span></div>
            <p className="flex-1 min-w-[14rem] text-sm">{r.summary}</p>
          </div>
          <div className="space-y-2.5">
            {r.criteria.map((c) => {
              const pct = Math.round((c.score / c.maxScore) * 100);
              return (
                <div key={c.id}>
                  <div className="flex items-center justify-between text-sm"><span className="font-medium">{c.name}</span><span className={`tabular-nums ${scoreTone(pct)}`}>{c.score} / {c.maxScore}</span></div>
                  <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden"><div className={`h-full rounded-full ${pct >= 80 ? "bg-emerald-500" : pct >= 65 ? "bg-sky-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${pct}%` }} /></div>
                  {c.comment && <p className="text-xs text-muted-foreground mt-1">{c.comment}</p>}
                </div>
              );
            })}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-emerald-50 p-4 text-sm"><p className="font-semibold text-emerald-700 mb-1.5">👍 잘된 점</p><ul className="list-disc pl-5 space-y-1">{r.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
            <div className="rounded-xl bg-amber-50 p-4 text-sm"><p className="font-semibold text-amber-700 mb-1.5">🔧 보완할 점</p><ul className="list-disc pl-5 space-y-1">{r.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
          </div>
          {r.revision && <div className="rounded-xl bg-primary/5 p-4 text-sm"><p className="font-semibold mb-1">💡 이렇게 고치면 좋아져요</p><p className="whitespace-pre-wrap">{r.revision}</p></div>}
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">일반 기준에 따른 AI 참고용 평가이며, 특정 공고의 실제 심사 기준과 다를 수 있습니다. 실제 공고는 '공모사업 점수 평가'에서 모집요강으로 채점하세요.</p>
            <Button size="sm" variant="ghost" onClick={run} disabled={m.isPending}>{m.isPending ? <Spinner className="w-4 h-4" /> : "다시 평가"}</Button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── B. 달성 확률 시뮬레이션 (AI 미사용, 1,000회 계산) ───────────────────────
function RangeRow({ label, hint, value, onChange, labels }: { label: string; hint: string; value: Range3; onChange: (v: Range3) => void; labels: [string, string, string] }) {
  const set = (k: keyof Range3) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: Number(e.target.value) });
  return (
    <div className="space-y-1.5 min-w-0">
      <div><span className="text-sm font-medium">{label}</span> <span className="text-xs text-muted-foreground">{hint}</span></div>
      <div className="grid grid-cols-3 gap-1.5 min-w-0">
        {(["min", "mode", "max"] as const).map((k, i) => (
          <div key={k}>
            <p className="text-[11px] text-muted-foreground mb-0.5">{labels[i]}</p>
            <div className="relative"><Input type="number" inputMode="numeric" min={0} max={150} value={value[k]} onChange={set(k)} className="pr-5 pl-2 px-0 tabular-nums" /><span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SimPanel({ ctx }: { ctx: IdeaContext }) {
  const [people, setPeople] = useState(30);
  const [sessions, setSessions] = useState(10);
  const [ext, setExt] = useState<number | null>(null);
  const [enroll, setEnroll] = useState<Range3>({ min: 80, mode: 100, max: 115 });
  const [dropout, setDropout] = useState<Range3>({ min: 5, mode: 15, max: 30 });
  const [att, setAtt] = useState<Range3>({ min: 65, mode: 80, max: 92 });
  const [result, setResult] = useState<{ r: SimResult; inp: SimInput } | null>(null);
  const [projectId, setProjectId] = useState("");
  const year = new Date().getFullYear();
  const { data: projects = [] } = trpc.projects.listParents.useQuery({ year });
  const utils = trpc.useUtils();

  const targetExt = ext ?? Math.round(people * sessions * (att.mode / 100));

  const loadRate = async () => {
    if (!projectId) return toast.error("사업을 선택해 주세요.");
    const d = await utils.attendance.rateDefaults.fetch({ projectId: Number(projectId) });
    if (d.rate === null) return toast.error("이 사업에는 아직 출석 기록이 없습니다.");
    const mode = Math.round(d.rate);
    setAtt({ min: Math.max(0, mode - 12), mode, max: Math.min(100, mode + 8) });
    toast.success(`출석부 실제 출석률 ${d.rate}%(기록 ${d.records}건)를 기본값으로 불러왔습니다.`);
  };

  const run = () => {
    if (!(people > 0) || !(sessions > 0) || !(targetExt > 0)) return toast.error("목표 실인원·횟수·연인원을 1 이상으로 입력해 주세요.");
    const inp: SimInput = { targetPeople: people, sessions, targetExtended: targetExt, budget: ctx.budget, enroll, dropout, attendance: att };
    setResult({ r: simulate(inp, 1000), inp });
  };

  const r = result?.r;
  const maxBin = useMemo(() => Math.max(1, ...(r?.histogram.map((b) => b.count) ?? [1])), [r]);
  const download = () => {
    if (!r || !result) return;
    const i = result.inp;
    const lines = [
      `달성 확률 시뮬레이션 (${r.runs}회) — ${ctx.targetGroup}`,
      `목표: 실인원 ${i.targetPeople}명 · 연인원 ${i.targetExtended}명 · ${i.sessions}회 · 예산 ${won(i.budget)}`,
      `가정: 모집률 ${i.enroll.min}/${i.enroll.mode}/${i.enroll.max}% · 중도이탈 ${i.dropout.min}/${i.dropout.mode}/${i.dropout.max}% · 출석률 ${i.attendance.min}/${i.attendance.mode}/${i.attendance.max}%`,
      `실인원 목표 달성 ${r.probPeople}% · 연인원 목표 달성 ${r.probExtended}% · 둘 다 ${r.probBoth}% (${r.grade})`,
      `연인원 10/50/90분위: ${r.extended.p10} / ${r.extended.p50} / ${r.extended.p90}`,
    ];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }));
    a.download = "달성확률_시뮬레이션.txt";
    a.click();
  };

  return (
    <div className="mt-4 space-y-4">
      <p className="text-xs text-muted-foreground">AI를 쓰지 않고, 아래 가정의 범위 안에서 1,000번 가상으로 운영해 목표를 채울 확률을 계산합니다. 입력한 가정이 결과를 좌우하니 실제 경험에 맞게 조정하세요.</p>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <div className="space-y-1"><Label className="text-xs">목표 실인원(명)</Label><Input type="number" min={1} value={people} onChange={(e) => setPeople(Number(e.target.value))} /></div>
        <div className="space-y-1"><Label className="text-xs">진행 횟수(회)</Label><Input type="number" min={1} value={sessions} onChange={(e) => setSessions(Number(e.target.value))} /></div>
        <div className="space-y-1"><Label className="text-xs">목표 연인원(명)</Label><Input type="number" min={1} value={targetExt} onChange={(e) => setExt(Number(e.target.value))} /></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <RangeRow label="모집률" hint="목표 대비 실제 참석(100% 초과 가능)" value={enroll} onChange={setEnroll} labels={["적을 때", "보통", "많을 때"]} />
        <RangeRow label="중도 이탈률" hint="끝까지 못 남는 비율" value={dropout} onChange={setDropout} labels={["적을 때", "보통", "많을 때"]} />
        <RangeRow label="평균 출석률" hint="남은 사람의 회차별 출석" value={att} onChange={setAtt} labels={["낮을 때", "보통", "높을 때"]} />
      </div>
      <div className="flex flex-wrap items-end gap-2 rounded-xl bg-muted/50 p-3">
        <div className="space-y-1 flex-1 min-w-[12rem]">
          <Label className="text-xs">출석부의 실제 출석률로 기본값 채우기 (선택)</Label>
          <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">사업 선택…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.projectName}</option>)}
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={loadRate}>출석률 불러오기</Button>
      </div>
      <Button onClick={run}><BarChart3 className="w-4 h-4 mr-2" />1,000번 돌려보기</Button>

      {r && result && (
        <div className="space-y-4 rounded-xl border p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${GRADE_STYLE[r.grade]}`}>{r.grade}</span>
            <p className="text-sm flex-1 min-w-[14rem]">실인원과 연인원 목표를 <b>모두</b> 채울 확률 <b className="text-lg">{r.probBoth}%</b></p>
            <Button size="sm" variant="ghost" onClick={download}><Download className="w-4 h-4 mr-1" />저장</Button>
          </div>
          {([["실인원 목표 달성", r.probPeople], ["연인원 목표 달성", r.probExtended]] as const).map(([label, p]) => (
            <div key={label}>
              <div className="flex justify-between text-sm"><span>{label}</span><span className="tabular-nums font-medium">{p}%</span></div>
              <div className="h-2 rounded-full bg-muted mt-1 overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${p}%` }} /></div>
            </div>
          ))}
          <div>
            <p className="text-sm font-medium mb-2">연인원 분포 <span className="text-xs font-normal text-muted-foreground">(목표 {result.inp.targetExtended}명, 파란 막대 = 목표 이상)</span></p>
            <div className="flex items-end gap-1 h-24">
              {r.histogram.map((b, i) => (
                <div key={i} className="flex-1 h-full flex flex-col justify-end" title={`${b.from}~${b.to}명: ${b.count}회`}>
                  <div className={`rounded-t ${b.to >= result.inp.targetExtended ? "bg-primary/70" : "bg-muted-foreground/30"}`} style={{ height: `${(b.count / maxBin) * 100}%` }} />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground mt-1"><span>{r.histogram[0].from}명</span><span>{r.histogram[r.histogram.length - 1].to}명</span></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead><tr className="text-xs text-muted-foreground text-left"><th className="py-1 pr-3 font-normal">결과 범위</th><th className="px-3 font-normal">나쁜 경우(하위10%)</th><th className="px-3 font-normal">보통</th><th className="px-3 font-normal">좋은 경우(상위10%)</th></tr></thead>
              <tbody className="divide-y">
                <tr><td className="py-1.5 pr-3">실인원</td><td className="px-3">{r.people.p10}명</td><td className="px-3 font-medium">{r.people.p50}명</td><td className="px-3">{r.people.p90}명</td></tr>
                <tr><td className="py-1.5 pr-3">연인원</td><td className="px-3">{r.extended.p10}명</td><td className="px-3 font-medium">{r.extended.p50}명</td><td className="px-3">{r.extended.p90}명</td></tr>
                {r.costPerPerson && <tr><td className="py-1.5 pr-3">실인원 1인당 비용</td><td className="px-3">{won(r.costPerPerson.p90)}</td><td className="px-3 font-medium">{won(r.costPerPerson.p50)}</td><td className="px-3">{won(r.costPerPerson.p10)}</td></tr>}
                {r.costPerExtended && <tr><td className="py-1.5 pr-3">연인원 1명당 비용</td><td className="px-3">{won(r.costPerExtended.p90)}</td><td className="px-3 font-medium">{won(r.costPerExtended.p50)}</td><td className="px-3">{won(r.costPerExtended.p10)}</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="rounded-xl bg-muted/50 p-3 text-sm space-y-1.5">
            {r.requiredAttendance !== null && (
              <p>💡 보통 가정에서 연인원 {result.inp.targetExtended}명을 채우려면 평균 출석률이 약 <b>{r.requiredAttendance}%</b> 이상이어야 합니다.{r.requiredAttendance > 100 && " (100%를 넘으므로 목표 연인원이 현재 인원·횟수로는 불가능합니다. 인원이나 횟수를 늘리거나 목표를 낮춰 보세요.)"}</p>
            )}
            {r.sensitivity[0]?.drop > 0 && <p>⚠️ 가장 조심할 요인은 <b>{r.sensitivity[0].factor}</b>입니다. 이것만 나빠져도 연인원 달성 확률이 {r.sensitivity[0].drop}%p 떨어집니다{r.sensitivity.slice(1).filter((s) => s.drop > 0).length ? ` (${r.sensitivity.slice(1).filter((s) => s.drop > 0).map((s) => `${s.factor} ${s.drop}%p`).join(", ")})` : ""}.</p>}
          </div>
          <p className="text-xs text-muted-foreground">입력한 가정에 따른 계산이며 실제 결과를 보장하지 않습니다. 실인원은 '1회 이상 참석한 사람'으로 계산하고, 중도 이탈은 회차에 걸쳐 일정하게 빠져나가는 것으로 봅니다.</p>
        </div>
      )}
    </div>
  );
}
