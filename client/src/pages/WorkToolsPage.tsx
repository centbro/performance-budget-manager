import IdeaEvalPanel from "@/components/IdeaEvalPanel";
import SavedIdeas, { SaveIdeaButton } from "@/components/SavedIdeas";
import PlanNotice from "@/components/PlanNotice";
import OrgStyleCard from "@/components/OrgStyleCard";
import NoteImageTab from "@/components/NoteImageTab";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, Download, Languages, Lightbulb, FileText, Sparkles, LayoutTemplate, Trash2, Upload, Library, AlertTriangle, NotebookPen } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { DOC_TYPES, TARGET_GROUPS, type DocTypeId } from "@shared/workTools";
import { MAX_NOTICE_LANGS, NOTICE_LANGUAGES, type NoticeLangId } from "@shared/languages";
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
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="min-w-0">
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

      <div className="space-y-4 min-w-0">
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
            <div className="px-4 sm:px-6 pb-1"><SaveIdeaButton idea={idea} ctx={{ targetGroup: m.variables!.targetGroup, region: m.variables!.region ?? "", budget: m.variables!.budget, goal: m.variables!.goal, extra: m.variables!.extra }} /></div>
            <IdeaEvalPanel idea={idea} ctx={{ targetGroup: m.variables!.targetGroup, region: m.variables!.region ?? "", budget: m.variables!.budget, goal: m.variables!.goal, extra: m.variables!.extra }} />
          </Card>
        ))}
        {m.data && <SourcesNote sources={m.data.sources} />}
        <SavedIdeas />
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
    if (!file) return toast.error("서식 파일을 선택해 주세요.");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("name", regName.trim());
      fd.append("file", file);
      const res = await fetch("/api/upload/template", { method: "POST", body: fd, credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || (res.status === 413 ? "파일이 너무 큽니다(10MB 이하)." : `등록에 실패했습니다. (오류 ${res.status})`));
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

  const FACTS_MAX = 15000;
  const factsFileRef = useRef<HTMLInputElement>(null);
  const [readingFiles, setReadingFiles] = useState(false);
  const loadFactsFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setReadingFiles(true);
    let cur = facts;
    let added = 0;
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", f);
        const res = await fetch("/api/upload/source-text", { method: "POST", body: fd, credentials: "include" });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) { toast.error(`${f.name}: ${j.error || (res.status === 413 ? "파일이 너무 큽니다(10MB 이하)." : `읽지 못했습니다. (오류 ${res.status})`)}`); continue; }
        const head = `[${f.name}]\n`;
        const room = FACTS_MAX - cur.length - (cur ? 2 : 0) - head.length;
        if (room <= 50) { toast.error(`${f.name}: 입력 칸이 가득 찼습니다. 기존 내용을 줄이고 다시 불러오세요.`); break; }
        const body = String(j.text ?? "");
        cur = (cur ? cur + "\n\n" : "") + head + body.slice(0, room);
        added++;
        if (body.length > room) toast.message(`${f.name}: 앞부분 ${room.toLocaleString()}자만 불러왔습니다.`);
      }
      if (added > 0) { setFacts(cur); toast.success(`${added}개 파일의 내용을 불러왔습니다. 확인하고 필요하면 고쳐 주세요.`); }
    } catch {
      toast.error("파일을 읽지 못했습니다.");
    } finally {
      setReadingFiles(false);
      if (factsFileRef.current) factsFileRef.current.value = "";
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
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Upload className="w-4 h-4" />1. 우리 기관 양식 등록</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="양식 이름 (예: 우리센터 기안서)" />
            <Input type="file" accept=".pdf,.hwpx,.docx,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <p className="text-xs text-muted-foreground">PDF·한글(.hwpx)·워드(.docx)·엑셀(.xlsx) 파일을 올릴 수 있습니다(스캔본·구형 .hwp 불가, 10MB 이하). 구형 .hwp는 한글에서 "다른 이름으로 저장 → .hwpx 또는 PDF"로 바꿔 주세요. 샘플의 내용은 버리고 항목 구조만 사용하며, 전화번호·이메일 등은 자동으로 가립니다. 이름·주소 등은 가려지지 않으니 가능하면 빈 서식이나 개인정보를 지운 샘플을 올려 주세요.</p>
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
            <div className="space-y-2">
              <Label>알고 있는 내용 *</Label>
              <Textarea value={facts} onChange={(e) => setFacts(e.target.value)} maxLength={FACTS_MAX} placeholder="일시, 장소, 대상, 인원, 예산, 진행 내용, 결과 수치 등을 자유롭게 적어 주세요. 관련 문서가 있으면 아래 '파일에서 불러오기'로 넣을 수 있습니다." className="min-h-[140px]" />
              <div className="flex flex-wrap items-center gap-2">
                <input ref={factsFileRef} type="file" multiple className="hidden" accept=".pdf,.hwpx,.docx,.xlsx,.txt,.md,.csv" onChange={(e) => loadFactsFiles(e.target.files)} />
                <Button type="button" variant="outline" size="sm" disabled={readingFiles} onClick={() => factsFileRef.current?.click()}>
                  {readingFiles ? <Spinner className="w-4 h-4 mr-1.5" /> : <Upload className="w-4 h-4 mr-1.5" />}
                  {readingFiles ? "읽는 중…" : "파일에서 불러오기"}
                </Button>
                <span className="text-xs text-muted-foreground">{facts.length.toLocaleString()} / {FACTS_MAX.toLocaleString()}자</span>
              </div>
              <p className="text-xs text-muted-foreground">PDF·한글(.hwpx)·워드(.docx)·엑셀(.xlsx)·텍스트 파일의 글자를 위 칸에 붙여 줍니다(파일은 저장하지 않고, 전화번호·이메일은 자동으로 가립니다). 이름 등 개인정보가 든 파일은 올리기 전에 지워 주세요. 불러온 뒤 내용을 확인·수정하세요.</p>
            </div>
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
    if (!file) return toast.error("서식 파일을 선택해 주세요.");
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
            <Input type="file" accept=".pdf,.hwpx,.docx,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
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

/** 외국인 참여자용 다국어 안내문 */
function TranslateTab() {
  const [text, setText] = useState("");
  const [org, setOrg] = useState("");
  const [langs, setLangs] = useState<NoticeLangId[]>(["en", "vi"]);
  const [easy, setEasy] = useState(true);
  const [result, setResult] = useState<{ easyKorean: string; translations: { lang: string; label: string; text: string }[] } | null>(null);
  const m = trpc.tools.translateNotice.useMutation({
    onSuccess: (d) => setResult(d),
    onError: (e) => toast.error(e.message || "번역에 실패했습니다."),
  });
  const toggle = (id: NoticeLangId) =>
    setLangs((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_NOTICE_LANGS ? (toast.error(`한 번에 ${MAX_NOTICE_LANGS}개 언어까지 선택할 수 있습니다.`), cur) : [...cur, id]);
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); toast.success("복사했습니다."); } catch { toast.error("복사에 실패했습니다."); } };
  const submit = () => {
    if (text.trim().length < 5) return toast.error("한국어 안내문을 입력해 주세요.");
    if (langs.length === 0) return toast.error("번역할 언어를 선택해 주세요.");
    m.mutate({ text: text.trim(), langs, easyKorean: easy, org: org.trim() });
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Languages className="w-4 h-4" />한국어 안내문</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[180px] text-sm" maxLength={3000}
            placeholder={"예)\n[한국어교실 개강 안내]\n- 일시: 11월 6일(목) 19:00\n- 장소: 센터 2층 교육실\n- 준비물: 외국인등록증\n- 문의: 031-000-0000"} />
          <div className="space-y-1.5">
            <Label className="text-xs">번역할 언어 ({langs.length}/{MAX_NOTICE_LANGS})</Label>
            <div className="flex flex-wrap gap-1.5">
              {NOTICE_LANGUAGES.map((l) => (
                <button key={l.id} type="button" onClick={() => toggle(l.id)}
                  className={`px-2.5 py-1 rounded-full border text-xs transition-colors ${langs.includes(l.id) ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}>{l.label}</button>
              ))}
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm"><Checkbox checked={easy} onCheckedChange={(v) => setEasy(v === true)} className="mt-0.5" /><span>쉬운 한국어 버전도 만들기<span className="block text-xs text-muted-foreground">한국어를 조금 아는 분께 보낼 짧고 쉬운 문장</span></span></label>
          <Input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="기관명 (선택)" maxLength={100} />
          <Button className="w-full" onClick={submit} disabled={m.isPending}>{m.isPending ? <Spinner className="w-4 h-4 mr-2" /> : <Languages className="w-4 h-4 mr-2" />}{m.isPending ? "번역 중…" : "번역하기"}</Button>
        </CardContent>
      </Card>
      <div className="space-y-3 min-w-0">
        {!result && !m.isPending && <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">안내문을 넣고 언어를 고르면 카톡에 바로 붙여 넣을 수 있게 번역합니다.</CardContent></Card>}
        {m.isPending && <Card><CardContent className="py-12 text-center text-sm text-muted-foreground"><Spinner className="w-5 h-5 mx-auto mb-2" />번역하고 있습니다…</CardContent></Card>}
        {result && !m.isPending && (
          <>
            <p className="text-xs rounded-md border border-amber-300/60 bg-amber-50 text-amber-800 px-3 py-2">AI 번역입니다. 일시·장소·금액 같은 핵심 정보는 원문과 같은지 확인하고, 중요한 공지는 해당 언어를 아는 분께 한 번 검수받으세요. 크메르어·미얀마어·싱할라어 등은 특히 확인이 필요합니다.</p>
            {result.easyKorean && (
              <Card>
                <CardHeader className="pb-2 flex-row items-center justify-between space-y-0"><CardTitle className="text-sm">쉬운 한국어</CardTitle><Button variant="outline" size="sm" onClick={() => copy(result.easyKorean)}><Copy className="w-4 h-4 mr-1" />복사</Button></CardHeader>
                <CardContent><p className="text-sm whitespace-pre-wrap leading-relaxed">{result.easyKorean}</p></CardContent>
              </Card>
            )}
            {result.translations.map((t) => (
              <Card key={t.lang}>
                <CardHeader className="pb-2 flex-row items-center justify-between space-y-0"><CardTitle className="text-sm"><Badge>{t.label}</Badge></CardTitle><Button variant="outline" size="sm" onClick={() => copy(t.text)}><Copy className="w-4 h-4 mr-1" />복사</Button></CardHeader>
                <CardContent><p className="text-sm whitespace-pre-wrap leading-relaxed break-words">{t.text}</p></CardContent>
              </Card>
            ))}
            {result.translations.length < langs.length && <p className="text-xs text-muted-foreground">일부 언어는 번역되지 않았습니다. 해당 언어만 다시 선택해 번역해 보세요.</p>}
          </>
        )}
      </div>
    </div>
  );
}

export default function WorkToolsPage({ mode = "tools" }: { mode?: "tools" | "references" }) {
  if (mode === "references") {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6 max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold">참고자료 보관함</h1>
          <p className="text-sm text-muted-foreground mt-1 mb-5">사업 지침·공고문·참고 PDF를 올려 두면 사업계획서와 행정 문서를 쓸 때 근거로 반영하고, 어느 자료 몇 쪽인지 함께 알려 줍니다.</p>
          <ReferencesTab />
        </div>
      </DashboardLayout>
    );
  }
  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold">행정 문서·양식</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-5">기안서·보고서·공문 초안을 만들고, 우리 기관 양식(PDF)에 맞춰 작성합니다. AI 초안은 반드시 사실 확인 후 사용하세요.</p>
        <OrgStyleCard />
        <Tabs defaultValue="mine">
          <TabsList>
            <TabsTrigger value="mine"><LayoutTemplate className="w-4 h-4 mr-1" />우리 기관 양식으로 작성</TabsTrigger>
            <TabsTrigger value="docs"><FileText className="w-4 h-4 mr-1" />기본 서식 초안</TabsTrigger>
            <TabsTrigger value="ideas"><Lightbulb className="w-4 h-4 mr-1" />프로그램 아이디어</TabsTrigger>
            <TabsTrigger value="note"><NotebookPen className="w-4 h-4 mr-1" />노트 이미지</TabsTrigger>
            <TabsTrigger value="translate"><Languages className="w-4 h-4 mr-1" />다국어 안내문</TabsTrigger>
          </TabsList>
          <TabsContent value="mine" className="mt-5"><TemplatesTab /></TabsContent>
          <TabsContent value="docs" className="mt-5"><DocsTab /></TabsContent>
          <TabsContent value="ideas" className="mt-5"><PlanNotice feature="ideas" /><IdeasTab /></TabsContent>
          <TabsContent value="note" className="mt-5"><PlanNotice feature="note_image" /><NoteImageTab /></TabsContent>
          <TabsContent value="translate" className="mt-5"><TranslateTab /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
