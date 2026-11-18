import { useState, useMemo } from "react";
import { computeCarryOver } from "@shared/budgetCarry";
import { BUDGET_CATEGORIES, BUDGET_CATEGORY_LABEL, basisText, lineAmount, summarizeLines, type BudgetCategory } from "@shared/budgetLines";
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
  lineId: string; // "" = 세부내역 연결 안 함
};

type LineForm = { id?: number; category: BudgetCategory; name: string; unitPrice: string; qty: string; unit: string; amount: string; memo: string };
const emptyLineForm = (category: BudgetCategory): LineForm => ({ category, name: "", unitPrice: "", qty: "", unit: "", amount: "", memo: "" });

const today = new Date().toISOString().slice(0, 10);
const defaultExpenseForm: ExpenseForm = {
  expenseDate: today,
  amount: "",
  category: "project",
  description: "",
  lineId: "",
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

  const { data: lines = [] } = trpc.budget.lines.list.useQuery({ budgetId: budget?.id ?? 0 }, { enabled: !!budget?.id });
  const [lineForm, setLineForm] = useState<LineForm | null>(null);
  const [deletingLine, setDeletingLine] = useState<any | null>(null);
  const saveLineMutation = trpc.budget.lines.save.useMutation({
    onSuccess: () => { utils.budget.lines.list.invalidate(); setLineForm(null); toast.success("세부내역이 저장되었습니다."); },
    onError: (e) => toast.error(e.message || "세부내역 저장에 실패했습니다."),
  });
  const deleteLineMutation = trpc.budget.lines.delete.useMutation({
    onSuccess: () => { utils.budget.lines.list.invalidate(); utils.budget.expenses.list.invalidate(); setDeletingLine(null); toast.success("세부내역을 삭제했습니다. 연결된 지출은 그대로 남아 있습니다."); },
    onError: () => toast.error("세부내역 삭제에 실패했습니다."),
  });

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
      lineId: expense.lineId ? String(expense.lineId) : "",
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
      lineId: expenseForm.lineId ? Number(expenseForm.lineId) : null,
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

  const quarterCarry = useMemo(() => computeCarryOver(quarterBudgets, quarterExpenses), [q1Budget, q2Budget, q3Budget, q4Budget, quarterExpenses]);

  const totalExpenses = quarterExpenses.reduce((a, b) => a + b, 0);
  const totalUsageRate = totalBudget > 0 ? Math.round((totalExpenses / totalBudget) * 100) : 0;

  const categoryExpenses = useMemo(() => {
    const result: Record<string, number> = { labor: 0, operation: 0, project: 0 };
    for (const exp of expenses) {
      result[exp.category] = (result[exp.category] ?? 0) + parseFloat(exp.amount);
    }
    return result;
  }, [expenses]);

  const lineSummary = useMemo(
    () => summarizeLines(
      lines.map((l: any) => ({ id: l.id, category: l.category as BudgetCategory, amount: parseFloat(l.amount) })),
      expenses.map((e: any) => ({ category: e.category as BudgetCategory, amount: parseFloat(e.amount), lineId: e.lineId ?? null })),
    ),
    [lines, expenses],
  );
  const lineName = (id: number | null | undefined) => (id ? (lines as any[]).find((l) => l.id === id)?.name : undefined);

  const syncTotalToLines = () => {
    const total = lineSummary.totalBudget;
    const quarter = Math.floor(total / 4);
    upsertBudgetMutation.mutate({
      projectId, year, totalBudget: String(total),
      q1Budget: String(quarter + (total - quarter * 4)), q2Budget: String(quarter), q3Budget: String(quarter), q4Budget: String(quarter),
    });
  };

  const submitLine = () => {
    if (!lineForm) return;
    if (!lineForm.name.trim()) { toast.error("구분(항목 이름)을 입력해 주세요."); return; }
    const unitPrice = Number(parseAmount(lineForm.unitPrice)) || 0;
    const qty = Number(lineForm.qty.replace(/,/g, "")) || 0;
    const amount = Number(parseAmount(lineForm.amount)) || 0;
    if (lineAmount({ unitPrice, qty, amount }) <= 0) { toast.error("금액이나 단가×수량을 입력해 주세요."); return; }
    if (!budget?.id) return;
    saveLineMutation.mutate({ budgetId: budget.id, id: lineForm.id, category: lineForm.category, name: lineForm.name.trim(), unitPrice, qty, unit: lineForm.unit.trim(), amount, memo: lineForm.memo.trim() });
  };

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

          {/* 세부내역별 예산 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">세부내역별 예산</CardTitle>
              <p className="text-xs text-muted-foreground">사업비·운영비·인건비 안에서 항목별로 예산을 나눠 배정하고, 지출을 연결하면 항목별 집행액이 계산됩니다.</p>
            </CardHeader>
            <CardContent className="space-y-5 pt-0">
              {lineSummary.totalBudget > 0 && Math.round(lineSummary.totalBudget) !== Math.round(totalBudget) && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <span>세부내역 합계 {formatKRW(lineSummary.totalBudget)}원이 총예산 {formatKRW(totalBudget)}원과 다릅니다.</span>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={syncTotalToLines} disabled={upsertBudgetMutation.isPending}>총예산을 합계에 맞추기</Button>
                </div>
              )}
              {BUDGET_CATEGORIES.map((cat) => {
                const cs = lineSummary.cats.find((c) => c.category === cat)!;
                const rows = (lines as any[]).filter((l) => l.category === cat);
                return (
                  <div key={cat} className="rounded-lg border overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-muted/40">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold" style={{ color: CATEGORY_COLORS[cat] }}>{BUDGET_CATEGORY_LABEL[cat]}</span>
                        <span className="text-xs text-muted-foreground">예산 {formatKRW(cs.budget)}원 · 집행 {formatKRW(cs.spent)}원 · 잔액 {formatKRW(cs.remain)}원</span>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setLineForm(emptyLineForm(cat))}>
                        <Plus className="h-3 w-3" /> 세부내역 추가
                      </Button>
                    </div>
                    {rows.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-muted-foreground">등록된 세부내역이 없습니다.</p>
                    ) : (
                      <div className="divide-y">
                        {rows.map((l) => {
                          const amt = parseFloat(l.amount);
                          const spent = lineSummary.lineSpent.get(l.id) ?? 0;
                          const rate = amt > 0 ? Math.round((spent / amt) * 100) : 0;
                          const basis = basisText({ unitPrice: parseFloat(l.unitPrice), qty: parseFloat(l.qty), unit: l.unit, memo: l.memo });
                          return (
                            <div key={l.id} className="grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-2.5 sm:grid-cols-[1.2fr_1.4fr_auto_auto]">
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{l.name}</p>
                                <p className="text-xs text-muted-foreground sm:hidden">{basis}</p>
                              </div>
                              <p className="hidden text-xs text-muted-foreground sm:block">{basis || "-"}</p>
                              <div className="text-right">
                                <p className="text-sm font-semibold">{formatKRW(amt)}원</p>
                                <p className={`text-[11px] ${rate >= 100 ? "text-destructive" : "text-muted-foreground"}`}>집행 {formatKRW(spent)}원 ({rate}%)</p>
                              </div>
                              <div className="flex items-center gap-0.5 justify-end">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setLineForm({ id: l.id, category: l.category, name: l.name, unitPrice: parseFloat(l.unitPrice) ? String(parseFloat(l.unitPrice)) : "", qty: parseFloat(l.qty) ? String(parseFloat(l.qty)) : "", unit: l.unit, amount: String(amt), memo: l.memo })}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeletingLine(l)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2.5">
                <span className="text-sm font-semibold">계</span>
                <span className="text-sm font-bold">{formatKRW(lineSummary.totalBudget)}원 <span className="ml-2 text-xs font-normal text-muted-foreground">집행 {formatKRW(lineSummary.totalSpent)}원</span></span>
              </div>
            </CardContent>
          </Card>

          {/* Quarterly Budget */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">분기별 예산 현황</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((q) => {
                  const { budget: qBudget, carryIn, available, expense: qExpense, remain: qRemain, rate: qRate } = quarterCarry[q - 1];
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
                        {q > 1 && carryIn !== 0 && (
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{carryIn > 0 ? "이월(앞 분기 잔여)" : "이월(앞 분기 초과)"}</span>
                            <span className={`font-medium ${carryIn > 0 ? "text-blue-600" : "text-destructive"}`}>{carryIn > 0 ? "+" : "-"}{formatKRW(Math.abs(carryIn))}원</span>
                          </div>
                        )}
                        {q > 1 && carryIn !== 0 && (
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>사용 가능</span>
                            <span className="font-medium text-foreground">{formatKRW(available)}원</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>지출</span>
                          <span className="font-medium text-rose-500">{formatKRW(qExpense)}원</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>잔여</span>
                          <span className={`font-medium ${qRemain < 0 ? "text-destructive" : "text-emerald-600"}`}>{qRemain < 0 ? "-" : ""}{formatKRW(Math.abs(qRemain))}원</span>
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
                              {lineName((exp as any).lineId) && <span className="text-xs text-muted-foreground">· {lineName((exp as any).lineId)}</span>}
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

      {/* 세부내역 추가/수정 */}
      <Dialog open={!!lineForm} onOpenChange={(open) => { if (!open) setLineForm(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{lineForm?.id ? "세부내역 수정" : "세부내역 추가"}</DialogTitle></DialogHeader>
          {lineForm && (() => {
            const up = Number(parseAmount(lineForm.unitPrice)) || 0;
            const q = Number(lineForm.qty.replace(/,/g, "")) || 0;
            const auto = up > 0 && q > 0;
            const total = lineAmount({ unitPrice: up, qty: q, amount: Number(parseAmount(lineForm.amount)) || 0 });
            return (
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>분류</Label>
                    <Select value={lineForm.category} onValueChange={(v) => setLineForm((f) => f && ({ ...f, category: v as BudgetCategory }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {BUDGET_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{BUDGET_CATEGORY_LABEL[c]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>구분(항목) <span className="text-destructive">*</span></Label>
                    <Input placeholder="예: 다과 및 도시락" value={lineForm.name} onChange={(e) => setLineForm((f) => f && ({ ...f, name: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>단가 (원)</Label>
                    <Input inputMode="numeric" placeholder="7,980" value={lineForm.unitPrice ? formatKRW(lineForm.unitPrice) : ""} onChange={(e) => setLineForm((f) => f && ({ ...f, unitPrice: parseAmount(e.target.value) }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>수량</Label>
                    <Input inputMode="decimal" placeholder="200" value={lineForm.qty} onChange={(e) => setLineForm((f) => f && ({ ...f, qty: e.target.value.replace(/[^0-9.]/g, "") }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>단위</Label>
                    <Input placeholder="ea, 회, 명" value={lineForm.unit} onChange={(e) => setLineForm((f) => f && ({ ...f, unit: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>금액 (원){auto && <span className="ml-1 text-xs font-normal text-muted-foreground">단가×수량으로 자동 계산</span>}</Label>
                  <Input
                    inputMode="numeric"
                    disabled={auto}
                    placeholder="단가·수량이 없으면 금액을 직접 입력"
                    value={auto ? formatKRW(total) : lineForm.amount ? formatKRW(lineForm.amount) : ""}
                    onChange={(e) => setLineForm((f) => f && ({ ...f, amount: parseAmount(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>산출 설명 (선택)</Label>
                  <Input placeholder="예: 초대장 및 현수막, 약 5,130원×200ea" value={lineForm.memo} onChange={(e) => setLineForm((f) => f && ({ ...f, memo: e.target.value }))} />
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLineForm(null)}>취소</Button>
            <Button onClick={submitLine} disabled={saveLineMutation.isPending}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingLine} onOpenChange={(open) => { if (!open) setDeletingLine(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>세부내역을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>'{deletingLine?.name}' 예산 배정이 사라집니다. 연결돼 있던 지출은 지워지지 않고 연결만 끊어집니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => budget?.id && deletingLine && deleteLineMutation.mutate({ budgetId: budget.id, id: deletingLine.id })}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                  onValueChange={(v) => setExpenseForm((f) => ({ ...f, category: v as ExpenseForm["category"], lineId: "" }))}
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
            {(lines as any[]).some((l) => l.category === expenseForm.category) && (
              <div className="space-y-1.5">
                <Label>세부내역 (선택)</Label>
                <Select value={expenseForm.lineId || "none"} onValueChange={(v) => setExpenseForm((f) => ({ ...f, lineId: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="연결 안 함" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">연결 안 함</SelectItem>
                    {(lines as any[]).filter((l) => l.category === expenseForm.category).map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
