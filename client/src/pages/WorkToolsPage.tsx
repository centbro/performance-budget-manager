import { useState } from "react";
import { toast } from "sonner";
import { Copy, Download, Lightbulb, FileText, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { DOC_TYPES, TARGET_GROUPS, type DocTypeId } from "@shared/workTools";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const toNumber = (s: string) => Number(s.replace(/[,\s원]/g, ""));

function IdeasTab() {
  const [target, setTarget] = useState<string>(TARGET_GROUPS[0]);
  const [region, setRegion] = useState("");
  const [budget, setBudget] = useState("");
  const [goal, setGoal] = useState("");
  const [extra, setExtra] = useState("");
  const m = trpc.tools.programIdeas.useMutation({
    onError: (e) => toast.error(e.message || "생성에 실패했습니다."),
  });

  const submit = () => {
    const b = toNumber(budget);
    if (!goal.trim()) return toast.error("달성하고 싶은 목표를 입력해 주세요.");
    if (!(b > 0)) return toast.error("예산을 숫자(원)로 입력해 주세요.");
    m.mutate({ targetGroup: target, region: region.trim(), budget: b, goal: goal.trim(), count: 3, extra: extra.trim() || undefined });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label>대상</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TARGET_GROUPS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>지역</Label><Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="예: 경기도 화성시" /></div>
          <div className="space-y-2"><Label>총예산(원) *</Label><Input inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="5000000" /></div>
          <div className="space-y-2"><Label>달성하고 싶은 목표 *</Label><Textarea value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="예: 외로움 감소, 지역 사회관계 형성" className="min-h-[72px]" /></div>
          <div className="space-y-2"><Label>추가 정보 (선택)</Label><Textarea value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="기관 특성, 제약 조건 등" className="min-h-[56px]" /></div>
          <Button className="w-full" onClick={submit} disabled={m.isPending}>
            {m.isPending ? <Spinner className="w-4 h-4 mr-2" /> : <Lightbulb className="w-4 h-4 mr-2" />}
            {m.isPending ? "생성 중…" : "아이디어 3개 제안받기"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {!m.data && !m.isPending && <p className="text-sm text-muted-foreground pt-2">왼쪽에 조건을 입력하면 서로 다른 접근의 프로그램 3개를 비교해서 보여 드립니다.</p>}
        {m.data?.ideas.map((idea, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2"><Badge>안 {i + 1}</Badge><CardTitle className="text-base">{idea.name}</CardTitle></div>
              <p className="text-sm text-muted-foreground">{idea.summary}</p>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><span className="font-semibold">주요 활동</span><ul className="list-disc pl-5 mt-1 space-y-0.5">{idea.activities.map((a, j) => <li key={j}>{a}</li>)}</ul></div>
              <p><span className="font-semibold">기대 변화 · </span>{idea.outcome}</p>
              <p><span className="font-semibold">성과지표 · </span>{idea.indicator}</p>
              <p><span className="font-semibold">어림 예산 · </span>{idea.budgetEstimate}</p>
            </CardContent>
          </Card>
        ))}
        {m.data && m.data.references.length > 0 && (
          <div className="text-xs text-muted-foreground border-t pt-3">
            <p className="font-medium mb-1">구조 참고에 사용한 사례집 (내용을 옮기지 않고 설계 방식만 참고)</p>
            <ul className="list-disc pl-5 space-y-0.5">{m.data.references.map((r) => <li key={r.id}>{r.year}년 사례집 약 {r.page}쪽 · {r.head}</li>)}</ul>
          </div>
        )}
      </div>
    </div>
  );
}

function DocsTab() {
  const [type, setType] = useState<DocTypeId>("draft");
  const [title, setTitle] = useState("");
  const [org, setOrg] = useState("");
  const [facts, setFacts] = useState("");
  const [budget, setBudget] = useState("");
  const [extra, setExtra] = useState("");
  const [text, setText] = useState("");
  const m = trpc.tools.draftDocument.useMutation({
    onSuccess: (d) => setText(d.text),
    onError: (e) => toast.error(e.message || "생성에 실패했습니다."),
  });
  const hint = DOC_TYPES.find((d) => d.id === type)?.hint;

  const submit = () => {
    if (!title.trim()) return toast.error("제목(주제)을 입력해 주세요.");
    if (!facts.trim()) return toast.error("알고 있는 내용을 입력해 주세요.");
    m.mutate({ type, title: title.trim(), org: org.trim(), facts: facts.trim(), budget: budget.trim() || undefined, extra: extra.trim() || undefined });
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast.success("복사했습니다."); } catch { toast.error("복사에 실패했습니다."); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${title.trim() || "문서"}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label>문서 종류</Label>
            <Select value={type} onValueChange={(v) => setType(v as DocTypeId)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DOC_TYPES.map((d) => <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className="space-y-2"><Label>제목/주제 *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 외국인 근로자 명랑운동회 추진" /></div>
          <div className="space-y-2"><Label>기관명</Label><Input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="예: 화성시외국인복지센터" /></div>
          <div className="space-y-2"><Label>알고 있는 내용 *</Label><Textarea value={facts} onChange={(e) => setFacts(e.target.value)} placeholder="일시, 장소, 대상, 인원, 진행 내용, 결과 수치 등을 자유롭게 적어 주세요." className="min-h-[140px]" /></div>
          <div className="space-y-2"><Label>예산 (선택)</Label><Textarea value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="예: 총 700만원 / 다과비 100만원, 상품 200만원 …" className="min-h-[56px]" /></div>
          <div className="space-y-2"><Label>추가 요청 (선택)</Label><Input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="예: 1장 분량으로" /></div>
          <Button className="w-full" onClick={submit} disabled={m.isPending}>
            {m.isPending ? <Spinner className="w-4 h-4 mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {m.isPending ? "작성 중…" : "초안 작성"}
          </Button>
        </CardContent>
      </Card>

      <div>
        {!text && !m.isPending && <p className="text-sm text-muted-foreground pt-2">입력하지 않은 수치나 근거는 [확인 필요]로 표시됩니다. 결재 전에 꼭 채워 주세요.</p>}
        {text && (
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">초안 (직접 수정할 수 있습니다)</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copy}><Copy className="w-4 h-4 mr-1" />복사</Button>
                <Button variant="outline" size="sm" onClick={download}><Download className="w-4 h-4 mr-1" />저장</Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[520px] text-sm leading-relaxed font-mono" />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function WorkToolsPage() {
  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold">업무 도우미</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-5">프로그램 아이디어를 비교해 보고, 기안서·보고서·공문 초안을 빠르게 만듭니다. AI 초안은 반드시 사실 확인 후 사용하세요.</p>
        <Tabs defaultValue="ideas">
          <TabsList>
            <TabsTrigger value="ideas"><Lightbulb className="w-4 h-4 mr-1" />프로그램 아이디어</TabsTrigger>
            <TabsTrigger value="docs"><FileText className="w-4 h-4 mr-1" />행정 서식 초안</TabsTrigger>
          </TabsList>
          <TabsContent value="ideas" className="mt-5"><IdeasTab /></TabsContent>
          <TabsContent value="docs" className="mt-5"><DocsTab /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
