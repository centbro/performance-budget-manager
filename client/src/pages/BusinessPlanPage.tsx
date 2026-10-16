import PlanNotice from "@/components/PlanNotice";
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { LayoutTemplate, Plus, FileText, Trash2, MessageSquare, ChevronRight, Sparkles } from "lucide-react";
import QuickPlanDialog from "@/components/QuickPlanDialog";
import OrgTemplatePlanDialog from "@/components/OrgTemplatePlanDialog";
import { useLocation } from "wouter";

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "초안", variant: "outline" },
  in_progress: { label: "작성 중", variant: "secondary" },
  completed: { label: "완성", variant: "default" },
};

export default function BusinessPlanPage() {
  const [, navigate] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [orgOpen, setOrgOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newYear, setNewYear] = useState(new Date().getFullYear());

  const { data: plans, isLoading, refetch } = trpc.businessPlans.list.useQuery();
  const { data: projects } = trpc.projects.list.useQuery({ year: newYear });
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const createMutation = trpc.businessPlans.create.useMutation({
    onSuccess: (data) => {
      toast.success("사업계획서가 생성되었습니다.");
      setCreateOpen(false);
      setNewTitle("");
      setSelectedProjectId("");
      navigate(`/business-plans/${data.id}`);
    },
    onError: () => toast.error("생성에 실패했습니다."),
  });

  const deleteMutation = trpc.businessPlans.delete.useMutation({
    onSuccess: () => {
      toast.success("삭제되었습니다.");
      setDeleteId(null);
      refetch();
    },
    onError: () => toast.error("삭제에 실패했습니다."),
  });

  const handleCreate = () => {
    if (!newTitle.trim()) {
      toast.error("사업명을 입력해주세요.");
      return;
    }
    createMutation.mutate({
      title: newTitle.trim(),
      year: newYear,
      projectId: selectedProjectId ? parseInt(selectedProjectId) : undefined,
    });
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <PlanNotice feature="plan_generate" />
        {/* 헤더 */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">사업계획서 작성</h1>
            <p className="text-muted-foreground text-sm mt-1">
              공동모금회 양식으로 한 번에 생성하거나, 우리 기관 양식(PDF)에 맞춰 작성하세요.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setQuickOpen(true)}>
              <Sparkles className="w-4 h-4 mr-2" />
              공동모금회 양식 한 번에 생성
            </Button>
            <Button variant="outline" onClick={() => setOrgOpen(true)}>
              <LayoutTemplate className="w-4 h-4 mr-2" />
              우리 기관 양식으로 작성
            </Button>
            <Button variant="ghost" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              대화형
            </Button>
          </div>
        </div>

        {/* 목록 */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : !plans || plans.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">아직 작성된 사업계획서가 없습니다.</p>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                첫 번째 사업계획서 작성하기
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {plans.map((plan) => {
              const statusInfo = STATUS_LABEL[plan.status] ?? STATUS_LABEL.draft;
              return (
                <Card
                  key={plan.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/business-plans/${plan.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                          <span className="text-sm text-muted-foreground">{plan.year}년</span>
                        </div>
                        <CardTitle className="text-lg truncate">{plan.title}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(plan.id);
                          }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5" />
                        {plan.status === "draft"
                          ? "아직 시작하지 않음"
                          : plan.status === "in_progress"
                          ? "대화형 입력 진행 중"
                          : "최종본 생성 완료"}
                      </span>
                      <span>
                        수정: {new Date(plan.updatedAt).toLocaleDateString("ko-KR")}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <QuickPlanDialog open={quickOpen} onOpenChange={setQuickOpen} />
        <OrgTemplatePlanDialog open={orgOpen} onOpenChange={setOrgOpen} />

        {/* 새 사업계획서 생성 다이얼로그 */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 사업계획서 작성</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>사업명 *</Label>
                <Input
                  placeholder="예: 자원봉사자 관리사업"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </div>
              <div className="space-y-2">
                <Label>연도</Label>
                <Select
                  value={String(newYear)}
                  onValueChange={(v) => setNewYear(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}년
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>연계 사업 (선택)</Label>
                <Select
                  value={selectedProjectId}
                  onValueChange={setSelectedProjectId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="사업 선택 (선택사항)" />
                  </SelectTrigger>
                  <SelectContent>
                    {(projects ?? [])
                      .filter((p) => !p.parentId)
                      .map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.projectName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                취소
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? <Spinner className="w-4 h-4 mr-2" /> : null}
                작성 시작
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 삭제 확인 다이얼로그 */}
        <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>사업계획서 삭제</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              이 사업계획서를 삭제하면 모든 대화 내역과 생성된 내용이 사라집니다. 계속하시겠습니까?
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)}>
                취소
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? <Spinner className="w-4 h-4 mr-2" /> : null}
                삭제
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
