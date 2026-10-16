import QuickStart from "@/components/QuickStart";
import { Fragment, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ExternalLink, Plus, BookOpen, Wallet, CalendarDays } from "lucide-react";

const currentYear = new Date().getFullYear();

/** 달성률 배지 */
function AchievementBadge({ value, planned, isAdHoc = false }: { value: number; planned: number; isAdHoc?: boolean }) {
  if (isAdHoc) return <span className="text-xs text-indigo-500 font-medium">수시</span>;
  if (planned === 0) return <span className="text-slate-300 text-xs">-</span>;
  const pct = Math.round((value / planned) * 100);
  const color =
    pct >= 100
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : pct >= 70
        ? "bg-amber-100 text-amber-700 border-amber-200"
        : "bg-rose-100 text-rose-700 border-rose-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${color}`}>
      {pct}%
    </span>
  );
}

/** 계획값 셀 */
function PlannedCell({ value, isAdHoc = false, bold = false, bg = "" }: { value: number; isAdHoc?: boolean; bold?: boolean; bg?: string }) {
  return (
    <td className={`border border-slate-200 px-2 py-1.5 text-center text-sm ${bold ? "font-bold" : ""} text-slate-600 ${bg}`}>
      {isAdHoc
        ? <span className="text-xs font-semibold text-indigo-500">수시</span>
        : value > 0
          ? value.toLocaleString()
          : <span className="text-slate-300">-</span>}
    </td>
  );
}

/** 실적값 셀 */
function ActualCell({ value, planned, isAdHoc = false, bold = false, bg = "" }: { value: number; planned: number; isAdHoc?: boolean; bold?: boolean; bg?: string }) {
  const isOver = !isAdHoc && planned > 0 && value > planned;
  return (
    <td className={`border border-slate-200 px-2 py-1.5 text-center text-sm ${bold ? "font-bold" : ""} ${isOver ? "text-rose-600 font-bold" : "text-slate-700"} ${bg}`}>
      {value > 0 ? value.toLocaleString() : <span className="text-slate-300">0</span>}
    </td>
  );
}

// 분기 레이블
const QUARTER_LABELS: Record<number, string> = {
  1: "1분기 (1~3월)",
  2: "2분기 (4~6월)",
  3: "3분기 (7~9월)",
  4: "4분기 (10~12월)",
};
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

