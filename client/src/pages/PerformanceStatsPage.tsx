import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, TrendingUp, Users, Hash, BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

const currentYear = new Date().getFullYear();

const MONTH_LABELS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

export default function PerformanceStatsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = parseInt(params.projectId ?? "0");
  const [, setLocation] = useLocation();
  const [year, setYear] = useState(currentYear);

  const { data: project } = trpc.projects.get.useQuery({ id: projectId });
  const { data: monthlyStats = [], isLoading } = trpc.performance.monthlyStats.useQuery({ projectId, year });

  // Build full 12-month table with cumulative values
  const fullMonthData = useMemo(() => {
    // 누적 연인원/횟수는 단순 합산
    // 누적 실인원은 서버에서 cumulativeUniquePeople로 제공
    let cumExtended = 0;
    let cumCount = 0;

    return MONTH_LABELS.map((label, idx) => {
      const month = idx + 1;
      const stat = monthlyStats.find((s) => s.month === month);
      if (stat) {
        cumExtended += stat.extendedPeople;
        cumCount += stat.count;
      }
      // 누적 실인원: 서버에서 제공하는 cumulativeUniquePeople 사용
      // (stat이 없는 달은 이전 달의 누적값 유지)
      const prevStat = [...monthlyStats].filter((s) => s.month <= month).sort((a, b) => b.month - a.month)[0];
      const cumPeople = prevStat?.cumulativeUniquePeople ?? 0;
      const cumMale = prevStat?.cumulativeMalePeople ?? 0;
      const cumFemale = prevStat?.cumulativeFemalePeople ?? 0;

      return {
        label,
        month,
        monthPeople: stat?.uniquePeople ?? 0,
        monthExtended: stat?.extendedPeople ?? 0,
        monthCount: stat?.count ?? 0,
        monthMale: stat?.malePeople ?? 0,
        monthFemale: stat?.femalePeople ?? 0,
        cumPeople,
        cumExtended,
        cumCount,
        cumMale,
        cumFemale,
        hasData: !!stat,
      };
    });
  }, [monthlyStats]);

  // Total actuals (cumulative to current month)
  const currentMonth = new Date().getMonth() + 1;
  const latestData = fullMonthData.filter((d) => d.month <= currentMonth && d.hasData);
  const totalPeople = latestData.length > 0 ? latestData[latestData.length - 1].cumPeople : 0;
  const totalExtended = latestData.length > 0 ? latestData[latestData.length - 1].cumExtended : 0;
  const totalCount = latestData.length > 0 ? latestData[latestData.length - 1].cumCount : 0;
  const totalMale = latestData.length > 0 ? latestData[latestData.length - 1].cumMale : 0;
  const totalFemale = latestData.length > 0 ? latestData[latestData.length - 1].cumFemale : 0;

  const plannedPeople = project?.plannedPeople ?? 0;
  const plannedExtended = project?.plannedExtended ?? 0;
  const plannedCount = project?.plannedCount ?? 0;

  const rateP = plannedPeople > 0 ? Math.min(Math.round((totalPeople / plannedPeople) * 100), 999) : null;
  const rateE = plannedExtended > 0 ? Math.min(Math.round((totalExtended / plannedExtended) * 100), 999) : null;
  const rateC = plannedCount > 0 ? Math.min(Math.round((totalCount / plannedCount) * 100), 999) : null;

  // Chart data - monthly values (not cumulative) for bar chart
  const chartData = fullMonthData.map((d) => ({
    name: d.label,
    실인원: d.monthPeople,
    연인원: d.monthExtended,
    횟수: d.monthCount,
    남성: d.monthMale,
    여성: d.monthFemale,
  }));

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setLocation("/projects")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-[12rem]">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">실적 현황</h1>
          {project && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {project.projectName}{project.subProjectName ? ` · ${project.subProjectName}` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setYear((y) => y - 1)}>‹</Button>
          <span className="text-sm font-medium w-12 text-center">{year}년</span>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setYear((y) => y + 1)}>›</Button>
        </div>
      </div>

      {/* Achievement Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <AchievementCard
          label="실인원"
          actual={totalPeople}
          planned={plannedPeople}
          rate={rateP}
          unit="명"
          icon={<Users className="h-4 w-4" />}
          color="text-primary"
          bgColor="bg-primary/8"
          subInfo={totalPeople > 0 ? `남 ${totalMale}명 · 여 ${totalFemale}명` : undefined}
        />
        <AchievementCard
          label="연인원"
          actual={totalExtended}
          planned={plannedExtended}
          rate={rateE}
          unit="명"
          icon={<TrendingUp className="h-4 w-4" />}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
        />
        <AchievementCard
          label="횟수"
          actual={totalCount}
          planned={project?.isAdHoc ? null : plannedCount}
          rate={project?.isAdHoc ? null : rateC}
          unit="회"
          icon={<Hash className="h-4 w-4" />}
          color="text-amber-600"
          bgColor="bg-amber-50"
          isAdHoc={project?.isAdHoc}
        />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : (
        <>
          {/* Monthly Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                월별 실적 현황
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Bar dataKey="실인원" fill="oklch(0.52 0.18 255)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="연인원" fill="oklch(0.62 0.15 180)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="횟수" fill="oklch(0.65 0.16 60)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gender Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                남녀 구분 실인원
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Bar dataKey="남성" fill="oklch(0.55 0.18 240)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="여성" fill="oklch(0.62 0.18 10)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Monthly Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">월별 누적 실적 상세</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">월</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">실인원(월)</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">남(월)</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">여(월)</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">연인원(월)</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">횟수(월)</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs border-l">누적 실인원</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">누적 연인원</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">누적 횟수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fullMonthData.map((row) => (
                      <tr
                        key={row.month}
                        className={`border-b last:border-0 transition-colors ${row.hasData ? "hover:bg-muted/20" : "text-muted-foreground/50"}`}
                      >
                        <td className="px-4 py-3 font-medium text-xs">{row.label}</td>
                        <td className="px-4 py-3 text-right text-xs">{row.hasData ? row.monthPeople : "-"}</td>
                        <td className="px-4 py-3 text-right text-xs text-blue-600">{row.hasData ? row.monthMale : "-"}</td>
                        <td className="px-4 py-3 text-right text-xs text-rose-500">{row.hasData ? row.monthFemale : "-"}</td>
                        <td className="px-4 py-3 text-right text-xs">{row.hasData ? row.monthExtended : "-"}</td>
                        <td className="px-4 py-3 text-right text-xs">{row.hasData ? row.monthCount : "-"}</td>
                        <td className="px-4 py-3 text-right text-xs font-medium border-l">{row.cumPeople > 0 ? row.cumPeople : "-"}</td>
                        <td className="px-4 py-3 text-right text-xs font-medium">{row.cumExtended > 0 ? row.cumExtended : "-"}</td>
                        <td className="px-4 py-3 text-right text-xs font-medium">{row.cumCount > 0 ? row.cumCount : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/40 font-semibold">
                      <td className="px-4 py-3 text-xs">합계</td>
                      <td className="px-4 py-3 text-right text-xs">{totalPeople}</td>
                      <td className="px-4 py-3 text-right text-xs text-blue-600">{totalMale}</td>
                      <td className="px-4 py-3 text-right text-xs text-rose-500">{totalFemale}</td>
                      <td className="px-4 py-3 text-right text-xs">{totalExtended}</td>
                      <td className="px-4 py-3 text-right text-xs">{totalCount}</td>
                      <td className="px-4 py-3 text-right text-xs border-l">{totalPeople}</td>
                      <td className="px-4 py-3 text-right text-xs">{totalExtended}</td>
                      <td className="px-4 py-3 text-right text-xs">{totalCount}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function AchievementCard({
  label,
  actual,
  planned,
  rate,
  unit,
  icon,
  color,
  bgColor,
  subInfo,
  isAdHoc,
}: {
  label: string;
  actual: number;
  planned: number | null;
  rate: number | null;
  unit: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  subInfo?: string;
  isAdHoc?: boolean;
}) {
  const progressValue = rate !== null ? Math.min(rate, 100) : 0;
  const rateColor = rate !== null
    ? rate >= 100 ? "text-emerald-600" : rate >= 70 ? "text-amber-600" : "text-foreground"
    : "text-muted-foreground";

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg ${bgColor} flex items-center justify-center ${color}`}>
              {icon}
            </div>
            <span className="text-sm font-medium text-foreground">{label}</span>
          </div>
          {isAdHoc ? (
            <Badge variant="secondary" className="text-xs">수시</Badge>
          ) : rate !== null ? (
            <span className={`text-lg font-bold ${rateColor}`}>{rate}%</span>
          ) : (
            <span className="text-xs text-muted-foreground">계획 미설정</span>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-2xl font-bold text-foreground">{actual}</span>
              <span className="text-sm text-muted-foreground ml-1">{unit}</span>
            </div>
            {!isAdHoc && planned !== null && planned > 0 && (
              <span className="text-xs text-muted-foreground">계획 {planned}{unit}</span>
            )}
          </div>

          {!isAdHoc && rate !== null && (
            <Progress value={progressValue} className="h-1.5" />
          )}

          {subInfo && (
            <p className="text-xs text-muted-foreground">{subInfo}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
