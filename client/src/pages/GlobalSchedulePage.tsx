import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, CalendarDays, ExternalLink, AlertCircle, RefreshCw, Plus, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import ScheduleChatDialog from "@/components/ScheduleChatDialog";

// 색상 옵션 (사업별 일정표와 동일한 색상 세트)
const COLOR_OPTIONS = [
  { value: "blue", label: "파랑", bg: "bg-blue-500", light: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "green", label: "초록", bg: "bg-green-500", light: "bg-green-100 text-green-800 border-green-200" },
  { value: "red", label: "빨강", bg: "bg-red-500", light: "bg-red-100 text-red-800 border-red-200" },
  { value: "orange", label: "주황", bg: "bg-orange-500", light: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "purple", label: "보라", bg: "bg-purple-500", light: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "pink", label: "분홍", bg: "bg-pink-500", light: "bg-pink-100 text-pink-800 border-pink-200" },
];

type FormData = {
  projectId: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  color: string;
};

const makeDefaultForm = (dateStr?: string): FormData => ({
  projectId: "",
  title: "",
  description: "",
  startDate: dateStr ?? new Date().toISOString().slice(0, 10),
  endDate: dateStr ?? new Date().toISOString().slice(0, 10),
  color: "blue",
});

// 사업별 고정 색상 팔레트 (사업 ID → 색상)
const PROJECT_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
  "#6366f1", // indigo
];

function getProjectColor(projectId: number, colorOverride?: string | null) {
  if (colorOverride) return colorOverride;
  return PROJECT_COLORS[projectId % PROJECT_COLORS.length];
}