export default function Dashboard() {
  const [year, setYear] = useState(currentYear);
  const [quarter, setQuarter] = useState<number | undefined>(undefined); // undefined = 연간 전체
  const [isCustomPeriod, setIsCustomPeriod] = useState(false);
  const [customStartMonth, setCustomStartMonth] = useState(1);
  const [customEndMonth, setCustomEndMonth] = useState(6);
  const [, setLocation] = useLocation();

  const customPeriodValid = customStartMonth <= customEndMonth;
  const overviewInput = useMemo(() => ({
    year,
    ...(isCustomPeriod
      ? { customStartMonth, customEndMonth }
      : { quarter }),
  }), [year, quarter, isCustomPeriod, customStartMonth, customEndMonth]);
  const { data: overview, isLoading } = trpc.performance.dashboardOverviewByQuarter.useQuery(
    overviewInput,
    { enabled: !isCustomPeriod || customPeriodValid }
  );
  const { data: budgetData, isLoading: isBudgetLoading } = trpc.performance.dashboardBudget.useQuery({ year });
  const { data: upcomingSchedules = [], isLoading: isScheduleLoading } = trpc.schedules.upcoming.useQuery({ daysAhead: 14 });

  const periodLabel = isCustomPeriod
    ? `${customStartMonth}~${customEndMonth}월`
    : quarter
      ? QUARTER_LABELS[quarter]
      : `${year}년 연간 전체`;

  const totalParents = overview?.length ?? 0;
  const totalSubs = overview?.reduce((acc, p) => acc + p.subs.length, 0) ?? 0;
  const totalActualPeople = overview?.reduce((acc, p) => acc + p.subtotal.actualPeople, 0) ?? 0;
  const totalActualCount = overview?.reduce((acc, p) => acc + p.subtotal.actualCount, 0) ?? 0;
  const totalPlannedPeople = overview?.reduce((acc, p) => acc + p.subtotal.plannedPeople, 0) ?? 0;

  return (
    <div className="p-6 space-y-5">
      <QuickStart />
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">종합 실적 현황</h1>
          <p className="text-sm text-muted-foreground mt-0.5">모든 사업의 계획 대비 실적을 한눈에 확인합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={() => setLocation("/projects")}>
            <Plus className="h-4 w-4 mr-1.5" />사업 등록
          </Button>
          {/* 연도 선택 */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 shadow-sm">
            <button onClick={() => setYear((y) => y - 1)} className="p-0.5 rounded hover:bg-slate-100 transition-colors">
              <ChevronLeft className="w-4 h-4 text-slate-500" />
            </button>
            <span className="text-sm font-semibold text-slate-700 w-14 text-center">{year}년</span>
            <button onClick={() => setYear((y) => y + 1)} className="p-0.5 rounded hover:bg-slate-100 transition-colors">
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
            <p className="text-xs text-muted-foreground font-medium">등록 사업</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{totalParents}개</p>
            <p className="text-xs text-muted-foreground mt-0.5">세부 사업 {totalSubs}개</p>
          </div>

          {/* 총 실인원 + 큰 사업별 세분 */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
            <p className="text-xs text-muted-foreground font-medium">총 실인원</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{totalActualPeople.toLocaleString()}명</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isCustomPeriod ? "선택 기간 누적 고유 참여자" : quarter ? `Q${quarter} 누적 고유 참여자` : "연간 누적 고유 참여자"}
            </p>
            {totalPlannedPeople > 0 && (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.min(100, Math.round((totalActualPeople / totalPlannedPeople) * 100))}%` }}
                  />
                </div>
                <span className="text-[11px] font-bold text-emerald-600 shrink-0">
                  {Math.round((totalActualPeople / totalPlannedPeople) * 100)}%
                </span>
              </div>
            )}
            {overview && overview.length > 0 && (
              <div className="mt-2 space-y-0.5 border-t border-slate-100 pt-2">
                {overview.map((parent) => (
                  <div key={parent.parentId} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground truncate max-w-[120px]" title={parent.parentName}>
                      {parent.parentName}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-600 shrink-0">
                      {parent.subtotal.actualPeople.toLocaleString()}명
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
            <p className="text-xs text-muted-foreground font-medium">조회 기준</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{isCustomPeriod ? `${customStartMonth}~${customEndMonth}월` : quarter ? `Q${quarter}` : `${year}년`}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isCustomPeriod ? `${year}년 선택 기간` : quarter ? `${year}년 ${QUARTER_LABELS[quarter]}` : "연간 전체 누적"}
            </p>
            {quarter && !isCustomPeriod && (
              <p className="text-[11px] text-indigo-500 mt-1 font-medium">
                연간 전체 보기: 탭에서 "연간" 선택
              </p>
            )}
          </div>
      </div>

      {/* 종합현황 표 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">사업별 실적 종합현황</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {periodLabel} · 실인원은 선택 기간 내 누적 고유 참여자 기준
            </p>
          </div>
          {/* 기간 필터 탭 */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
            {([undefined, 1, 2, 3, 4] as (number | undefined)[]).map((q) => (
              <button
                key={q ?? 0}
                onClick={() => { setIsCustomPeriod(false); setQuarter(q); }}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  !isCustomPeriod && quarter === q
                    ? "bg-white text-slate-800 shadow-sm font-semibold"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {q === undefined ? "연간" : `Q${q}`}
              </button>
            ))}
            <button
              onClick={() => setIsCustomPeriod(true)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                isCustomPeriod ? "bg-white text-slate-800 shadow-sm font-semibold" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              사용자 지정
            </button>
          </div>
        </div>

        {isCustomPeriod && (
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2 flex-wrap bg-indigo-50/30">
            <span className="text-xs font-medium text-slate-600">조회 월</span>
            <select
              value={customStartMonth}
              onChange={(e) => {
                const month = Number(e.target.value);
                setCustomStartMonth(month);
                if (month > customEndMonth) setCustomEndMonth(month);
              }}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
              aria-label="조회 시작월"
            >
              {MONTH_OPTIONS.map((month) => <option key={month} value={month}>{month}월</option>)}
            </select>
            <span className="text-xs text-slate-500">~</span>
            <select
              value={customEndMonth}
              onChange={(e) => setCustomEndMonth(Number(e.target.value))}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
              aria-label="조회 종료월"
            >
              {MONTH_OPTIONS.filter((month) => month >= customStartMonth).map((month) => <option key={month} value={month}>{month}월</option>)}
            </select>
            <span className="text-xs text-muted-foreground">선택 기간 실적만 표시됩니다.</span>
          </div>
        )}

        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : !overview || overview.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-slate-400 text-sm">등록된 사업이 없습니다.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setLocation("/projects")}>
              사업 등록하기
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th rowSpan={2} className="border border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-600 bg-slate-50 w-28 align-middle">사업명</th>
                  <th rowSpan={2} className="border border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-600 bg-slate-50 w-40 align-middle">세부 사업명</th>
                  <th colSpan={3} className="border border-slate-200 px-2 py-2 text-center text-xs font-semibold text-blue-700 bg-blue-50">계획</th>
                  <th colSpan={5} className="border border-slate-200 px-2 py-2 text-center text-xs font-semibold text-rose-700 bg-rose-50">실적</th>
                  <th rowSpan={2} className="border border-slate-200 px-2 py-2 text-center text-xs font-semibold text-slate-600 bg-slate-50 w-14 align-middle">달성률</th>
                  <th rowSpan={2} className="border border-slate-200 px-2 py-2 text-center text-xs font-semibold text-slate-600 bg-slate-50 w-12 align-middle">이동</th>
                </tr>
                <tr>
                  <th className="border border-slate-200 px-2 py-1.5 text-center text-[11px] font-medium text-blue-600 bg-blue-50/60">실인원</th>
                  <th className="border border-slate-200 px-2 py-1.5 text-center text-[11px] font-medium text-blue-600 bg-blue-50/60">연인원</th>
                  <th className="border border-slate-200 px-2 py-1.5 text-center text-[11px] font-medium text-blue-600 bg-blue-50/60">횟수</th>
                  <th className="border border-slate-200 px-2 py-1.5 text-center text-[11px] font-medium text-rose-600 bg-rose-50/60">실인원</th>
                  <th className="border border-slate-200 px-2 py-1.5 text-center text-[11px] font-medium text-rose-600 bg-rose-50/60">연인원</th>
                  <th className="border border-slate-200 px-2 py-1.5 text-center text-[11px] font-medium text-rose-600 bg-rose-50/60">횟수</th>
                  <th className="border border-slate-200 px-2 py-1.5 text-center text-[11px] font-medium text-rose-600 bg-rose-50/60">남</th>
                  <th className="border border-slate-200 px-2 py-1.5 text-center text-[11px] font-medium text-rose-600 bg-rose-50/60">여</th>
                </tr>
              </thead>
              <tbody>
                {overview.map((parent) => {
                  const subCount = parent.subs.length;
                  const rowSpan = subCount > 0 ? subCount + 1 : 1; // 세부 사업 행 + 소계 행

                  if (subCount === 0) {
                    return (
                      <tr key={`parent-${parent.parentId}-empty`} className="hover:bg-slate-50/40">
                        <td className="border border-slate-200 px-3 py-2 text-center text-sm font-semibold text-slate-700 bg-pink-50/50 align-middle">
                          {parent.parentName}
                        </td>
                        <td className="border border-slate-200 px-3 py-2 text-center text-xs text-slate-400">세부 사업 없음</td>
                        <PlannedCell value={0} />
                        <PlannedCell value={0} />
                        <PlannedCell value={0} />
                        <ActualCell value={0} planned={0} />
                        <ActualCell value={0} planned={0} />
                        <ActualCell value={0} planned={0} />
                        <ActualCell value={0} planned={0} />
                        <ActualCell value={0} planned={0} />
                        <td className="border border-slate-200 px-2 py-1.5 text-center">-</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-center">
                          <Link href={`/projects`}>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-500 transition-colors mx-auto" />
                          </Link>
                        </td>
                      </tr>
                    );
                  }

                  return parent.subs.map((sub, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === subCount - 1;

                    return (
                      <Fragment key={`frag-${sub.id}`}>
                        <tr key={`sub-${sub.id}`} className="hover:bg-slate-50/40 transition-colors">
                          {/* 큰 사업명: 첫 번째 행에만 표시, rowSpan으로 세부 사업 + 소계 행 병합 */}
                          {isFirst && (
                            <td
                              rowSpan={rowSpan}
                              className="border border-slate-200 px-3 py-2 text-center text-sm font-bold text-slate-700 bg-pink-50/50 align-middle"
                            >
                              {parent.parentName}
                            </td>
                          )}
                          <td className="border border-slate-200 px-3 py-1.5 text-sm text-slate-600">{sub.name}</td>
                          {/* 계획 */}
                          <PlannedCell value={sub.plannedPeople} bg="bg-blue-50/20" />
                          <PlannedCell value={sub.plannedExtended} bg="bg-blue-50/20" />
                          <PlannedCell value={sub.plannedCount} isAdHoc={sub.isAdHoc} bg="bg-blue-50/20" />
                          {/* 실적 */}
                          <ActualCell value={sub.actualPeople} planned={sub.plannedPeople} bg="bg-rose-50/20" />
                          <ActualCell value={sub.actualExtended} planned={sub.plannedExtended} bg="bg-rose-50/20" />
                          <ActualCell value={sub.actualCount} planned={sub.isAdHoc ? 0 : sub.plannedCount} isAdHoc={sub.isAdHoc} bg="bg-rose-50/20" />
                          <ActualCell value={sub.malePeople} planned={0} bg="bg-rose-50/20" />
                          <ActualCell value={sub.femalePeople} planned={0} bg="bg-rose-50/20" />
                          {/* 달성률 */}
                          <td className="border border-slate-200 px-2 py-1.5 text-center">
                            <AchievementBadge value={sub.actualPeople} planned={sub.plannedPeople} isAdHoc={sub.isAdHoc} />
                          </td>
                          {/* 이동 */}
                          <td className="border border-slate-200 px-2 py-1.5 text-center">
                            <Link href={`/performance/${sub.id}`}>
                              <ExternalLink className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-500 transition-colors mx-auto" />
                            </Link>
                          </td>
                        </tr>
                        {/* 마지막 세부 사업 다음에 소계 행 삽입 */}
                        {isLast && (
                          <tr key={`subtotal-${parent.parentId}`} className="bg-slate-100/80">
                            <td className="border border-slate-200 px-3 py-2 text-center text-xs font-bold text-slate-600">소계</td>
                            <PlannedCell value={parent.subtotal.plannedPeople} bold bg="bg-blue-50/30" />
                            <PlannedCell value={parent.subtotal.plannedExtended} bold bg="bg-blue-50/30" />
                            <PlannedCell value={parent.subtotal.plannedCount} bold bg="bg-blue-50/30" />
                            <ActualCell value={parent.subtotal.actualPeople} planned={parent.subtotal.plannedPeople} bold bg="bg-rose-50/30" />
                            <ActualCell value={parent.subtotal.actualExtended} planned={parent.subtotal.plannedExtended} bold bg="bg-rose-50/30" />
                            <ActualCell value={parent.subtotal.actualCount} planned={parent.subtotal.plannedCount} bold bg="bg-rose-50/30" />
                            <ActualCell value={parent.subtotal.malePeople} planned={0} bold bg="bg-rose-50/30" />
                            <ActualCell value={parent.subtotal.femalePeople} planned={0} bold bg="bg-rose-50/30" />
                            <td className="border border-slate-200 px-2 py-1.5 text-center">
                              <AchievementBadge value={parent.subtotal.actualPeople} planned={parent.subtotal.plannedPeople} />
                            </td>
                            <td className="border border-slate-200 px-2 py-1.5 text-center text-xs text-slate-400">-</td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 예산 현황 섹션 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700">사업별 예산 현황</h2>
          </div>
          <span className="text-xs text-muted-foreground">{year}년 기준 · 큰 사업 단위</span>
        </div>

        {isBudgetLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : !budgetData || budgetData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Wallet className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-slate-400 text-sm">등록된 사업이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="border border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-600 w-40">사업명</th>
                  <th className="border border-slate-200 px-3 py-2 text-center text-xs font-semibold text-blue-700 bg-blue-50">총 예산</th>
                  <th className="border border-slate-200 px-2 py-2 text-center text-xs font-semibold text-blue-600 bg-blue-50/60">1분기</th>
                  <th className="border border-slate-200 px-2 py-2 text-center text-xs font-semibold text-blue-600 bg-blue-50/60">2분기</th>
                  <th className="border border-slate-200 px-2 py-2 text-center text-xs font-semibold text-blue-600 bg-blue-50/60">3분기</th>
                  <th className="border border-slate-200 px-2 py-2 text-center text-xs font-semibold text-blue-600 bg-blue-50/60">4분기</th>
                  <th className="border border-slate-200 px-3 py-2 text-center text-xs font-semibold text-rose-700 bg-rose-50">집행액</th>
                  <th className="border border-slate-200 px-3 py-2 text-center text-xs font-semibold text-emerald-700 bg-emerald-50">잔액</th>
                  <th className="border border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-600">집행률</th>
                  <th className="border border-slate-200 px-2 py-2 text-center text-xs font-semibold text-slate-600 w-12">이동</th>
                </tr>
              </thead>
              <tbody>
                {budgetData.map((row) => {
                  const usageColor =
                    row.usageRate >= 100
                      ? "bg-rose-100 text-rose-700 border-rose-200"
                      : row.usageRate >= 80
                        ? "bg-amber-100 text-amber-700 border-amber-200"
                        : "bg-emerald-100 text-emerald-700 border-emerald-200";
                  const remainingColor = row.remaining < 0 ? "text-rose-600 font-bold" : "text-emerald-700";
                  const fmt = (v: number) => v > 0 ? v.toLocaleString() : <span className="text-slate-300">-</span>;
                  return (
                    <tr key={row.parentId} className="hover:bg-slate-50/40 transition-colors">
                      <td className="border border-slate-200 px-3 py-2 text-center text-sm font-semibold text-slate-700 bg-pink-50/50">
                        {row.parentName}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-center text-sm font-bold text-blue-700 bg-blue-50/20">
                        {row.totalBudget > 0 ? row.totalBudget.toLocaleString() : <span className="text-slate-300">미설정</span>}
                      </td>
                      <td className="border border-slate-200 px-2 py-2 text-center text-sm text-slate-600 bg-blue-50/10">{fmt(row.q1Budget)}</td>
                      <td className="border border-slate-200 px-2 py-2 text-center text-sm text-slate-600 bg-blue-50/10">{fmt(row.q2Budget)}</td>
                      <td className="border border-slate-200 px-2 py-2 text-center text-sm text-slate-600 bg-blue-50/10">{fmt(row.q3Budget)}</td>
                      <td className="border border-slate-200 px-2 py-2 text-center text-sm text-slate-600 bg-blue-50/10">{fmt(row.q4Budget)}</td>
                      <td className="border border-slate-200 px-3 py-2 text-center text-sm font-semibold text-rose-600 bg-rose-50/20">
                        {row.spent > 0 ? row.spent.toLocaleString() : <span className="text-slate-300">0</span>}
                      </td>
                      <td className={`border border-slate-200 px-3 py-2 text-center text-sm font-semibold bg-emerald-50/20 ${remainingColor}`}>
                        {row.remaining !== 0 || row.totalBudget > 0 ? row.remaining.toLocaleString() : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-center">
                        {row.totalBudget > 0 ? (
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${usageColor}`}>
                            {row.usageRate}%
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">-</span>
                        )}
                      </td>
                      <td className="border border-slate-200 px-2 py-2 text-center">
                        <Link href={`/budget/${row.parentId}`}>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-500 transition-colors mx-auto" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 다가오는 일정 위젯 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-slate-700">다가오는 일정</h2>
          </div>
          <span className="text-xs text-muted-foreground">오늘로부터 14일 이내</span>
        </div>
        {isScheduleLoading ? (
          <div className="px-5 py-4 space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}
          </div>
        ) : upcomingSchedules.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            <CalendarDays className="w-8 h-8 mx-auto mb-2 text-slate-200" />
            14일 이내 예정된 일정이 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {upcomingSchedules.map((s) => {
              const start = new Date(s.startDate);
              const end = new Date(s.endDate);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const startDay = new Date(start); startDay.setHours(0, 0, 0, 0);
              const diffDays = Math.round((startDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              const isOngoing = diffDays < 0; // 이미 시작된 진행 중 일정
              const dLabel = isOngoing ? "진행중" : diffDays === 0 ? "오늘" : diffDays === 1 ? "내일" : `D-${diffDays}`;
              const dColor = isOngoing ? "text-indigo-600 font-semibold" : diffDays === 0 ? "text-rose-600 font-bold" : diffDays <= 3 ? "text-amber-600 font-semibold" : "text-slate-500";
              const colorMap: Record<string, string> = {
                blue: "bg-blue-400", green: "bg-emerald-400", red: "bg-rose-400",
                orange: "bg-orange-400", purple: "bg-violet-400", pink: "bg-pink-400",
              };
              const dotColor = colorMap[s.color ?? "blue"] ?? "bg-blue-400";
              return (
                <div key={s.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{s.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.projectName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs ${dColor}`}>{dLabel}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {s.allDay ? start.toLocaleDateString("ko-KR", { month: "short", day: "numeric" }) : start.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400"></span>달성률 100% 이상
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400"></span>달성률 70~99%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-400"></span>달성률 70% 미만
        </span>
        <span className="flex items-center gap-1.5 text-rose-600 font-medium">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-200 border border-rose-400"></span>실적이 계획 초과 시 빨간색 표시
        </span>
      </div>
    </div>
  );
}
