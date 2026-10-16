import { useMemo, useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ClipboardList,
  Copy,
  Check,
  Sparkles,
  FileText,
  ChevronLeft,
  AlertCircle,
  Download,
  Save,
  Pencil,
  Trash2,
  Clock,
  ChevronRight,
  X,
} from "lucide-react";

const currentYear = new Date().getFullYear();

const PERIOD_OPTIONS = [
  { value: "q1", label: "1분기 (1~3월)" },
  { value: "q2", label: "2분기 (4~6월)" },
  { value: "q3", label: "3분기 (7~9월)" },
  { value: "q4", label: "4분기 (10~12월)" },
  { value: "h1", label: "상반기 (1~6월)" },
  { value: "h2", label: "하반기 (7~12월)" },
  { value: "annual", label: "연간 (1~12월)" },
  { value: "custom", label: "사용자 지정" },
] as const;

type Period = (typeof PERIOD_OPTIONS)[number]["value"];
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

// 섹션 정의
const SECTIONS = [
  { key: "contentActivity" as const, label: "추진 실적", desc: "추진한 주요 활동 및 실적" },
  { key: "contentOutcome" as const, label: "사업 성과", desc: "사업을 통해 달성한 주요 성과" },
  { key: "contentPerformance" as const, label: "사업 추진 성과", desc: "정량·정성 평가" },
  { key: "contentSelfEval" as const, label: "자체 평가", desc: "자체 평가 및 개선 방안" },
];

type SectionKey = (typeof SECTIONS)[number]["key"];

// AI 생성 텍스트에서 섹션 파싱
function parseEvalSections(text: string): Record<SectionKey, string> {
  const sectionMap: Record<string, SectionKey> = {
    "추진 실적": "contentActivity",
    "사업 성과": "contentOutcome",
    "사업 추진 성과": "contentPerformance",
    "자체 평가": "contentSelfEval",
  };
  const result: Record<SectionKey, string> = {
    contentActivity: "",
    contentOutcome: "",
    contentPerformance: "",
    contentSelfEval: "",
  };
  const sectionKeys = Object.keys(sectionMap);
  for (let i = 0; i < sectionKeys.length; i++) {
    const current = sectionKeys[i];
    const next = sectionKeys[i + 1];
    const startPattern = new RegExp(`\\[${current}\\]`, "i");
    const startMatch = text.search(startPattern);
    if (startMatch === -1) continue;
    const contentStart = startMatch + `[${current}]`.length;
    let contentEnd = text.length;
    if (next) {
      const nextPattern = new RegExp(`\\[${next}\\]`, "i");
      const nextMatch = text.search(nextPattern);
      if (nextMatch !== -1) contentEnd = nextMatch;
    }
    const key = sectionMap[current];
    result[key] = text.slice(contentStart, contentEnd).trim();
  }
  return result;
}

