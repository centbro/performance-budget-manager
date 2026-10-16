import { useState } from "react";
import { toast } from "sonner";
import { Copy, Download, Lightbulb, FileText, Sparkles, LayoutTemplate, Trash2, Upload, Library, AlertTriangle } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


type Warning = { rule: string; found: string; suggestion: string };
type Source = { docName: string; page: number };

/** 참고자료 반영 여부(자료가 있을 때만 기본 켜짐) */
function useReferencesToggle() {
  const refs = trpc.tools.references.useQuery();
  const count = refs.data?.length ?? 0;
  const [use, setUse] = useState(true);
  const node = (
    <label className={`flex items-start gap-2 text-sm ${count === 0 ? "opacity-60" : ""}`}>
      <Checkbox checked={count > 0 && use} disabled={count === 0} onCheckedChange={(v) => setUse(v === true)} className="mt-0.5" />
      <span>
        내 참고자료 반영
        <span className="block text-xs text-muted-foreground">
          {count === 0 ? "‘참고자료 보관함’ 탭에 지침·자료 PDF를 올리면 쓸 수 있습니다." : `올려 둔 자료 ${count}개에서 관련 부분을 찾아 근거로 씁니다.`}
        </span>
      </span>
    </label>
  );
  return { useRefs: count > 0 && use, node };
}

function SourcesNote({ sources }: { sources?: Source[] }) {
  if (!sources || sources.length === 0) return null;
  return (
    <div className="text-xs text-muted-foreground border-t pt-3 mt-3">
      <p className="font-medium mb-1">반영한 참고자료</p>
      <ul className="list-disc pl-5 space-y-0.5">{sources.map((s, i) => <li key={i}>「{s.docName}」 p.{s.page}</li>)}</ul>
    </div>
  );
}

function StyleWarnings({ warnings }: { warnings?: Warning[] }) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs space-y-1 mb-3">
      <p className="font-medium flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />공문서 표기 점검 {warnings.length}건 (공문서 작성법 기준)</p>
      <ul className="list-disc pl-5 space-y-0.5">
        {warnings.map((w, i) => <li key={i}><b>{w.rule}</b> · “{w.found}” — {w.suggestion}</li>)}
      </ul>
    </div>
  );
}

const toNumber = (s: string) => Number(s.replace(/[,\s원]/g, ""));

