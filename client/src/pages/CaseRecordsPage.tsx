import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ClipboardPen, Copy, Download, Save, Sparkles, Trash2, Upload, LayoutTemplate, ListChecks, BarChart3 } from "lucide-react";
import { trpc } from "@/lib/trpc";
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

type Field = { heading: string; content: string };
const today = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const copyText = (t: string) => navigator.clipboard.writeText(t).then(() => toast.success("복사했습니다."));

function csvEscape(v: string) {
  return `"${v.replace(/"/g, '""').replace(/\r?\n/g, "\n")}"`;
}

/* ───────── 기록 작성 ───────── */
function WriteTab({ onSaved }: { onSaved: () => void }) {
  const utils = trpc.useUtils();
  const templates = trpc.tools.templates.useQuery();
  const [selected, setSelected] = useState("");
  const [regName, setRegName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [text, setText] = useState("");
  const [meta, setMeta] = useState({ recordDate: today(), subject: "", category: "", summary: "" });
  const [fields, setFields] = useState<Field[]>([]);

  const extract = trpc.caseRecords.extract.useMutation({
    onSuccess: (d) => { setMeta(d.meta); setFields(d.sections); },
    onError: (e) => toast.error(e.message || "정리에 실패했습니다."),
  });
  const save = trpc.caseRecords.save.useMutation({
    onSuccess: () => {
      toast.success("기록을 저장했습니다.");
      setText(""); setFields([]); setMeta({ recordDate: today(), subject: "", category: "", summary: "" });
      utils.caseRecords.invalidate();
      onSaved();
    },
    onError: (e) => toast.error(e.message || "저장에 실패했습니다."),
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
      setRegName(""); setFile(null);
      await utils.tools.templates.invalidate();
      setSelected(String(body.id));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const run = () => {
    if (!selected) return toast.error("기록 양식을 선택해 주세요.");
    if (!text.trim()) return toast.error("내용을 입력해 주세요.");
    extract.mutate({ templateId: Number(selected), text: text.trim() });
  };
  const doSave = () => {
    if (!meta.category.trim()) return toast.error("서비스·상담 유형을 입력해 주세요.");
    save.mutate({ templateId: Number(selected), ...meta, category: meta.category.trim(), fields });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Upload className="w-4 h-4" />1. 기관 기록 양식 등록 (PDF)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="양식 이름 (예: 상담일지)" />
            <Input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <p className="text-xs text-muted-foreground">빈 기록지(개인정보 없는 서식)를 PDF로 올려 주세요. 한 번 등록하면 계속 쓸 수 있고, 업무 도우미의 '우리 기관 양식'과 같은 보관함을 씁니다.</p>
            <Button className="w-full" variant="outline" onClick={upload} disabled={uploading}>
              {uploading ? <Spinner className="w-4 h-4 mr-2" /> : <LayoutTemplate className="w-4 h-4 mr-2" />}
              {uploading ? "분석 중… (최대 1분)" : "양식 등록"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ClipboardPen className="w-4 h-4" />2. 양식 선택 후 편하게 적기</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Select value={selected} onValueChange={(v) => { setSelected(v); setFields([]); }}>
              <SelectTrigger><SelectValue placeholder={templates.data?.length ? "기록 양식 선택" : "등록된 양식이 없습니다"} /></SelectTrigger>
              <SelectContent>{(templates.data ?? []).map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[220px] text-sm leading-relaxed"
              placeholder={"상담한 내용을 말하듯이 쭉 적어 주세요.\n예) 오늘 오후 2시에 A씨 센터 방문. 임금체불 문의, 3개월치 약 600만원. 노동청 진정 절차 안내하고 통역 지원 연결함. 다음주 수요일 재방문 예정."}
            />
            <p className="text-xs text-muted-foreground">⚠ 이름은 이니셜·가명(예: 김○○, A씨)으로 적으면 안전합니다. 전화번호·주민번호·이메일은 AI에 보내기 전에 자동으로 가려집니다.</p>
            <Button className="w-full" onClick={run} disabled={extract.isPending || !selected}>
              {extract.isPending ? <Spinner className="w-4 h-4 mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {extract.isPending ? "항목별로 정리 중…" : "양식 항목에 맞게 정리"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div>
        {fields.length === 0 && !extract.isPending && (
          <p className="text-sm text-muted-foreground pt-2">양식을 선택하고 내용을 적으면 양식의 항목마다 자동으로 나누어 담아 보여 드립니다. 확인·수정 후 <b>저장</b>하면 기록이 쌓이고 '실적' 탭에서 건수·유형별로 볼 수 있습니다. 말하지 않은 내용은 [확인 필요]로 비워 둡니다.</p>
        )}
        {fields.length > 0 && (
          <div className="space-y-3">
            <Card>
              <CardContent className="pt-4 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label>기록일 *</Label><Input type="date" value={meta.recordDate} onChange={(e) => setMeta({ ...meta, recordDate: e.target.value })} /></div>
                <div className="space-y-1"><Label>대상자 (이니셜 권장)</Label><Input value={meta.subject} onChange={(e) => setMeta({ ...meta, subject: e.target.value })} /></div>
                <div className="space-y-1"><Label>서비스·상담 유형 *</Label><Input value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.target.value })} placeholder="예: 법률상담" /></div>
                <div className="space-y-1"><Label>한 줄 요약</Label><Input value={meta.summary} onChange={(e) => setMeta({ ...meta, summary: e.target.value })} /></div>
              </CardContent>
            </Card>
            {fields.map((f, i) => (
              <Card key={i}>
                <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm">{f.heading}</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => copyText(f.content)}><Copy className="w-4 h-4 mr-1" />복사</Button>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={f.content}
                    onChange={(e) => setFields((p) => p.map((x, j) => (j === i ? { ...x, content: e.target.value } : x)))}
                    className="min-h-[80px] text-sm leading-relaxed"
                  />
                </CardContent>
              </Card>
            ))}
            <Button className="w-full" size="lg" onClick={doSave} disabled={save.isPending}>
              {save.isPending ? <Spinner className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}기록 저장
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────── 기록 목록 ───────── */
function ListTab({ range }: { range: { from?: string; to?: string } }) {
  const utils = trpc.useUtils();
  const list = trpc.caseRecords.list.useQuery(range);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const del = trpc.caseRecords.delete.useMutation({
    onSuccess: () => { utils.caseRecords.invalidate(); toast.success("삭제했습니다."); },
  });
  const upd = trpc.caseRecords.update.useMutation({
    onSuccess: () => { utils.caseRecords.invalidate(); toast.success("수정했습니다."); },
    onError: (e) => toast.error(e.message),
  });
  const [edit, setEdit] = useState<Record<number, Field[]>>({});

  const rows = useMemo(() => {
    const k = q.trim();
    return (list.data ?? []).filter((r) => !k || [r.subject, r.category, r.summary, r.fields.map((f) => f.content).join(" ")].join(" ").includes(k));
  }, [list.data, q]);

  const exportCsv = () => {
    const heads = Array.from(new Set(rows.flatMap((r) => r.fields.map((f) => f.heading))));
    const lines = [["기록일", "대상자", "유형", "양식", "요약", ...heads].map(csvEscape).join(",")];
    for (const r of rows) {
      lines.push([r.recordDate, r.subject, r.category, r.templateName, r.summary, ...heads.map((h) => r.fields.find((f) => f.heading === h)?.content ?? "")].map(csvEscape).join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `사례기록_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (list.isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="대상자·유형·내용 검색" />
        <Button variant="outline" onClick={exportCsv} disabled={!rows.length}><Download className="w-4 h-4 mr-1" />엑셀(CSV)</Button>
      </div>
      {rows.length === 0 && <p className="text-sm text-muted-foreground py-6">저장된 기록이 없습니다.</p>}
      {rows.map((r) => {
        const fields = edit[r.id] ?? r.fields;
        return (
          <Card key={r.id}>
            <CardHeader className="pb-2 cursor-pointer" onClick={() => setOpen(open === r.id ? null : r.id)}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{r.recordDate}</span>
                <Badge variant="secondary">{r.category}</Badge>
                {r.subject && <span className="text-sm text-muted-foreground">{r.subject}</span>}
                <span className="text-xs text-muted-foreground ml-auto">{r.templateName}</span>
              </div>
              {r.summary && <p className="text-sm text-muted-foreground">{r.summary}</p>}
            </CardHeader>
            {open === r.id && (
              <CardContent className="space-y-3">
                {fields.map((f, i) => (
                  <div key={i} className="space-y-1">
                    <Label className="text-xs">{f.heading}</Label>
                    <Textarea
                      value={f.content}
                      onChange={(e) => setEdit((p) => ({ ...p, [r.id]: fields.map((x, j) => (j === i ? { ...x, content: e.target.value } : x)) }))}
                      className="min-h-[64px] text-sm"
                    />
                  </div>
                ))}
                <div className="flex justify-between">
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => window.confirm("이 기록을 삭제할까요?") && del.mutate({ id: r.id })}><Trash2 className="w-4 h-4 mr-1" />삭제</Button>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => copyText(fields.map((f) => `${f.heading}\n${f.content}`).join("\n\n"))}><Copy className="w-4 h-4 mr-1" />전체 복사</Button>
                    <Button size="sm" disabled={!edit[r.id] || upd.isPending} onClick={() => upd.mutate({ id: r.id, fields })}><Save className="w-4 h-4 mr-1" />수정 저장</Button>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ───────── 실적 ───────── */
function Bars({ title, items }: { title: string; items: { key: string; count: number; people: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">데이터가 없습니다.</p>}
        {items.map((i) => (
          <div key={i.key} className="flex items-center gap-2 text-sm">
            <span className="w-28 shrink-0 truncate" title={i.key}>{i.key}</span>
            <div className="flex-1 h-4 bg-muted rounded"><div className="h-4 rounded bg-primary/70" style={{ width: `${(i.count / max) * 100}%` }} /></div>
            <span className="w-24 text-right tabular-nums text-xs">연 {i.count} · 실 {i.people}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function StatsTab({ range }: { range: { from?: string; to?: string } }) {
  const stats = trpc.caseRecords.stats.useQuery(range);
  if (stats.isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  const d = stats.data;
  if (!d) return null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">실인원 (서로 다른 대상자)</p><p className="text-3xl font-bold">{d.people}<span className="text-base font-normal ml-1">명</span></p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">연인원 (기록 건수, 1건 = 1명 1회)</p><p className="text-3xl font-bold">{d.extended}<span className="text-base font-normal ml-1">명</span></p></CardContent></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Bars title="월별 (연인원 · 실인원)" items={d.byMonth} />
        <Bars title="서비스·상담 유형별 (연인원 · 실인원)" items={d.byCategory} />
        <Bars title="양식별 (연인원 · 실인원)" items={d.byTemplate} />
      </div>
      <p className="text-xs text-muted-foreground">실인원은 기록에 적힌 대상자 표기가 같으면 한 명으로 세고, 연인원은 기록 한 건을 1명 1회로 셉니다. 이니셜이 겹치거나 비어 있으면 실제와 다를 수 있으니 공식 실적 보고 전에 확인하세요.</p>
    </div>
  );
}

export default function CaseRecordsPage() {
  const [tab, setTab] = useState("write");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const range = { from: from || undefined, to: to || undefined };
  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold">사례 기록</h1>
          <p className="text-muted-foreground text-sm mt-1">우리 기관 기록 양식을 올리고 편하게 적으면, AI가 양식 항목에 맞게 나누어 저장하고 실적으로 보여 드립니다.</p>
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <TabsList>
              <TabsTrigger value="write"><ClipboardPen className="w-4 h-4 mr-1" />기록 작성</TabsTrigger>
              <TabsTrigger value="list"><ListChecks className="w-4 h-4 mr-1" />기록 목록</TabsTrigger>
              <TabsTrigger value="stats"><BarChart3 className="w-4 h-4 mr-1" />실적 보기</TabsTrigger>
            </TabsList>
            {tab !== "write" && (
              <div className="flex items-center gap-2 text-sm">
                <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
                <span>~</span>
                <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            )}
          </div>
          <TabsContent value="write" className="mt-5"><WriteTab onSaved={() => setTab("list")} /></TabsContent>
          <TabsContent value="list" className="mt-5"><ListTab range={range} /></TabsContent>
          <TabsContent value="stats" className="mt-5"><StatsTab range={range} /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