function formatDate(date: Date | string) {
  const d = new Date(date);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default function EvaluationPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [, setLocation] = useLocation();
  const pid = parseInt(projectId ?? "0");

  // ── 생성 폼 상태 ──────────────────────────────────────────────────────────────
  const [year, setYear] = useState(currentYear);
  const [period, setPeriod] = useState<Period>("h1");
  const [customStartMonth, setCustomStartMonth] = useState(1);
  const [customEndMonth, setCustomEndMonth] = useState(6);

  // ── 현재 편집 중인 평가서 상태 ─────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<number | null>(null); // null = 새 생성
  const [editTitle, setEditTitle] = useState("");
  const [editSections, setEditSections] = useState<Record<SectionKey, string>>({
    contentActivity: "",
    contentOutcome: "",
    contentPerformance: "",
    contentSelfEval: "",
  });
  const [isEditing, setIsEditing] = useState(false);

  // ── UI 상태 ───────────────────────────────────────────────────────────────────
  const [showList, setShowList] = useState(() => (typeof window === "undefined" ? true : window.innerWidth >= 768));
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const utils = trpc.useUtils();

  // ── 쿼리 ─────────────────────────────────────────────────────────────────────
  const { data: project } = trpc.projects.get.useQuery({ id: pid }, { enabled: pid > 0 });
  const { data: planFiles = [] } = trpc.projectPlans.list.useQuery({ projectId: pid }, { enabled: pid > 0 });
  const { data: savedList = [], isLoading: listLoading } = trpc.evaluation.list.useQuery(
    { projectId: pid },
    { enabled: pid > 0 }
  );
  const previewInput = useMemo(() => ({
    parentId: pid,
    year,
    period,
    ...(period === "custom" ? { customStartMonth, customEndMonth } : {}),
  }), [pid, year, period, customStartMonth, customEndMonth]);
  const customRangeValid = period !== "custom" || customStartMonth <= customEndMonth;
  const { data: periodPreview, isLoading: previewLoading } = trpc.evaluation.previewPeriod.useQuery(
    previewInput,
    { enabled: pid > 0 && customRangeValid }
  );

  // ── 뮤테이션 ─────────────────────────────────────────────────────────────────
  const generate = trpc.evaluation.generate.useMutation({
    onSuccess: (data) => {
      const parsed = parseEvalSections(data.text);
      const defaultTitle = `${data.projectName} ${data.year}년 ${data.periodLabel} 평가서`;
      setEditTitle(defaultTitle);
      setEditSections(parsed);
      setEditingId(null);
      setIsEditing(false);
      toast.success("평가서 초안이 생성되었습니다. 내용 확인 후 저장하세요.");
    },
    onError: (err) => toast.error("평가서 생성 실패: " + err.message),
  });

  const saveEval = trpc.evaluation.save.useMutation({
    onSuccess: (data) => {
      utils.evaluation.list.invalidate({ projectId: pid });
      setEditingId(data.id);
      setIsEditing(false);
      toast.success("평가서가 저장되었습니다.");
    },
    onError: () => toast.error("저장에 실패했습니다."),
  });

  const updateEval = trpc.evaluation.update.useMutation({
    onSuccess: () => {
      utils.evaluation.list.invalidate({ projectId: pid });
      setIsEditing(false);
      toast.success("평가서가 수정되었습니다.");
    },
    onError: () => toast.error("수정에 실패했습니다."),
  });

  const deleteEval = trpc.evaluation.delete.useMutation({
    onSuccess: () => {
      utils.evaluation.list.invalidate({ projectId: pid });
      if (editingId === deleteTargetId) {
        setEditingId(null);
        setEditTitle("");
        setEditSections({ contentActivity: "", contentOutcome: "", contentPerformance: "", contentSelfEval: "" });
      }
      setDeleteTargetId(null);
      toast.success("평가서가 삭제되었습니다.");
    },
    onError: () => toast.error("삭제에 실패했습니다."),
  });

  // ── 핸들러 ────────────────────────────────────────────────────────────────────
  const handleGenerate = () => {
    if (!pid) return;
    if (period === "custom" && customStartMonth > customEndMonth) {
      return toast.error("종료월은 시작월 이후로 선택해주세요.");
    }
    generate.mutate({
      parentId: pid,
      year,
      period,
      ...(period === "custom" ? { customStartMonth, customEndMonth } : {}),
    });
  };

  const handleSave = () => {
    if (!editTitle.trim()) return toast.error("제목을 입력해주세요.");
    const periodLabel = period === "custom"
      ? `${customStartMonth}~${customEndMonth}월`
      : PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? period;
    saveEval.mutate({
      projectId: pid,
      year,
      period,
      periodLabel,
      title: editTitle,
      ...editSections,
    });
  };

  const handleUpdate = () => {
    if (!editingId) return;
    if (!editTitle.trim()) return toast.error("제목을 입력해주세요.");
    updateEval.mutate({ id: editingId, title: editTitle, ...editSections });
  };

  const handleLoadSaved = (ev: (typeof savedList)[0]) => {
    setEditingId(ev.id);
    setEditTitle(ev.title);
    setEditSections({
      contentActivity: ev.contentActivity ?? "",
      contentOutcome: ev.contentOutcome ?? "",
      contentPerformance: ev.contentPerformance ?? "",
      contentSelfEval: ev.contentSelfEval ?? "",
    });
    setIsEditing(false);
  };

  const handleCopySection = async (label: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedSection(label);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleCopyAll = async () => {
    const text = SECTIONS.map((s) => `[${s.label}]\n${editSections[s.key]}`).join("\n\n");
    await navigator.clipboard.writeText(editTitle + "\n\n" + text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
    toast.success("전체 내용이 복사되었습니다.");
  };

  const handleDownload = () => {
    const text = `${editTitle}\n\n` + SECTIONS.map((s) => `[${s.label}]\n${editSections[s.key]}`).join("\n\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${editTitle}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasContent = Object.values(editSections).some((v) => v.trim().length > 0) || editTitle.trim().length > 0;

  return (
    <div className="flex flex-col md:flex-row gap-4 h-full min-h-0 p-3 md:p-0">
      {/* ── 왼쪽: 저장된 평가서 목록 패널 ─────────────────────────────────────── */}
      {showList && (
        <div className="w-full md:w-64 md:shrink-0 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">저장된 평가서</h2>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowList(false)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex flex-col gap-1 overflow-y-auto max-h-48 md:max-h-[calc(100vh-200px)]">
            {listLoading ? (
              [1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)
            ) : savedList.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-lg">
                저장된 평가서가 없습니다
              </div>
            ) : (
              savedList.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => handleLoadSaved(ev)}
                  className={`group relative p-3 rounded-lg border cursor-pointer transition-colors ${
                    editingId === ev.id
                      ? "bg-primary/5 border-primary/30"
                      : "bg-card border-border/40 hover:bg-muted/40"
                  }`}
                >
                  <p className="text-xs font-medium leading-snug line-clamp-2 pr-5">{ev.title}</p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">{ev.periodLabel}</Badge>
                    <div className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">{formatDate(ev.updatedAt)}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTargetId(ev.id); }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── 오른쪽: 메인 영역 ──────────────────────────────────────────────────── */}
      <div className="w-full md:flex-1 min-w-0 space-y-4 overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center gap-3">
          {!showList && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowList(true)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLocation("/projects")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              AI 평가서 자동완성
            </h1>
            {project && <p className="text-sm text-muted-foreground mt-0.5">{project.projectName}</p>}
          </div>
        </div>

        {/* 생성 설정 카드 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">평가서 생성</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 계획서 안내 */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border/30">
              <FileText className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium">
                  사업 계획서{" "}
                  {planFiles.length > 0 ? (
                    <Badge variant="secondary" className="ml-1">{planFiles.length}개 등록됨</Badge>
                  ) : (
                    <Badge variant="outline" className="ml-1 text-muted-foreground">미등록</Badge>
                  )}
                </p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  {planFiles.length > 0
                    ? `${planFiles.map((f) => f.fileName).join(", ")} — 계획서 내용을 참고하여 작성합니다.`
                    : "사업 관리 페이지에서 계획서 PDF를 등록하면 더 정확한 평가서를 작성합니다."}
                </p>
              </div>
            </div>

            {/* 연도·기간 선택 */}
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1.5">
                <Label>연도</Label>
                <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}년</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>평가 기간</Label>
                <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {period === "custom" && (
                <div className="flex items-end gap-2">
                  <div className="space-y-1.5">
                    <Label>시작월</Label>
                    <Select value={String(customStartMonth)} onValueChange={(v) => {
                      const month = parseInt(v, 10);
                      setCustomStartMonth(month);
                      if (month > customEndMonth) setCustomEndMonth(month);
                    }}>
                      <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MONTH_OPTIONS.map((month) => (
                          <SelectItem key={month} value={String(month)}>{month}월</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <span className="pb-2 text-muted-foreground">~</span>
                  <div className="space-y-1.5">
                    <Label>종료월</Label>
                    <Select value={String(customEndMonth)} onValueChange={(v) => setCustomEndMonth(parseInt(v, 10))}>
                      <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MONTH_OPTIONS.filter((month) => month >= customStartMonth).map((month) => (
                          <SelectItem key={month} value={String(month)}>{month}월</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <Button onClick={handleGenerate} disabled={generate.isPending || pid === 0} className="gap-2">
                {generate.isPending ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                    AI 생성 중...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    AI 초안 생성
                  </>
                )}
              </Button>
            </div>

            {/* 선택 기간 실적 미리보기 */}
            {customRangeValid && (
              <div className="rounded-lg border border-primary/15 bg-primary/[0.03] p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-sm font-medium">선택 기간 실적 미리보기</p>
                  {previewLoading ? (
                    <span className="text-xs text-muted-foreground">집계 중...</span>
                  ) : periodPreview ? (
                    <span className="text-xs text-muted-foreground">{periodPreview.periodLabel} 기준</span>
                  ) : null}
                </div>
                {periodPreview && (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-md bg-background/80 px-2.5 py-2">
                        <p className="text-[11px] text-muted-foreground">진행 건수</p>
                        <p className="text-base font-semibold">{periodPreview.recordCount}건</p>
                      </div>
                      <div className="rounded-md bg-background/80 px-2.5 py-2">
                        <p className="text-[11px] text-muted-foreground">총 진행 횟수</p>
                        <p className="text-base font-semibold">{periodPreview.totalCount}회</p>
                      </div>
                      <div className="rounded-md bg-background/80 px-2.5 py-2">
                        <p className="text-[11px] text-muted-foreground">총 참여 인원(연인원)</p>
                        <p className="text-base font-semibold">{periodPreview.totalParticipants}명</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {periodPreview.months.map((month) => (
                        <span
                          key={month.month}
                          className={`rounded-full border px-2 py-0.5 text-[11px] ${month.records > 0 ? "border-primary/30 bg-primary/10 text-primary" : "border-border/50 text-muted-foreground"}`}
                        >
                          {month.month}월 {month.records}건 · {month.count}회
                        </span>
                      ))}
                    </div>
                  </>
                )}
                {!previewLoading && periodPreview?.recordCount === 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">선택한 기간에 등록된 실적이 없습니다. 그래도 AI 초안은 생성할 수 있습니다.</p>
                )}
              </div>
            )}

            {generate.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                실적 데이터와 사업 계획서를 분석 중입니다. 약 10~30초 소요됩니다.
              </div>
            )}
          </CardContent>
        </Card>

        {/* 로딩 스켈레톤 */}
        {generate.isPending && (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2"><Skeleton className="h-5 w-32" /></CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/6" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 편집 영역 */}
        {hasContent && !generate.isPending && (
          <div className="space-y-4">
            {/* 제목 + 액션 버튼 */}
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-1">
                <Label>평가서 제목</Label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="평가서 제목을 입력하세요"
                  className="font-medium"
                />
              </div>
              <div className="flex gap-2 pt-6">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownload}>
                  <Download className="h-3.5 w-3.5" />
                  다운로드
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopyAll}>
                  {copiedAll ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  전체 복사
                </Button>
                {editingId ? (
                  isEditing ? (
                    <>
                      <Button size="sm" className="gap-1.5" onClick={handleUpdate} disabled={updateEval.isPending}>
                        <Save className="h-3.5 w-3.5" />
                        {updateEval.isPending ? "저장 중..." : "수정 저장"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setIsEditing(true)}>
                      <Pencil className="h-3.5 w-3.5" />
                      편집
                    </Button>
                  )
                ) : (
                  <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saveEval.isPending}>
                    <Save className="h-3.5 w-3.5" />
                    {saveEval.isPending ? "저장 중..." : "저장"}
                  </Button>
                )}
              </div>
            </div>

            {editingId && !isEditing && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-green-500" />
                저장된 평가서입니다. "편집" 버튼을 눌러 내용을 수정할 수 있습니다.
              </div>
            )}

            <Separator />

            {/* 섹션별 카드 */}
            {SECTIONS.map((section) => (
              <Card key={section.key} className="overflow-hidden">
                <CardHeader className="pb-2 bg-muted/20 border-b border-border/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold">{section.label}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{section.desc}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => handleCopySection(section.label, editSections[section.key])}
                      disabled={!editSections[section.key]}
                    >
                      {copiedSection === section.label ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      복사
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-3">
                  {isEditing || !editingId ? (
                    <Textarea
                      value={editSections[section.key]}
                      onChange={(e) =>
                        setEditSections((prev) => ({ ...prev, [section.key]: e.target.value }))
                      }
                      className="min-h-[120px] text-sm leading-relaxed resize-y"
                      placeholder={`${section.label} 내용을 입력하세요...`}
                    />
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {editSections[section.key] || (
                        <span className="text-muted-foreground italic">내용이 없습니다.</span>
                      )}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 빈 상태 */}
        {!hasContent && !generate.isPending && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <ClipboardList className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm">위에서 연도와 기간을 선택한 후 "AI 초안 생성"을 클릭하거나,</p>
            <p className="text-sm">왼쪽 목록에서 저장된 평가서를 선택하세요.</p>
          </div>
        )}
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteTargetId !== null} onOpenChange={() => setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>평가서 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 평가서를 삭제하면 복구할 수 없습니다. 계속하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTargetId && deleteEval.mutate({ id: deleteTargetId })}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