function IdeasTab() {
  const { useRefs, node: refToggle } = useReferencesToggle();
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
    m.mutate({ targetGroup: target, region: region.trim(), budget: b, goal: goal.trim(), count: 3, extra: extra.trim() || undefined, useReferences: useRefs });
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
          {refToggle}
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
        {m.data && <SourcesNote sources={m.data.sources} />}
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
  const { useRefs, node: refToggle } = useReferencesToggle();
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [type, setType] = useState<DocTypeId>("draft");
  const [title, setTitle] = useState("");
  const [org, setOrg] = useState("");
  const [facts, setFacts] = useState("");
  const [budget, setBudget] = useState("");
  const [extra, setExtra] = useState("");
  const [text, setText] = useState("");
  const m = trpc.tools.draftDocument.useMutation({
    onSuccess: (d) => { setText(d.text); setWarnings(d.warnings); setSources(d.sources); },
    onError: (e) => toast.error(e.message || "생성에 실패했습니다."),
  });
  const hint = DOC_TYPES.find((d) => d.id === type)?.hint;

  const submit = () => {
    if (!title.trim()) return toast.error("제목(주제)을 입력해 주세요.");
    if (!facts.trim()) return toast.error("알고 있는 내용을 입력해 주세요.");
    m.mutate({ type, title: title.trim(), org: org.trim(), facts: facts.trim(), budget: budget.trim() || undefined, extra: extra.trim() || undefined, useReferences: useRefs });
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
          {refToggle}
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
              <StyleWarnings warnings={warnings} />
              <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[520px] text-sm leading-relaxed font-mono" />
              <SourcesNote sources={sources} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

async function copyText(t: string) {
  try {
    await navigator.clipboard.writeText(t);
    toast.success("복사했습니다.");
  } catch {
    toast.error("복사에 실패했습니다.");
  }
}

function TemplatesTab() {
  const { useRefs, node: refToggle } = useReferencesToggle();
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const utils = trpc.useUtils();
  const list = trpc.tools.templates.useQuery();
  const [selected, setSelected] = useState<string>("");
  const [regName, setRegName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [facts, setFacts] = useState("");
  const [extra, setExtra] = useState("");
  const [sections, setSections] = useState<{ heading: string; content: string }[]>([]);

  const detail = trpc.tools.templateDetail.useQuery({ id: Number(selected) }, { enabled: !!selected });
  const fill = trpc.tools.fillTemplate.useMutation({
    onSuccess: (d) => { setSections(d.sections); setWarnings(d.warnings); setSources(d.sources); },
    onError: (e) => toast.error(e.message || "작성에 실패했습니다."),
  });
  const del = trpc.tools.deleteTemplate.useMutation({
    onSuccess: () => {
      setSelected("");
      setSections([]);
      utils.tools.templates.invalidate();
      toast.success("양식을 삭제했습니다.");
    },
  });

  const upload = async () => {
    if (!regName.trim()) return toast.error("양식 이름을 입력해 주세요.");
    if (!file) return toast.error("PDF 파일을 선택해 주세요.");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("name", regName.trim());
      fd.append("file", file);
      const res = await fetch("/api/upload/template", { method: "POST", body: fd, credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "등록에 실패했습니다.");
      toast.success("양식을 등록했습니다.");
      setRegName("");
      setFile(null);
      await utils.tools.templates.invalidate();
      setSelected(String(body.id));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const submit = () => {
    if (!selected) return toast.error("양식을 선택해 주세요.");
    if (!title.trim()) return toast.error("제목(주제)을 입력해 주세요.");
    if (!facts.trim()) return toast.error("알고 있는 내용을 입력해 주세요.");
    fill.mutate({ templateId: Number(selected), title: title.trim(), facts: facts.trim(), extra: extra.trim() || undefined, useReferences: useRefs });
  };
  const all = sections.map((s) => `${s.heading}\n${s.content}`).join("\n\n");

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Upload className="w-4 h-4" />1. 우리 기관 양식 등록 (PDF)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="양식 이름 (예: 우리센터 기안서)" />
            <Input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <p className="text-xs text-muted-foreground">한글·워드에서 PDF로 저장한 샘플을 올려 주세요(스캔본 불가, 10MB 이하). 샘플의 내용은 버리고 항목 구조만 사용하며, 전화번호·이메일 등은 자동으로 가립니다. 이름·주소 등은 가려지지 않으니 가능하면 빈 서식이나 개인정보를 지운 샘플을 올려 주세요.</p>
            <Button className="w-full" variant="outline" onClick={upload} disabled={uploading}>
              {uploading ? <Spinner className="w-4 h-4 mr-2" /> : <LayoutTemplate className="w-4 h-4 mr-2" />}
              {uploading ? "분석 중… (최대 1분)" : "양식 등록"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">2. 양식 선택 후 내용 입력</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Select value={selected} onValueChange={(v) => { setSelected(v); setSections([]); }}>
                <SelectTrigger><SelectValue placeholder={list.data?.length ? "양식 선택" : "등록된 양식이 없습니다"} /></SelectTrigger>
                <SelectContent>{(list.data ?? []).map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
              {selected && (
                <Button variant="ghost" size="icon" title="양식 삭제" onClick={() => window.confirm("이 양식을 삭제할까요?") && del.mutate({ id: Number(selected) })}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
            {detail.data && (
              <p className="text-xs text-muted-foreground">항목 {detail.data.analysis.sections.length}개 · {detail.data.analysis.docKind || "문서"} · {detail.data.analysis.tone || "문체 미지정"}</p>
            )}
            <div className="space-y-2"><Label>제목/주제 *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 외국인 근로자 명랑운동회 추진" /></div>
            <div className="space-y-2"><Label>알고 있는 내용 *</Label><Textarea value={facts} onChange={(e) => setFacts(e.target.value)} placeholder="일시, 장소, 대상, 인원, 예산, 진행 내용, 결과 수치 등을 자유롭게 적어 주세요." className="min-h-[140px]" /></div>
            <div className="space-y-2"><Label>추가 요청 (선택)</Label><Input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="예: 간결하게" /></div>
            {refToggle}
            <Button className="w-full" onClick={submit} disabled={fill.isPending || !selected}>
              {fill.isPending ? <Spinner className="w-4 h-4 mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {fill.isPending ? "작성 중…" : "양식에 맞춰 작성"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div>
        {sections.length === 0 && !fill.isPending && (
          <p className="text-sm text-muted-foreground pt-2">양식을 등록하고 내용을 입력하면 양식의 항목 순서대로 칸마다 나누어 보여 드립니다. 각 칸의 <b>복사</b> 버튼으로 한글·워드의 해당 칸에 붙여 넣으세요. 입력하지 않은 사실은 [확인 필요]로 표시됩니다.</p>
        )}
        {sections.length > 0 && (
          <div className="space-y-3">
            <StyleWarnings warnings={warnings} />
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => copyText(all)}><Copy className="w-4 h-4 mr-1" />전체 복사</Button>
            </div>
            {sections.map((sec, i) => (
              <Card key={i}>
                <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm">{sec.heading}</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => copyText(sec.content)}><Copy className="w-4 h-4 mr-1" />복사</Button>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={sec.content}
                    onChange={(e) => setSections((prev) => prev.map((p, j) => (j === i ? { ...p, content: e.target.value } : p)))}
                    className="min-h-[96px] text-sm leading-relaxed"
                  />
                </CardContent>
              </Card>
            ))}
            <SourcesNote sources={sources} />
          </div>
        )}
      </div>
    </div>
  );
}

function ReferencesTab() {
  const utils = trpc.useUtils();
  const list = trpc.tools.references.useQuery();
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const found = trpc.tools.searchReferences.useQuery({ query }, { enabled: query.length > 0 });
  const del = trpc.tools.deleteReference.useMutation({
    onSuccess: () => { utils.tools.references.invalidate(); toast.success("삭제했습니다."); },
  });

  const upload = async () => {
    if (!name.trim()) return toast.error("자료 이름을 입력해 주세요. (예: 2026 사회복지시설 관리안내)");
    if (!file) return toast.error("PDF 파일을 선택해 주세요.");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("file", file);
      const res = await fetch("/api/upload/reference", { method: "POST", body: fd, credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "등록에 실패했습니다.");
      toast.success(`등록했습니다. (${body.pages}쪽)`);
      setName(""); setFile(null);
      utils.tools.references.invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Upload className="w-4 h-4" />지침·참고자료 올리기 (PDF)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="자료 이름 (예: 2026 사업안내 지침)" />
            <Input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <p className="text-xs text-muted-foreground">글자가 선택되는 PDF만 가능합니다(스캔본 불가, 15MB·400쪽 이하, 최대 30개). 올린 자료는 내 계정에서만 보이며, 각종 생성 화면의 ‘내 참고자료 반영’을 켜면 관련 부분만 찾아 근거로 씁니다. 전화번호·이메일·주민번호는 자동으로 가립니다.</p>
            <Button className="w-full" variant="outline" onClick={upload} disabled={uploading}>
              {uploading ? <Spinner className="w-4 h-4 mr-2" /> : <Library className="w-4 h-4 mr-2" />}
              {uploading ? "읽는 중… (최대 1분)" : "자료 등록"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">내 자료 {list.data ? `(${list.data.length})` : ""}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {list.data?.length === 0 && <p className="text-xs text-muted-foreground">아직 올린 자료가 없습니다.</p>}
            {list.data?.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{d.name} <span className="text-xs text-muted-foreground">· {d.pageCount}쪽</span></span>
                <Button variant="ghost" size="icon" title="삭제" onClick={() => window.confirm(`「${d.name}」을(를) 삭제할까요?`) && del.mutate({ id: d.id })}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); }}>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="올린 자료 안에서 찾기 (예: 종사자 교육 시간, 보조금 정산)" />
          <Button type="submit">찾기</Button>
        </form>
        <p className="text-xs text-muted-foreground">AI가 요약하지 않고 올린 자료의 원문 발췌와 쪽수만 보여 줍니다. 중요한 지침은 반드시 원문에서 다시 확인하세요.</p>
        {found.isFetching && <div className="flex justify-center py-6"><Spinner /></div>}
        {query && !found.isFetching && found.data?.length === 0 && <p className="text-sm text-muted-foreground">올린 자료에서 관련 내용을 찾지 못했습니다.</p>}
        {found.data?.map((r, i) => (
          <Card key={i}>
            <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground">「{r.docName}」 p.{r.page}</CardTitle></CardHeader>
            <CardContent><p className="text-sm whitespace-pre-wrap leading-relaxed">{r.text}</p></CardContent>
          </Card>
        ))}
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
            <TabsTrigger value="mine"><LayoutTemplate className="w-4 h-4 mr-1" />우리 기관 양식으로 작성</TabsTrigger>
            <TabsTrigger value="refs"><Library className="w-4 h-4 mr-1" />참고자료 보관함</TabsTrigger>
          </TabsList>
          <TabsContent value="ideas" className="mt-5"><IdeasTab /></TabsContent>
          <TabsContent value="docs" className="mt-5"><DocsTab /></TabsContent>
          <TabsContent value="mine" className="mt-5"><TemplatesTab /></TabsContent>
          <TabsContent value="refs" className="mt-5"><ReferencesTab /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