function formatDate(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MONTH_NAMES = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

type ScheduleItem = {
  id: number;
  projectId: number;
  title: string;
  description?: string | null;
  startDate: Date;
  endDate: Date;
  allDay?: boolean | null;
  color?: string | null;
  projectName: string;
};

// 팝오버 상태 키: "scheduleId-dateKey" 형태로 날짜+일정 단위로 구분
type PopoverKey = string;

function makePopoverKey(scheduleId: number, dateKey: string): PopoverKey {
  return `${scheduleId}-${dateKey}`;
}

export default function GlobalSchedulePage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-indexed
  // 팝오버 상태: 날짜+일정 단위로 관리하여 동일 일정의 여러 셀 동시 오픈 방지
  const [openPopover, setOpenPopover] = useState<PopoverKey | null>(null);
  // 일정 등록 다이얼로그
  const [showForm, setShowForm] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [form, setForm] = useState<FormData>(makeDefaultForm());

  const utils = trpc.useUtils();
  const currentYear = today.getFullYear();

  // 전체 사업 목록 (큰 사업)
  const { data: parentProjects = [] } = trpc.projects.listParents.useQuery({ year: currentYear });

  // 일정 등록 mutation
  const createMut = trpc.schedules.create.useMutation({
    onSuccess: () => {
      utils.schedules.listAll.invalidate({ year, month });
      toast.success("일정이 등록되었습니다.");
      setShowForm(false);
      setForm(makeDefaultForm());
    },
    onError: () => toast.error("등록에 실패했습니다."),
  });

  const openCreate = (dateStr?: string) => {
    setForm(makeDefaultForm(dateStr));
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.projectId) return toast.error("사업을 선택해 주세요.");
    if (!form.title.trim()) return toast.error("일정명을 입력해 주세요.");
    if (form.startDate > form.endDate) return toast.error("종료일이 시작일보다 빠릅니다.");
    createMut.mutate({
      projectId: Number(form.projectId),
      title: form.title,
      description: form.description || undefined,
      startDate: form.startDate,
      endDate: form.endDate,
      color: form.color,
    });
  };

  const { data: schedules = [], isLoading, isError, refetch } = trpc.schedules.listAll.useQuery(
    { year, month },
    { staleTime: 30_000 }
  );

  // 이전/다음 달 이동
  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1); };

  // 달력 날짜 그리드 생성
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startDow = firstDay.getDay(); // 0=일
    const totalDays = lastDay.getDate();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) days.push(new Date(year, month - 1, d));
    // 6주 채우기
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [year, month]);

  // 날짜별 일정 매핑
  const schedulesByDate = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const s of schedules as ScheduleItem[]) {
      const start = new Date(s.startDate);
      const end = new Date(s.endDate);
      // 기간 내 모든 날짜에 추가
      const cur = new Date(start);
      cur.setHours(0, 0, 0, 0);
      const endDay = new Date(end);
      endDay.setHours(0, 0, 0, 0);
      while (cur <= endDay) {
        const key = `${cur.getFullYear()}-${cur.getMonth() + 1}-${cur.getDate()}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(s);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [schedules]);

  // 사업별 범례
  const projectLegend = useMemo(() => {
    const seen = new Map<number, { name: string; color: string }>();
    for (const s of schedules as ScheduleItem[]) {
      if (!seen.has(s.projectId)) {
        seen.set(s.projectId, {
          name: s.projectName,
          color: getProjectColor(s.projectId, s.color),
        });
      }
    }
    return Array.from(seen.values());
  }, [schedules]);

  const isToday = (date: Date | null) => {
    if (!date) return false;
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  const getDateKey = (date: Date) =>
    `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-primary" />
            스케줄 관리
          </h1>
          <p className="text-sm text-muted-foreground mt-1">전체 사업 일정을 한눈에 확인하세요</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>오늘</Button>
          <Button size="sm" onClick={() => setChatOpen(true)} className="gap-1.5">
            <MessageSquareText className="w-4 h-4" />
            대화로 일정 추가
          </Button>
          <Button size="sm" variant="outline" onClick={() => openCreate()} className="gap-1.5">
            <Plus className="w-4 h-4" />
            직접 입력
          </Button>
        </div>
      </div>

      {/* 월 탐색 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={prevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <CardTitle className="text-lg font-semibold">
              {year}년 {MONTH_NAMES[month - 1]}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 border-b">
            {WEEKDAYS.map((day, i) => (
              <div
                key={day}
                className={`py-2 text-center text-xs font-medium ${
                  i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-muted-foreground"
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* 로딩 상태 */}
          {isLoading && (
            <div className="h-96 flex items-center justify-center text-muted-foreground text-sm">
              일정을 불러오는 중...
            </div>
          )}

          {/* 에러 상태 */}
          {isError && !isLoading && (
            <div className="h-96 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <AlertCircle className="w-8 h-8 text-destructive" />
              <p className="text-sm">일정을 불러오지 못했습니다.</p>
              <button
                onClick={() => refetch()}
                className="flex items-center gap-1.5 text-xs border border-border rounded-md px-3 py-1.5 hover:bg-muted/50 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                다시 시도
              </button>
            </div>
          )}

          {/* 날짜 그리드 */}
          {!isLoading && !isError && (
            <div className="grid grid-cols-7">
              {calendarDays.map((date, idx) => {
                const key = date ? getDateKey(date) : `empty-${idx}`;
                const daySchedules = date ? (schedulesByDate.get(getDateKey(date)) ?? []) : [];
                const todayCell = isToday(date);
                const dow = idx % 7;

                return (
                  <div
                    key={key}
                    className={`min-h-[100px] border-b border-r p-1 ${
                      !date ? "bg-muted/20" : "bg-background hover:bg-muted/10 transition-colors cursor-pointer"
                    } ${idx % 7 === 6 ? "border-r-0" : ""}`}
                    onClick={(e) => {
                      // 일정 버튼/팝오버 클릭은 제외하고 날짜 셀 클릭 시 다이얼로그 열기
                      if (!date) return;
                      const target = e.target as HTMLElement;
                      if (target.closest('button') || target.closest('[data-radix-popper-content-wrapper]')) return;
                      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                      openCreate(dateStr);
                    }}
                  >
                    {date && (
                      <>
                        {/* 날짜 숫자 */}
                        <div className="flex justify-end mb-1">
                          <span
                            className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                              todayCell
                                ? "bg-primary text-primary-foreground"
                                : dow === 0
                                ? "text-red-500"
                                : dow === 6
                                ? "text-blue-500"
                                : "text-foreground"
                            }`}
                          >
                            {date.getDate()}
                          </span>
                        </div>

                        {/* 일정 목록 (최대 3개, 나머지 +N) */}
                        <div className="space-y-0.5">
                          {daySchedules.slice(0, 3).map((s) => {
                            const color = getProjectColor(s.projectId, s.color);
                            const cellDateKey = getDateKey(date);
                            const popoverKey = makePopoverKey(s.id, cellDateKey);
                            const isOpen = openPopover === popoverKey;
                            return (
                              <Popover
                                key={popoverKey}
                                open={isOpen}
                                onOpenChange={(open) => {
                                  setOpenPopover(open ? popoverKey : null);
                                }}
                              >
                                <PopoverTrigger asChild>
                                  <button
                                    className="w-full text-left rounded px-1 py-0.5 text-[11px] font-medium truncate transition-opacity hover:opacity-80"
                                    style={{ backgroundColor: color + "22", color }}
                                  >
                                    {s.title}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72 p-3" side="top" align="start">
                                  <div className="space-y-2">
                                    <div className="flex items-start gap-2">
                                      <div
                                        className="w-3 h-3 rounded-full mt-0.5 shrink-0"
                                        style={{ backgroundColor: color }}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm leading-tight">{s.title}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">{s.projectName}</p>
                                      </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground space-y-1">
                                      <p>
                                        {formatDate(new Date(s.startDate))}
                                        {new Date(s.startDate).toDateString() !== new Date(s.endDate).toDateString() &&
                                          ` ~ ${formatDate(new Date(s.endDate))}`}
                                      </p>
                                      {s.description && (
                                        <p className="text-foreground/70 whitespace-pre-wrap">{s.description}</p>
                                      )}
                                    </div>
                                    {s.projectId !== 0 && (
                                    <Link
                                      href={`/schedule/${s.projectId}`}
                                      className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                                      onClick={() => setOpenPopover(null)}
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      사업 일정표로 이동
                                    </Link>
                                    )}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            );
                          })}
                          {daySchedules.length > 3 && (
                            <p className="text-[10px] text-muted-foreground px-1">
                              +{daySchedules.length - 3}개 더
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 사업별 범례 */}
      {!isLoading && !isError && projectLegend.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">사업별 범례</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {projectLegend.map((p) => (
                <Badge
                  key={p.name}
                  variant="outline"
                  className="gap-1.5 text-xs"
                  style={{ borderColor: p.color, color: p.color }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  {p.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 이번 달 일정 목록 */}
      {!isLoading && !isError && (<Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            {year}년 {MONTH_NAMES[month - 1]} 전체 일정
            <span className="ml-2 text-muted-foreground font-normal">
              ({(schedules as ScheduleItem[]).length}건)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(schedules as ScheduleItem[]).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">이 달에 등록된 일정이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {(schedules as ScheduleItem[])
                .slice()
                .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                .map((s) => {
                  const color = getProjectColor(s.projectId, s.color);
                  const start = new Date(s.startDate);
                  const end = new Date(s.endDate);
                  const isMultiDay = start.toDateString() !== end.toDateString();
                  return (
                    <div key={s.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.projectName} · {formatDate(start)}
                          {isMultiDay && ` ~ ${formatDate(end)}`}
                        </p>
                        {s.description && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{s.description}</p>
                        )}
                      </div>
                      {s.projectId !== 0 && (
                      <Link href={`/schedule/${s.projectId}`}>
                        <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>)}

      {/* 일정 등록 다이얼로그 */}
      <ScheduleChatDialog open={chatOpen} onOpenChange={setChatOpen} onDone={() => utils.schedules.invalidate()} />
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setForm(makeDefaultForm()); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>일정 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* 사업 선택 */}
            <div className="space-y-1.5">
              <Label>사업 *</Label>
              <Select
                value={form.projectId}
                onValueChange={(v) => setForm({ ...form, projectId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="사업 또는 개인 업무 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">개인 업무 (사업 없음)</SelectItem>
                  {(parentProjects as Array<{ id: number; projectName: string }>).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.projectName}
                    </SelectItem>
                  ))}
                  {parentProjects.length === 0 && (
                    <SelectItem value="_none" disabled>
                      등록된 사업이 없습니다
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            {/* 일정명 */}
            <div className="space-y-1.5">
              <Label>일정명 *</Label>
              <Input
                placeholder="일정명을 입력하세요"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            {/* 날짜 */}
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
            {/* 색상 */}
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
            {/* 메모 */}
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
            <Button onClick={handleSubmit} disabled={createMut.isPending}>
              {createMut.isPending ? "저장 중..." : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
