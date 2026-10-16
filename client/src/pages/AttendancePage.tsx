import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { ArrowLeft, ChevronLeft, ChevronRight, ClipboardCheck, Download, Pencil, Plus, Trash2, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ATTENDANCE_STATUSES, STATUS_META, summarize, type AttendanceStatus } from "@shared/attendance";
import { kstDateString } from "@shared/access";

const STATUS_STYLE: Record<AttendanceStatus, { on: string; cell: string }> = {
  present: { on: "bg-emerald-600 text-white border-emerald-600", cell: "text-emerald-600" },
  late: { on: "bg-amber-500 text-white border-amber-500", cell: "text-amber-600" },
  absent: { on: "bg-rose-600 text-white border-rose-600", cell: "text-rose-600" },
  excused: { on: "bg-sky-600 text-white border-sky-600", cell: "text-sky-600" },
};

const today = () => kstDateString(new Date());
const shiftDate = (d: string, n: number) => new Date(new Date(d + "T00:00:00Z").getTime() + n * 86400000).toISOString().slice(0, 10);
const shortDate = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const dow = (d: string) => "일월화수목금토"[new Date(d + "T00:00:00Z").getUTCDay()];

/** 사업 선택 화면 (/attendance) */
function ProjectPicker() {
  const [, setLocation] = useLocation();
  const [year, setYear] = useState(new Date().getFullYear());
  const { data = [], isLoading } = trpc.projects.listParents.useQuery({ year });
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><ClipboardCheck className="h-6 w-6" />출석부</h1>
        <p className="text-sm text-muted-foreground mt-1">출석부를 쓸 사업을 선택하세요. 반과 참여자는 사업 단위로 관리됩니다.</p>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setYear(year - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="font-medium w-16 text-center">{year}년</span>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setYear(year + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
      {isLoading ? <Skeleton className="h-24" /> : data.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-10 text-center text-sm text-muted-foreground">{year}년에 등록된 사업이 없습니다. 먼저 '사업 관리'에서 사업을 만들어 주세요.</CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((p) => (
            <button key={p.id} onClick={() => setLocation(`/attendance/${p.id}`)} className="text-left rounded-lg border p-4 hover:bg-muted/40 transition-colors">
              <p className="font-medium">{p.projectName}</p>
              <p className="text-xs text-muted-foreground mt-1">출석부 열기 →</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AttendancePage() {
  const params = useParams<{ projectId?: string }>();
  const projectId = parseInt(params.projectId ?? "0");
  if (!projectId) return <ProjectPicker />;
  return <AttendanceMain projectId={projectId} />;
}

function AttendanceMain({ projectId }: { projectId: number }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: project } = trpc.projects.get.useQuery({ id: projectId });
  const { data: classes = [], isLoading } = trpc.attendance.classes.useQuery({ projectId });
  const [classId, setClassId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [month, setMonth] = useState(today().slice(0, 7));
  const [date, setDate] = useState(today());
  const [tab, setTab] = useState("check");

  useEffect(() => {
    if (classes.length && (classId === null || !classes.some((c) => c.id === classId))) setClassId(classes[0].id);
    if (!classes.length) setClassId(null);
  }, [classes, classId]);

  const { data: overview = [] } = trpc.attendance.overview.useQuery({ projectId, month });
  const refreshAll = () => { utils.attendance.classes.invalidate(); utils.attendance.overview.invalidate(); utils.attendance.sheet.invalidate(); utils.attendance.classMap.invalidate(); };
  const createClass = trpc.attendance.createClass.useMutation({
    onSuccess: (r) => { refreshAll(); setClassId(r.id); setNewName(""); toast.success("반을 만들었습니다. '반 구성원' 탭에서 참여자를 배정하세요."); setTab("members"); },
    onError: (e) => toast.error(e.message),
  });
  const renameClass = trpc.attendance.renameClass.useMutation({ onSuccess: refreshAll, onError: (e) => toast.error(e.message) });
  const deleteClass = trpc.attendance.deleteClass.useMutation({ onSuccess: () => { refreshAll(); toast.success("반을 삭제했습니다."); }, onError: (e) => toast.error(e.message) });
  const cls = classes.find((c) => c.id === classId) ?? null;

  const jumpToDate = (d: string) => { setDate(d); setMonth(d.slice(0, 7)); setTab("check"); };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLocation(`/participants/${projectId}`)}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><ClipboardCheck className="h-6 w-6" />출석부</h1>
          {project && <p className="text-sm text-muted-foreground mt-0.5">{project.projectName}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={() => setLocation(`/participants/${projectId}`)}><Users className="h-4 w-4 mr-1.5" />참여자 관리</Button>
      </div>

      {/* 한눈에 보기: 이번 달 반별 현황 */}
      {overview.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">{Number(month.slice(5))}월 반별 현황</p>
            <Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-8 w-40 text-sm" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {overview.map((o) => (
              <button key={o.id} onClick={() => { setClassId(o.id); setTab("status"); }} className={`text-left rounded-lg border p-3 transition-colors hover:bg-muted/40 ${o.id === classId ? "border-primary ring-1 ring-primary/30" : ""}`}>
                <p className="font-medium text-sm truncate">{o.name}</p>
                <p className="text-2xl font-semibold mt-1">{o.rate === null ? "-" : `${o.rate}%`}<span className="text-xs font-normal text-muted-foreground ml-1">출석률</span></p>
                <div className="h-1.5 rounded bg-muted mt-2 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${o.rate ?? 0}%` }} /></div>
                <p className="text-xs text-muted-foreground mt-2">실 {o.people}명 · 연 {o.extended}명 · {o.sessions}회차<br />등록 {o.members}명{o.lastDate ? ` · 최근 ${shortDate(o.lastDate)}` : ""}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 반 선택·관리 */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {isLoading ? <Skeleton className="h-8 w-40" /> : classes.map((c) => (
              <button key={c.id} onClick={() => setClassId(c.id)} className={`px-3 py-1.5 rounded-full border text-sm ${c.id === classId ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted/50"}`}>
                {c.name} <span className="opacity-70 text-xs">{c.memberCount}</span>
              </button>
            ))}
            <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); if (newName.trim()) createClass.mutate({ projectId, name: newName.trim() }); }}>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="새 반 이름 (예: 한국어 초급A)" className="h-8 w-52 text-sm" />
              <Button type="submit" size="sm" className="h-8" disabled={!newName.trim() || createClass.isPending}><Plus className="h-3.5 w-3.5 mr-1" />반 만들기</Button>
            </form>
            {cls && (
              <div className="ml-auto flex gap-1">
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { const n = window.prompt("새 반 이름", cls.name); if (n && n.trim()) renameClass.mutate({ id: cls.id, name: n.trim() }); }}><Pencil className="h-3 w-3 mr-1" />이름 변경</Button>
                <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive" onClick={() => { if (window.confirm(`'${cls.name}' 반과 출결 기록을 모두 삭제할까요? 참여자 정보는 지워지지 않습니다.`)) deleteClass.mutate({ id: cls.id }); }}><Trash2 className="h-3 w-3 mr-1" />삭제</Button>
              </div>
            )}
          </div>
          {classes.length === 0 && !isLoading && <p className="text-sm text-muted-foreground">아직 반이 없습니다. 반 이름을 입력해 만들거나, 참여자 엑셀의 '반' 열에 이름을 적어 등록하면 자동으로 만들어집니다.</p>}
        </CardContent>
      </Card>

      {cls && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="check">출석 체크</TabsTrigger>
            <TabsTrigger value="status">월간 현황</TabsTrigger>
            <TabsTrigger value="members">반 구성원</TabsTrigger>
          </TabsList>
          <TabsContent value="check" className="mt-4"><CheckTab classId={cls.id} className={cls.name} date={date} setDate={setDate} onSaved={refreshAll} /></TabsContent>
          <TabsContent value="status" className="mt-4"><StatusTab classId={cls.id} className={cls.name} month={month} setMonth={setMonth} onPickDate={jumpToDate} /></TabsContent>
          <TabsContent value="members" className="mt-4"><MembersTab projectId={projectId} classId={cls.id} onSaved={refreshAll} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ─── 출석 체크 ────────────────────────────────────────────────────────────────
function CheckTab({ classId, className, date, setDate, onSaved }: { classId: number; className: string; date: string; setDate: (d: string) => void; onSaved: () => void }) {
  const { data, isLoading } = trpc.attendance.sheet.useQuery({ classId, month: date.slice(0, 7) });
  const [edits, setEdits] = useState<Record<number, AttendanceStatus | null>>({});
  useEffect(() => setEdits({}), [classId, date]);

  const saved = useMemo(() => {
    const m = new Map<number, AttendanceStatus>();
    data?.records.filter((r) => r.date === date).forEach((r) => m.set(r.participantId, r.status));
    return m;
  }, [data, date]);
  const current = (id: number): AttendanceStatus | null => (id in edits ? edits[id] : saved.get(id) ?? null);
  const dirty = Object.keys(edits).length > 0;

  const mark = trpc.attendance.mark.useMutation({
    onSuccess: () => { toast.success("출결을 저장했습니다."); setEdits({}); onSaved(); },
    onError: (e) => toast.error(e.message),
  });

  const members = data?.members ?? [];
  const counts = members.reduce((a, m) => { const s = current(m.id); if (s) a[s]++; else a.none++; return a; }, { present: 0, late: 0, absent: 0, excused: 0, none: 0 } as Record<string, number>);
  const setOne = (id: number, s: AttendanceStatus) => setEdits((e) => ({ ...e, [id]: current(id) === s ? null : s }));
  const all = (s: AttendanceStatus) => setEdits(Object.fromEntries(members.map((m) => [m.id, s])));
  const save = () => mark.mutate({ classId, date, entries: Object.entries(edits).map(([id, status]) => ({ participantId: Number(id), status })) });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base mr-2">{className}</CardTitle>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setDate(shiftDate(date, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-8 w-40 text-sm" />
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setDate(shiftDate(date, 1))}><ChevronRight className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground">({dow(date)})</span>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setDate(today())}>오늘</Button>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" className="h-8" onClick={() => all("present")} disabled={!members.length}>전원 출석</Button>
            <Button size="sm" className="h-8" onClick={save} disabled={!dirty || mark.isPending}>{mark.isPending ? "저장 중..." : dirty ? "저장" : "저장됨"}</Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-2">
          {ATTENDANCE_STATUSES.map((s) => <span key={s}><b className={STATUS_STYLE[s].cell}>{STATUS_META[s].mark}</b> {STATUS_META[s].label} {counts[s]}</span>)}
          <span>미체크 {counts.none}</span>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-32" /> : members.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">이 반에 배정된 참여자가 없습니다. '반 구성원' 탭에서 배정해 주세요.</p>
        ) : (
          <div className="divide-y">
            {members.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3 py-2">
                <span className="w-6 text-xs text-muted-foreground text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm">{m.name}</span>
                  <Badge variant="secondary" className="ml-2 text-[10px]">{m.kind === "domestic" ? "내국인" : m.nationality || "외국인"}</Badge>
                </div>
                <div className="flex gap-1">
                  {ATTENDANCE_STATUSES.map((s) => (
                    <button key={s} onClick={() => setOne(m.id, s)} className={`h-8 min-w-12 px-2 rounded-md border text-xs font-medium transition-colors ${current(m.id) === s ? STATUS_STYLE[s].on : "bg-background text-muted-foreground hover:bg-muted/60"}`}>
                      {STATUS_META[s].label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── 월간 현황 ────────────────────────────────────────────────────────────────
function StatusTab({ classId, className, month, setMonth, onPickDate }: { classId: number; className: string; month: string; setMonth: (m: string) => void; onPickDate: (d: string) => void }) {
  const { data, isLoading } = trpc.attendance.sheet.useQuery({ classId, month });
  const members = data?.members ?? [];
  const sum = useMemo(() => summarize(data?.records ?? [], members.map((m) => m.id)), [data, members]);
  const rec = useMemo(() => { const m = new Map<string, AttendanceStatus>(); data?.records.forEach((r) => m.set(`${r.participantId}:${r.date}`, r.status)); return m; }, [data]);

  const download = () => {
    const header = ["이름", ...sum.dates.map(shortDate), "출석", "지각", "결석", "사유", "출석률(%)"];
    const rows = members.map((m) => {
      const t = sum.byParticipant.get(m.id)!;
      return [m.name, ...sum.dates.map((d) => { const s = rec.get(`${m.id}:${d}`); return s ? STATUS_META[s].mark : ""; }), t.present, t.late, t.absent, t.excused, t.rate ?? ""];
    });
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.sheet_add_aoa(ws, [[], ["실인원(1회 이상 참석)", sum.people], ["연인원(출석+지각)", sum.extended], ["진행 회차", sum.dates.length], ["평균 출석률(%)", sum.all.rate ?? ""]], { origin: -1 });
    XLSX.utils.book_append_sheet(wb, ws, "출석부");
    XLSX.writeFile(wb, `출석부_${className}_${month}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-8 w-40 text-sm" />
        <Button variant="outline" size="sm" className="h-8 ml-auto" onClick={download} disabled={!members.length}><Download className="h-4 w-4 mr-1.5" />엑셀로 저장</Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="실인원 (1회 이상 참석)" value={`${sum.people}명`} sub={`등록 ${members.length}명`} />
        <Stat label="연인원 (참석 누계)" value={`${sum.extended}명`} sub="출석+지각 합계" />
        <Stat label="진행 회차" value={`${sum.dates.length}회`} sub={`결석 ${sum.all.absent}건`} />
        <Stat label="평균 출석률" value={sum.all.rate === null ? "-" : `${sum.all.rate}%`} />
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? <Skeleton className="h-32 m-4" /> : members.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">반에 배정된 참여자가 없습니다.</p>
          ) : sum.dates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{Number(month.slice(5))}월에 저장된 출결이 없습니다. '출석 체크' 탭에서 기록해 주세요.</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/40 border-b">
                  <th className="sticky left-0 bg-muted/40 text-left px-3 py-2 font-medium min-w-28">이름</th>
                  {sum.dates.map((d) => (
                    <th key={d} className="px-1.5 py-2 font-normal text-xs min-w-10">
                      <button className="hover:underline" onClick={() => onPickDate(d)} title="이 날짜 출석 체크 열기">{shortDate(d)}<br /><span className="text-muted-foreground">{dow(d)}</span></button>
                    </th>
                  ))}
                  <th className="px-2 py-2 text-xs font-medium">출석</th>
                  <th className="px-2 py-2 text-xs font-medium">지각</th>
                  <th className="px-2 py-2 text-xs font-medium">결석</th>
                  <th className="px-2 py-2 text-xs font-medium">사유</th>
                  <th className="px-3 py-2 text-xs font-medium min-w-28">출석률</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {members.map((m) => {
                  const t = sum.byParticipant.get(m.id)!;
                  return (
                    <tr key={m.id}>
                      <td className="sticky left-0 bg-background px-3 py-2 font-medium">{m.name}</td>
                      {sum.dates.map((d) => {
                        const s = rec.get(`${m.id}:${d}`);
                        return <td key={d} className={`text-center ${s ? STATUS_STYLE[s].cell : "text-muted-foreground/30"}`} title={s ? STATUS_META[s].label : "미체크"}>{s ? STATUS_META[s].mark : "·"}</td>;
                      })}
                      <td className="text-center">{t.present}</td>
                      <td className="text-center">{t.late}</td>
                      <td className={`text-center ${t.absent ? "text-rose-600 font-medium" : ""}`}>{t.absent}</td>
                      <td className="text-center">{t.excused}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded bg-muted overflow-hidden"><div className={`h-full ${(t.rate ?? 100) < 70 ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${t.rate ?? 0}%` }} /></div>
                          <span className="text-xs w-10 text-right">{t.rate === null ? "-" : `${t.rate}%`}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30 text-xs">
                  <td className="sticky left-0 bg-muted/30 px-3 py-2 font-medium">참석 인원</td>
                  {sum.dates.map((d) => { const t = sum.byDate.get(d)!; return <td key={d} className="text-center py-2">{t.present + t.late}</td>; })}
                  <td colSpan={5} className="px-3 text-muted-foreground">회차별 참석(출석+지각) · 합계 = 연인원 {sum.extended}명</td>
                </tr>
              </tfoot>
            </table>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">○ 출석 · △ 지각 · ✕ 결석 · □ 사유(공결) · 출석률 = (출석+지각) ÷ (출석+지각+결석), 사유는 계산에서 제외됩니다.</p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold mt-0.5">{value}</p>{sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}</CardContent></Card>
  );
}

// ─── 반 구성원 ────────────────────────────────────────────────────────────────
function MembersTab({ projectId, classId, onSaved }: { projectId: number; classId: number; onSaved: () => void }) {
  const { data: all = [] } = trpc.participants.list.useQuery({ projectId });
  const { data } = trpc.attendance.sheet.useQuery({ classId, month: today().slice(0, 7) });
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [kind, setKind] = useState<"all" | "foreigner" | "domestic">("all");
  const [q, setQ] = useState("");
  useEffect(() => { if (data) setSel(new Set(data.members.map((m) => m.id))); }, [data?.cls.id, data?.members.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = trpc.attendance.setMembers.useMutation({
    onSuccess: () => { toast.success("반 구성원을 저장했습니다."); onSaved(); },
    onError: (e) => toast.error(e.message),
  });
  const list = all.filter((p) => (kind === "all" || p.kind === kind) && (!q || p.name.toLowerCase().includes(q.toLowerCase())));
  const toggle = (id: number) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allShownSelected = list.length > 0 && list.every((p) => sel.has(p.id));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base mr-2">참여자 배정 <span className="text-sm font-normal text-muted-foreground">({sel.size}명 선택)</span></CardTitle>
          <div className="inline-flex rounded-md border bg-muted/40 p-0.5 text-xs">
            {([["all", "전체"], ["foreigner", "외국인"], ["domestic", "내국인"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setKind(k)} className={`px-2.5 py-1 rounded ${kind === k ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>{l}</button>
            ))}
          </div>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름 검색" className="h-8 w-36 text-sm" />
          <Button variant="outline" size="sm" className="h-8" onClick={() => setSel((s) => { const n = new Set(s); list.forEach((p) => (allShownSelected ? n.delete(p.id) : n.add(p.id))); return n; })}>{allShownSelected ? "보이는 목록 해제" : "보이는 목록 전체 선택"}</Button>
          <Button size="sm" className="h-8 ml-auto" onClick={() => save.mutate({ classId, participantIds: Array.from(sel) })} disabled={save.isPending}>{save.isPending ? "저장 중..." : "저장"}</Button>
        </div>
      </CardHeader>
      <CardContent>
        {all.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">등록된 참여자가 없습니다. '참여자 관리'에서 등록하거나 엑셀로 가져오세요.</p>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => (
              <label key={p.id} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer ${sel.has(p.id) ? "bg-primary/5 border-primary/40" : "hover:bg-muted/40"}`}>
                <input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} />
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground ml-auto">{p.kind === "domestic" ? "내국인" : p.nationality || "외국인"}</span>
              </label>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
