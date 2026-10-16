import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft,
  Wallet,
  Plus,
  Pencil,
  Trash2,
  Settings2,
  TrendingDown,
  PieChart,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const currentYear = new Date().getFullYear();

const CATEGORY_LABELS: Record<string, string> = {
  labor: "인건비",
  operation: "운영비",
  project: "사업비",
};

const CATEGORY_COLORS: Record<string, string> = {
  labor: "oklch(0.52 0.18 255)",
  operation: "oklch(0.62 0.15 180)",
  project: "oklch(0.65 0.16 60)",
};

const QUARTER_MONTHS: Record<number, number[]> = {
  1: [1, 2, 3],
  2: [4, 5, 6],
  3: [7, 8, 9],
  4: [10, 11, 12],
};

function formatKRW(amount: number | string) {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(n)) return "0";
  return n.toLocaleString("ko-KR");
}

function parseAmount(str: string) {
  return str.replace(/,/g, "").replace(/[^0-9]/g, "");
}

function getQuarterFromDate(dateStr: string): number {
  const month = parseInt(dateStr.slice(5, 7), 10);
  if (month <= 3) return 1;
  if (month <= 6) return 2;
  if (month <= 9) return 3;
  return 4;
}

type BudgetForm = {
  totalBudget: string;
  q1Budget: string;
  q2Budget: string;
  q3Budget: string;
  q4Budget: string;
};

type ExpenseForm = {
  expenseDate: string;
  amount: string;
  category: "labor" | "operation" | "project";
  description: string;
};

const today = new Date().toISOString().slice(0, 10);
const defaultExpenseForm: ExpenseForm = {
  expenseDate: today,
  amount: "",
  category: "project",
  description: "",
};

