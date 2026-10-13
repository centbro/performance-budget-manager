import { useState, useMemo } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  List,
  Pencil,
  Trash2,
  Calendar,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// 색상 팔레트
const COLOR_OPTIONS = [
  { value: "blue", label: "파랑", bg: "bg-blue-500", light: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "green", label: "초록", bg: "bg-green-500", light: "bg-green-100 text-green-800 border-green-200" },
  { value: "red", label: "빨강", bg: "bg-red-500", light: "bg-red-100 text-red-800 border-red-200" },
  { value: "orange", label: "주황", bg: "bg-orange-500", light: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "purple", label: "보라", bg: "bg-purple-500", light: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "pink", label: "분홍", bg: "bg-pink-500", light: "bg-pink-100 text-pink-800 border-pink-200" },
];

function getColorClass(color: string) {
  return COLOR_OPTIONS.find((c) => c.value === color) ?? COLOR_OPTIONS[0];
}

type Schedule = {
  id: number;
  projectId: number;
  userId: number;
  title: string;
  description: string | null;
  startDate: Date | string;
  endDate: Date | string;
  allDay: boolean;
  color: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function toDateStr(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

type FormData = {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  color: string;
};

const defaultForm: FormData = {
  title: "",
  description: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  color: "blue",
};

// ─── 캘린더 뷰 ───────────────────────────────────────────────────────────────

function CalendarView({
  schedules,
  year,
  month,
  onPrev,
  onNext,
  onDayClick,
  onEdit,
}: {
  schedules: Schedule[];
  year: number;
  month: number; // 0-indexed
  onPrev: () => void;
  onNext: () => void;
  onDayClick: (dateStr: string) => void;
  onEdit: (s: Schedule) => void;
}) {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // 날짜별 일정 매핑
  const schedulesByDate = useMemo(() => {
    const map: Record<string, Schedule[]> = {};
    schedules.forEach((s) => {
      const start = toDateStr(s.startDate);
      const end = toDateStr(s.endDate);
      // 기간 내 모든 날짜에 추가
      let cur = new Date(start);
      const endD = new Date(end);
      while (cur <= endD) {
        const key = cur.toISOString().slice(0, 10);
        if (!map[key]) map[key] = [];
        map[key].push(s);
        cur.setDate(cur.getDate() + 1);
      }
    });
    return map;
  }, [schedules]);

  const today = new Date().toISOString().slice(0, 10);
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // 6행 맞추기
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = `${year}년 ${month + 1}월`;
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={onPrev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-base font-semibold">{monthLabel}</span>
        <Button variant="ghost" size="icon" onClick={onNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-1">
        {dayNames.map((d, i) => (
          <div
            key={d}
            className={`text-center text-xs font-medium py-1 ${
              i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-muted-foreground"
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 셀 */}
      <div className="grid grid-cols-7 border-l border-t border-border/40">
        {cells.map((day, idx) => {
          const dateStr =
            day !== null
              ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
              : null;
          const daySchedules = dateStr ? (schedulesByDate[dateStr] ?? []) : [];
          const isToday = dateStr === today;
          const isSun = idx % 7 === 0;
          const isSat = idx % 7 === 6;

          return (
            <div
              key={idx}
              className={`min-h-[80px] border-r border-b border-border/40 p-1 ${
                day ? "cursor-pointer hover:bg-muted/30 transition-colors" : "bg-muted/10"
              }`}
              onClick={() => day && dateStr && onDayClick(dateStr)}
            >
              {day !== null && (
                <>
                  <div
                    className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-0.5 ${
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : isSun
                        ? "text-red-500"
                        : isSat
                        ? "text-blue-500"
                        : "text-foreground"
                    }`}
                  >
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {daySchedules.slice(0, 3).map((s) => {
                      const cc = getColorClass(s.color);
                      return (
                        <div
                          key={s.id}
                          className={`text-[10px] px-1 py-0.5 rounded truncate border ${cc.light} cursor-pointer`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(s);
                          }}
                        >
                          {s.title}
                        </div>
                      );
                    })}
                    {daySchedules.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        +{daySchedules.length - 3}개
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 목록 뷰 ─────────────────────────────────────────────────────────────────

function ListView({
  schedules,
  onEdit,
  onDelete,
}: {
  schedules: Schedule[];
  onEdit: (s: Schedule) => void;
  onDelete: (s: Schedule) => void;
}) {
  if (schedules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <Calendar className="h-10 w-10 opacity-30" />
        <p className="text-sm">등록된 일정이 없습니다.</p>
      </div>
    );
  }

  // 날짜순 정렬
  const sorted = [...schedules].sort(
    (a, b) => toDateStr(a.startDate).localeCompare(toDateStr(b.startDate))
  );

  return (
    <div className="space-y-2">
      {sorted.map((s) => {
        const cc = getColorClass(s.color);
        const start = toDateStr(s.startDate);
        const end = toDateStr(s.endDate);
        const isSameDay = start === end;
        return (
          <div
            key={s.id}
            className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-card hover:bg-muted/20 transition-colors"
          >
            <div className={`w-1 self-stretch rounded-full ${cc.bg} shrink-0`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm truncate">{s.title}</span>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cc.light}`}>
                  {cc.label}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {isSameDay ? start : `${start} ~ ${end}`}
              </div>
              {s.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onEdit(s)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => onDelete(s)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const params = useParams<{ projectId: string }>();
  const projectId = Number(params.projectId);
  const utils = trpc.useUtils();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [view, setView] = useState<"calendar" | "list">("calendar");

  // 다이얼로그 상태
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Schedule | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);

  // 데이터 쿼리
  const { data: project } = trpc.projects.get.useQuery(
    { id: projectId },
    { enabled: !!projectId }
  );
  const { data: schedules = [], isLoading } = trpc.schedules.list.useQuery(
    { projectId },
    { enabled: !!projectId }
  );

  // Mutations
  const createMut = trpc.schedules.create.useMutation({
    onSuccess: () => {
      utils.schedules.list.invalidate({ projectId });
      toast.success("일정이 등록되었습니다.");
      setShowForm(false);
      setForm(defaultForm);
    },
    onError: () => toast.error("등록에 실패했습니다."),
  });

  const updateMut = trpc.schedules.update.useMutation({
    onSuccess: () => {
      utils.schedules.list.invalidate({ projectId });
      toast.success("일정이 수정되었습니다.");
      setShowForm(false);
      setEditTarget(null);
    },
    onError: () => toast.error("수정에 실패했습니다."),
  });

  const deleteMut = trpc.schedules.delete.useMutation({
    onSuccess: () => {
      utils.schedules.list.invalidate({ projectId });
      toast.success("일정이 삭제되었습니다.");
      setDeleteTarget(null);
    },
    onError: () => toast.error("삭제에 실패했습니다."),
  });

  // 핸들러
  const openCreate = (dateStr?: string) => {
    const d = dateStr ?? new Date().toISOString().slice(0, 10);
    setForm({ ...defaultForm, startDate: d, endDate: d });
    setEditTarget(null);
    setShowForm(true);
  };

  const openEdit = (s: Schedule) => {
    setForm({
      title: s.title,
      description: s.description ?? "",
      startDate: toDateStr(s.startDate),
      endDate: toDateStr(s.endDate),
      color: s.color,
    });
    setEditTarget(s);
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.title.trim()) return toast.error("일정명을 입력해 주세요.");
    if (form.startDate > form.endDate) return toast.error("종료일이 시작일보다 빠릅니다.");
    if (editTarget) {
      updateMut.mutate({ id: editTarget.id, projectId, ...form });
    } else {
      createMut.mutate({ projectId, ...form });
    }
  };

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            일정표
          </h1>
          {project && (
            <p className="text-sm text-muted-foreground mt-0.5">{project.projectName}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as "calendar" | "list")}>
            <TabsList className="h-8">
              <TabsTrigger value="calendar" className="text-xs px-3 h-6">
                <CalendarDays className="h-3.5 w-3.5 mr-1" />
                캘린더
              </TabsTrigger>
              <TabsTrigger value="list" className="text-xs px-3 h-6">
                <List className="h-3.5 w-3.5 mr-1" />
                목록
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button size="sm" className="h-8 gap-1" onClick={() => openCreate()}>
            <Plus className="h-3.5 w-3.5" />
            일정 추가
          </Button>
        </div>
      </div>

      {/* 본문 */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : view === "calendar" ? (
        <CalendarView
          schedules={schedules}
          year={year}
          month={month}
          onPrev={prevMonth}
          onNext={nextMonth}
          onDayClick={openCreate}
          onEdit={openEdit}
        />
      ) : (
        <ListView
          schedules={schedules}
          onEdit={openEdit}
          onDelete={setDeleteTarget}
        />
      )}

      {/* 등록/수정 다이얼로그 */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditTarget(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? "일정 수정" : "일정 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>일정명 *</Label>
              <Input
                placeholder="일정명을 입력하세요"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>시작일 *</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>종료일 *</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  min={form.startDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>색상</Label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setForm({ ...form, color: c.value })}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all ${
                      form.color === c.value
                        ? `${c.light} border-current font-semibold ring-2 ring-offset-1 ring-current`
                        : "border-border text-muted-foreground hover:border-current"
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${c.bg}`} />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>메모</Label>
              <Textarea
                placeholder="일정에 대한 메모를 입력하세요 (선택)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              취소
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? "저장 중..." : editTarget ? "수정 저장" : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>일정 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.title}</strong> 일정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMut.mutate({ id: deleteTarget.id, projectId })}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