export default function BudgetPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = parseInt(params.projectId ?? "0");
  const [, setLocation] = useLocation();
  const [year, setYear] = useState(currentYear);
  const utils = trpc.useUtils();

  const { data: project } = trpc.projects.get.useQuery({ id: projectId });
  const { data: budget, isLoading: budgetLoading } = trpc.budget.get.useQuery({ projectId, year });

  const [isBudgetOpen, setIsBudgetOpen] = useState(false);
  const [budgetForm, setBudgetForm] = useState<BudgetForm>({
    totalBudget: "",
    q1Budget: "",
    q2Budget: "",
    q3Budget: "",
    q4Budget: "",
  });

  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<number | null>(null);
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>(defaultExpenseForm);

  // Expenses (only when budget exists)
  const { data: expenses = [], isLoading: expensesLoading } = trpc.budget.expenses.list.useQuery(
    { budgetId: budget?.id ?? 0 },
    { enabled: !!budget?.id }
  );

  const upsertBudgetMutation = trpc.budget.upsert.useMutation({
    onSuccess: () => {
      utils.budget.get.invalidate();
      utils.performance.dashboardBudget.invalidate();
      setIsBudgetOpen(false);
      toast.success("예산이 저장되었습니다.");
    },
    onError: () => toast.error("예산 저장에 실패했습니다."),
  });

  const createExpenseMutation = trpc.budget.expenses.create.useMutation({
    onSuccess: () => {
      utils.budget.expenses.list.invalidate();
      utils.performance.dashboardBudget.invalidate();
      setIsExpenseOpen(false);
      setExpenseForm(defaultExpenseForm);
      toast.success("지출이 등록되었습니다.");
    },
    onError: () => toast.error("지출 등록에 실패했습니다."),
  });

  const updateExpenseMutation = trpc.budget.expenses.update.useMutation({
    onSuccess: () => {
      utils.budget.expenses.list.invalidate();
      utils.performance.dashboardBudget.invalidate();
      setEditingExpense(null);
      toast.success("지출이 수정되었습니다.");
    },
    onError: () => toast.error("지출 수정에 실패했습니다."),
  });

  const deleteExpenseMutation = trpc.budget.expenses.delete.useMutation({
    onSuccess: () => {
      utils.budget.expenses.list.invalidate();
      utils.performance.dashboardBudget.invalidate();
      setDeletingExpenseId(null);
      toast.success("지출이 삭제되었습니다.");
    },
    onError: () => toast.error("지출 삭제에 실패했습니다."),
  });

  const handleOpenBudget = () => {
    if (budget) {
      setBudgetForm({
        totalBudget: budget.totalBudget,
        q1Budget: budget.q1Budget,
        q2Budget: budget.q2Budget,
        q3Budget: budget.q3Budget,
        q4Budget: budget.q4Budget,
      });
    } else {
      setBudgetForm({ totalBudget: "", q1Budget: "", q2Budget: "", q3Budget: "", q4Budget: "" });
    }
    setIsBudgetOpen(true);
  };

  const handleTotalBudgetChange = (value: string) => {
    const raw = parseAmount(value);
    const total = parseFloat(raw) || 0;
    const quarter = Math.floor(total / 4);
    const remainder = total - quarter * 4;
    setBudgetForm({
      totalBudget: raw,
      q1Budget: (quarter + remainder).toString(),
      q2Budget: quarter.toString(),
      q3Budget: quarter.toString(),
      q4Budget: quarter.toString(),
    });
  };

  const handleSaveBudget = () => {
    const total = parseFloat(budgetForm.totalBudget) || 0;
    if (total <= 0) { toast.error("총예산을 입력해 주세요."); return; }
    upsertBudgetMutation.mutate({
      projectId,
      year,
      totalBudget: budgetForm.totalBudget,
      q1Budget: budgetForm.q1Budget || "0",
      q2Budget: budgetForm.q2Budget || "0",
      q3Budget: budgetForm.q3Budget || "0",
      q4Budget: budgetForm.q4Budget || "0",
    });
  };

  const handleOpenExpense = () => {
    setExpenseForm(defaultExpenseForm);
    setIsExpenseOpen(true);
  };

  const handleOpenEditExpense = (expense: any) => {
    const dateStr = typeof expense.expenseDate === "string"
      ? expense.expenseDate
      : (expense.expenseDate as Date).toISOString().slice(0, 10);
    setExpenseForm({
      expenseDate: dateStr,
      amount: expense.amount,
      category: expense.category,
      description: expense.description,
    });
    setEditingExpense(expense);
  };

  const handleSubmitExpense = () => {
    if (!expenseForm.expenseDate) { toast.error("날짜를 입력해 주세요."); return; }
    if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) { toast.error("금액을 입력해 주세요."); return; }
    if (!expenseForm.description.trim()) { toast.error("내용을 입력해 주세요."); return; }

    const payload = {
      expenseDate: expenseForm.expenseDate,
      amount: parseAmount(expenseForm.amount),
      category: expenseForm.category,
      description: expenseForm.description.trim(),
    };

    if (editingExpense) {
      updateExpenseMutation.mutate({ id: editingExpense.id, ...payload });
    } else {
      if (!budget?.id) { toast.error("예산을 먼저 설정해 주세요."); return; }
      createExpenseMutation.mutate({ budgetId: budget.id, ...payload });
    }
  };

  // Calculations
  const totalBudget = parseFloat(budget?.totalBudget ?? "0");
  const q1Budget = parseFloat(budget?.q1Budget ?? "0");
  const q2Budget = parseFloat(budget?.q2Budget ?? "0");
  const q3Budget = parseFloat(budget?.q3Budget ?? "0");
  const q4Budget = parseFloat(budget?.q4Budget ?? "0");

  const quarterBudgets = [q1Budget, q2Budget, q3Budget, q4Budget];

  const quarterExpenses = useMemo(() => {
    const result = [0, 0, 0, 0];
    for (const exp of expenses) {
      const dateStr = typeof exp.expenseDate === "string"
        ? exp.expenseDate
        : (exp.expenseDate as Date).toISOString().slice(0, 10);
      const q = getQuarterFromDate(dateStr) - 1;
      result[q] += parseFloat(exp.amount);
    }
    return result;
  }, [expenses]);

  const totalExpenses = quarterExpenses.reduce((a, b) => a + b, 0);
  const totalUsageRate = totalBudget > 0 ? Math.round((totalExpenses / totalBudget) * 100) : 0;

  const categoryExpenses = useMemo(() => {
    const result: Record<string, number> = { labor: 0, operation: 0, project: 0 };
    for (const exp of expenses) {
      result[exp.category] = (result[exp.category] ?? 0) + parseFloat(exp.amount);
    }
    return result;
  }, [expenses]);

  const pieData = Object.entries(categoryExpenses)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ name: CATEGORY_LABELS[key], value, key }));

  const sortedExpenses = useMemo(() =>
    [...expenses].sort((a, b) => {
      const da = typeof a.expenseDate === "string" ? a.expenseDate : (a.expenseDate as Date).toISOString().slice(0, 10);
      const db = typeof b.expenseDate === "string" ? b.expenseDate : (b.expenseDate as Date).toISOString().slice(0, 10);
      return db.localeCompare(da);
    }),
    [expenses]
  );

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setLocation("/projects")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-[12rem]">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">예산 관리</h1>
          {project && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {project.projectName} · 예산은 큰 사업 단위로 관리됩니다
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setYear((y) => y - 1)}>‹</Button>
            <span className="text-sm font-medium w-12 text-center">{year}년</span>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setYear((y) => y + 1)}>›</Button>
          </div>
          <Button variant="outline" size="sm" onClick={handleOpenBudget} className="gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />
            예산 설정
          </Button>
          {budget && (
            <Button size="sm" onClick={handleOpenExpense} className="gap-1.5">
              <Plus className="h-4 w-4" />
              지출 등록
            </Button>
          )}
        </div>
      </div>

      {budgetLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : !budget ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <Wallet className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              예산이 설정되지 않았습니다.<br />총예산을 입력해 주세요.
            </p>
            <Button size="sm" onClick={handleOpenBudget}>
              <Settings2 className="h-4 w-4 mr-1.5" />
              예산 설정하기
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Total Budget Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center">
                    <Wallet className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium">총예산</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{formatKRW(totalBudget)}<span className="text-sm font-normal ml-1 text-muted-foreground">원</span></p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                    <TrendingDown className="h-4 w-4 text-rose-500" />
                  </div>
                  <span className="text-sm font-medium">총지출</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{formatKRW(totalExpenses)}<span className="text-sm font-normal ml-1 text-muted-foreground">원</span></p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <PieChart className="h-4 w-4 text-emerald-600" />
                  </div>
                  <span className="text-sm font-medium">예산 사용률</span>
                  <span className={`ml-auto text-lg font-bold ${totalUsageRate >= 100 ? "text-destructive" : totalUsageRate >= 80 ? "text-amber-600" : "text-emerald-600"}`}>
                    {totalUsageRate}%
                  </span>
                </div>
                <Progress value={Math.min(totalUsageRate, 100)} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">잔여 {formatKRW(Math.max(totalBudget - totalExpenses, 0))}원</p>
              </CardContent>
            </Card>
          </div>

          {/* Quarterly Budget */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">분기별 예산 현황</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((q) => {
                  const qBudget = quarterBudgets[q - 1];
                  const qExpense = quarterExpenses[q - 1];
                  const qRate = qBudget > 0 ? Math.round((qExpense / qBudget) * 100) : 0;
                  const qRemain = Math.max(qBudget - qExpense, 0);
                  const rateColor = qRate >= 100 ? "text-destructive" : qRate >= 80 ? "text-amber-600" : "text-emerald-600";

                  return (
                    <div key={q} className="p-4 rounded-xl border bg-card space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">{q}분기</span>
                        <span className={`text-sm font-bold ${rateColor}`}>{qRate}%</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>예산</span>
                          <span className="font-medium text-foreground">{formatKRW(qBudget)}원</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>지출</span>
                          <span className="font-medium text-rose-500">{formatKRW(qExpense)}원</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>잔여</span>
                          <span className="font-medium text-emerald-600">{formatKRW(qRemain)}원</span>
                        </div>
                      </div>
                      <Progress value={Math.min(qRate, 100)} className="h-1.5" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Expenses by Category + List */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Category Pie */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">항목별 지출</CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <PieChart className="h-8 w-8 mb-2 opacity-30" />
                    <p className="text-xs">지출 내역이 없습니다.</p>
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <RechartsPieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieData.map((entry) => (
                            <Cell key={entry.key} fill={CATEGORY_COLORS[entry.key]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => [`${formatKRW(value)}원`, ""]}
                          contentStyle={{
                            background: "var(--card)",
                            border: "1px solid var(--border)",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 mt-2">
                      {Object.entries(categoryExpenses).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[key] }} />
                            <span className="text-muted-foreground">{CATEGORY_LABELS[key]}</span>
                          </div>
                          <span className="font-medium">{formatKRW(value)}원</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Expense List */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold">지출 내역</CardTitle>
                <span className="text-xs text-muted-foreground">{expenses.length}건</span>
              </CardHeader>
              <CardContent className="p-0">
                {expensesLoading ? (
                  <div className="p-4 space-y-2">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
                  </div>
                ) : sortedExpenses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <TrendingDown className="h-8 w-8 mb-2 opacity-30" />
                    <p className="text-xs">등록된 지출이 없습니다.</p>
                  </div>
                ) : (
                  <div className="divide-y max-h-80 overflow-y-auto">
                    {sortedExpenses.map((exp) => {
                      const dateStr = typeof exp.expenseDate === "string"
                        ? exp.expenseDate
                        : (exp.expenseDate as Date).toISOString().slice(0, 10);
                      return (
                        <div key={exp.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-muted-foreground">{dateStr}</span>
                              <Badge
                                variant="outline"
                                className="text-xs px-1.5 py-0"
                                style={{
                                  borderColor: CATEGORY_COLORS[exp.category] + "60",
                                  color: CATEGORY_COLORS[exp.category],
                                  background: CATEGORY_COLORS[exp.category] + "15",
                                }}
                              >
                                {CATEGORY_LABELS[exp.category]}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-sm font-medium text-foreground">{formatKRW(parseFloat(exp.amount))}원</span>
                              <span className="text-xs text-muted-foreground truncate">{exp.description}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleOpenEditExpense(exp)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeletingExpenseId(exp.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Budget Setup Dialog */}
      <Dialog open={isBudgetOpen} onOpenChange={(open) => { if (!open) setIsBudgetOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>예산 설정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="totalBudget">총예산 (원) <span className="text-destructive">*</span></Label>
              <Input
                id="totalBudget"
                placeholder="총예산을 입력하면 분기별로 자동 배분됩니다"
                value={budgetForm.totalBudget ? formatKRW(budgetForm.totalBudget) : ""}
                onChange={(e) => handleTotalBudgetChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">총예산 입력 시 4개 분기에 균등 배분됩니다. 분기별로 수동 조정 가능합니다.</p>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((q) => {
                const key = `q${q}Budget` as keyof BudgetForm;
                return (
                  <div key={q} className="space-y-1.5">
                    <Label htmlFor={`q${q}`} className="text-xs text-muted-foreground">{q}분기 예산 (원)</Label>
                    <Input
                      id={`q${q}`}
                      placeholder="0"
                      value={budgetForm[key] ? formatKRW(budgetForm[key]) : ""}
                      onChange={(e) =>
                        setBudgetForm((f) => ({ ...f, [key]: parseAmount(e.target.value) }))
                      }
                    />
                  </div>
                );
              })}
            </div>
            {/* Sum check */}
            {budgetForm.totalBudget && (
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-muted-foreground">분기 합계</span>
                <span className={`font-medium ${
                  Math.abs(
                    (parseFloat(budgetForm.q1Budget || "0") + parseFloat(budgetForm.q2Budget || "0") +
                     parseFloat(budgetForm.q3Budget || "0") + parseFloat(budgetForm.q4Budget || "0")) -
                    parseFloat(budgetForm.totalBudget)
                  ) > 1 ? "text-amber-600" : "text-emerald-600"
                }`}>
                  {formatKRW(
                    (parseFloat(budgetForm.q1Budget || "0") + parseFloat(budgetForm.q2Budget || "0") +
                     parseFloat(budgetForm.q3Budget || "0") + parseFloat(budgetForm.q4Budget || "0"))
                  )}원
                  {" "}/ 총 {formatKRW(budgetForm.totalBudget)}원
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBudgetOpen(false)}>취소</Button>
            <Button onClick={handleSaveBudget} disabled={upsertBudgetMutation.isPending}>
              {upsertBudgetMutation.isPending ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expense Create/Edit Dialog */}
      <Dialog open={isExpenseOpen || !!editingExpense} onOpenChange={(open) => {
        if (!open) { setIsExpenseOpen(false); setEditingExpense(null); }
      }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "지출 수정" : "지출 등록"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="expenseDate">날짜 <span className="text-destructive">*</span></Label>
                <Input
                  id="expenseDate"
                  type="date"
                  value={expenseForm.expenseDate}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, expenseDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>항목 <span className="text-destructive">*</span></Label>
                <Select
                  value={expenseForm.category}
                  onValueChange={(v) => setExpenseForm((f) => ({ ...f, category: v as ExpenseForm["category"] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="labor">인건비</SelectItem>
                    <SelectItem value="operation">운영비</SelectItem>
                    <SelectItem value="project">사업비</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount">금액 (원) <span className="text-destructive">*</span></Label>
              <Input
                id="amount"
                placeholder="금액 입력"
                value={expenseForm.amount ? formatKRW(expenseForm.amount) : ""}
                onChange={(e) => setExpenseForm((f) => ({ ...f, amount: parseAmount(e.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">내용 <span className="text-destructive">*</span></Label>
              <Textarea
                id="description"
                placeholder="지출 내용을 입력하세요"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsExpenseOpen(false); setEditingExpense(null); }}>취소</Button>
            <Button onClick={handleSubmitExpense} disabled={createExpenseMutation.isPending || updateExpenseMutation.isPending}>
              {createExpenseMutation.isPending || updateExpenseMutation.isPending ? "저장 중..." : editingExpense ? "수정" : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deletingExpenseId} onOpenChange={(open) => { if (!open) setDeletingExpenseId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>지출을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deletingExpenseId) deleteExpenseMutation.mutate({ id: deletingExpenseId }); }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
