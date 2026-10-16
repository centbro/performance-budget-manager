import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Folder,
  BookOpen,
  Users,
  Wallet,
  TrendingUp,
  BarChart3,
  FileText,
  Upload,
  X,
  ExternalLink,
  ClipboardList,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/_core/hooks/useAuth";

const currentYear = new Date().getFullYear();

export default function ProjectsPage() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const { data: parentProjects = [], isLoading } = trpc.projects.listParents.useQuery({ year: currentYear });

  const [showAddParent, setShowAddParent] = useState(false);
  const [parentName, setParentName] = useState("");
  const [editParent, setEditParent] = useState<{ id: number; name: string } | null>(null);

  const createParent = trpc.projects.create.useMutation({
    onSuccess: () => {
      utils.projects.listParents.invalidate();
      utils.projects.list.invalidate();
      utils.performance.dashboardOverview.invalidate();
      setShowAddParent(false);
      setParentName("");
      toast.success("큰 사업이 등록되었습니다.");
    },
    onError: () => toast.error("등록에 실패했습니다."),
  });

  const deleteParent = trpc.projects.delete.useMutation({
    onSuccess: () => {
      utils.projects.listParents.invalidate();
      utils.projects.list.invalidate();
      utils.performance.dashboardOverview.invalidate();
      toast.success("사업이 삭제되었습니다.");
    },
    onError: () => toast.error("삭제에 실패했습니다."),
  });

  const updateParent = trpc.projects.update.useMutation({
    onSuccess: () => {
      utils.projects.listParents.invalidate();
      utils.projects.list.invalidate();
      utils.performance.dashboardOverview.invalidate();
      setEditParent(null);
      toast.success("수정되었습니다.");
    },
    onError: () => toast.error("수정에 실패했습니다."),
  });

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">사업 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {user?.name ?? user?.email ?? "현재 계정"} · {currentYear}년도 사업 목록 · 로그인한 계정의 사업만 표시됩니다.
          </p>
        </div>
        <Button onClick={() => setShowAddParent(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          큰 사업 등록
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : parentProjects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <BookOpen className="h-12 w-12 text-muted-foreground/30" />
            <div className="text-center">
              <p className="text-muted-foreground font-medium">등록된 사업이 없습니다</p>
              <p className="text-sm text-muted-foreground/60 mt-1">큰 사업을 먼저 등록해 주세요.</p>
            </div>
            <Button onClick={() => setShowAddParent(true)} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />큰 사업 등록
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {parentProjects.map((parent) => (
            <ParentProjectCard
              key={parent.id}
              parent={parent}
              onEdit={(p) => setEditParent({ id: p.id, name: p.projectName })}
              onDelete={(id) => {
                if (confirm("이 사업과 모든 세부 사업, 대상자, 예산 데이터가 삭제됩니다. 계속하시겠습니까?")) {
                  deleteParent.mutate({ id });
                }
              }}
            />
          ))}
        </div>
      )}

      {/* 큰 사업 등록 다이얼로그 */}
      <Dialog open={showAddParent} onOpenChange={setShowAddParent}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>큰 사업 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>사업명 <span className="text-destructive">*</span></Label>
              <Input
                placeholder="예: 노인 복지 사업"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createParent.mutate({ projectName: parentName.trim(), year: currentYear })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddParent(false)}>취소</Button>
            <Button
              onClick={() => {
                if (!parentName.trim()) return toast.error("사업명을 입력해 주세요.");
                createParent.mutate({ projectName: parentName.trim(), year: currentYear });
              }}
              disabled={createParent.isPending}
            >
              {createParent.isPending ? "등록 중..." : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 큰 사업 수정 다이얼로그 */}
      {editParent && (
        <Dialog open={!!editParent} onOpenChange={() => setEditParent(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>사업명 수정</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>사업명</Label>
                <Input
                  value={editParent.name}
                  onChange={(e) => setEditParent({ ...editParent, name: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && updateParent.mutate({ id: editParent.id, projectName: editParent.name })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditParent(null)}>취소</Button>
              <Button onClick={() => updateParent.mutate({ id: editParent.id, projectName: editParent.name })} disabled={updateParent.isPending}>
                저장
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ── 큰 사업 카드 ──────────────────────────────────────────────────────────────

function ParentProjectCard({
  parent,
  onEdit,
  onDelete,
}: {
  parent: { id: number; projectName: string; year: number };
  onEdit: (p: { id: number; projectName: string }) => void;
  onDelete: (id: number) => void;
}) {
  const [, setLocation] = useLocation();
  const [expanded, setExpanded] = useState(true);
  const [showAddSub, setShowAddSub] = useState(false);
  const [editSub, setEditSub] = useState<SubFormData & { id: number } | null>(null);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const utils = trpc.useUtils();

  // 사업 계획서 목록
  const { data: planFiles = [] } = trpc.projectPlans.list.useQuery({ projectId: parent.id });

  const uploadPlan = trpc.projectPlans.upload.useMutation({
    onSuccess: () => {
      utils.projectPlans.list.invalidate({ projectId: parent.id });
      toast.success("계획서가 업로드되었습니다.");
    },
    onError: () => toast.error("업로드에 실패했습니다."),
  });

  const deletePlan = trpc.projectPlans.delete.useMutation({
    onSuccess: () => {
      utils.projectPlans.list.invalidate({ projectId: parent.id });
      toast.success("계획서가 삭제되었습니다.");
    },
    onError: () => toast.error("삭제에 실패했습니다."),
  });

  const [isUploading, setIsUploading] = useState(false);

  const handlePlanFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") return toast.error("PDF 파일만 업로드 가능합니다.");
    if (file.size > 20 * 1024 * 1024) return toast.error("파일 크기가 20MB를 초과합니다.");
    e.target.value = "";
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", String(parent.id));
      const res = await fetch("/api/upload/plan", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "업로드 실패" }));
        throw new Error(err.error ?? "업로드 실패");
      }
      await utils.projectPlans.list.invalidate({ projectId: parent.id });
      toast.success("계획서가 업로드되었습니다.");
    } catch (err: any) {
      toast.error(err?.message ?? "업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  const { data: subProjects = [] } = trpc.projects.listSubs.useQuery({ parentId: parent.id });

  const createSub = trpc.projects.createSub.useMutation({
    onSuccess: () => {
      utils.projects.listSubs.invalidate({ parentId: parent.id });
      utils.projects.list.invalidate();
      utils.performance.dashboardOverview.invalidate();
      setShowAddSub(false);
      setSubForm(defaultSubForm);
      toast.success("세부 사업이 등록되었습니다.");
    },
    onError: () => toast.error("등록에 실패했습니다."),
  });

  const deleteSub = trpc.projects.deleteSub.useMutation({
    onSuccess: () => {
      utils.projects.listSubs.invalidate({ parentId: parent.id });
      utils.projects.list.invalidate();
      utils.performance.dashboardOverview.invalidate();
      toast.success("세부 사업이 삭제되었습니다.");
    },
    onError: () => toast.error("삭제에 실패했습니다."),
  });

  const updateSub = trpc.projects.update.useMutation({
    onSuccess: () => {
      utils.projects.listSubs.invalidate({ parentId: parent.id });
      utils.projects.list.invalidate();
      utils.performance.dashboardOverview.invalidate();
      setEditSub(null);
      toast.success("수정되었습니다.");
    },
    onError: () => toast.error("수정에 실패했습니다."),
  });

  const defaultSubForm: SubFormData = {
    projectName: "",
    subProjectName: "",
    plannedPeople: "",
    plannedExtended: "",
    plannedCount: "",
    isAdHoc: false,
  };
  const [subForm, setSubForm] = useState<SubFormData>(defaultSubForm);

  const handleAddSub = () => {
    if (!subForm.projectName.trim()) return toast.error("세부 사업명을 입력해 주세요.");
    createSub.mutate({
      parentId: parent.id,
      projectName: subForm.projectName.trim(),
      subProjectName: subForm.subProjectName.trim() || undefined,
      plannedPeople: subForm.plannedPeople ? parseInt(subForm.plannedPeople) : undefined,
      plannedExtended: subForm.plannedExtended ? parseInt(subForm.plannedExtended) : undefined,
      plannedCount: subForm.isAdHoc ? undefined : (subForm.plannedCount ? parseInt(subForm.plannedCount) : undefined),
      isAdHoc: subForm.isAdHoc,
      year: parent.year,
    });
  };

  const handleUpdateSub = () => {
    if (!editSub) return;
    updateSub.mutate({
      id: editSub.id,
      projectName: editSub.projectName,
      subProjectName: editSub.subProjectName || undefined,
      plannedPeople: editSub.plannedPeople ? parseInt(editSub.plannedPeople) : null,
      plannedExtended: editSub.plannedExtended ? parseInt(editSub.plannedExtended) : null,
      plannedCount: editSub.isAdHoc ? null : (editSub.plannedCount ? parseInt(editSub.plannedCount) : null),
      isAdHoc: editSub.isAdHoc,
    });
  };

  return (
    <Card className="overflow-hidden shadow-sm">
      {/* 큰 사업 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 sm:px-5 py-3 sm:py-4 bg-card border-b border-border/50">
        <button className="flex items-center gap-3 flex-1 min-w-[12rem] text-left" onClick={() => setExpanded(!expanded)}>
          {expanded
            ? <FolderOpen className="h-5 w-5 text-primary shrink-0" />
            : <Folder className="h-5 w-5 text-primary/60 shrink-0" />
          }
          <div className="min-w-0">
            <span className="font-semibold text-foreground break-keep">{parent.projectName}</span>
            <span className="ml-2 text-xs text-muted-foreground">세부 사업 {subProjects.length}개</span>
          </div>
          {expanded
            ? <ChevronDown className="h-4 w-4 text-muted-foreground ml-2" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground ml-2" />
          }
        </button>
        {/* 큰 사업 바로가기 버튼 */}
        <div className="flex flex-wrap items-center gap-1 sm:ml-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => setLocation(`/participants/${parent.id}`)}>
            <Users className="h-3 w-3" />대상자
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => setLocation(`/budget/${parent.id}`)}>
            <Wallet className="h-3 w-3" />예산
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground relative" onClick={() => setShowPlanDialog(true)}>
            <FileText className="h-3 w-3" />계획서
            {planFiles.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">{planFiles.length}</span>
            )}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => setLocation(`/evaluation/${parent.id}`)}>
            <ClipboardList className="h-3 w-3" />평가서
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(parent)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(parent.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 세부 사업 목록 */}
      {expanded && (
        <CardContent className="p-4 space-y-2">
          {subProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">등록된 세부 사업이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {subProjects.map((sub) => (
                <div
                  key={sub.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-3 rounded-lg bg-muted/40 border border-border/30 hover:bg-muted/60 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-[12rem] flex-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{sub.projectName}</p>
                      {sub.subProjectName && (
                        <p className="text-xs text-muted-foreground truncate">{sub.subProjectName}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {sub.isAdHoc ? (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">수시</Badge>
                        ) : (
                          <>
                            {sub.plannedPeople != null && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">실인원 {sub.plannedPeople.toLocaleString()}명</Badge>
                            )}
                            {sub.plannedExtended != null && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">연인원 {sub.plannedExtended.toLocaleString()}명</Badge>
                            )}
                            {sub.plannedCount != null && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">횟수 {sub.plannedCount.toLocaleString()}회</Badge>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => setLocation(`/performance/${sub.id}`)}>
                      <TrendingUp className="h-3 w-3" />실적
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => setLocation(`/performance-stats/${sub.id}`)}>
                      <BarChart3 className="h-3 w-3" />현황
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => setEditSub({
                        id: sub.id,
                        projectName: sub.projectName,
                        subProjectName: sub.subProjectName ?? "",
                        plannedPeople: sub.plannedPeople?.toString() ?? "",
                        plannedExtended: sub.plannedExtended?.toString() ?? "",
                        plannedCount: sub.plannedCount?.toString() ?? "",
                        isAdHoc: sub.isAdHoc,
                      })}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm("이 세부 사업과 실적 기록이 모두 삭제됩니다. 계속하시겠습니까?")) {
                          deleteSub.mutate({ id: sub.id });
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button variant="outline" size="sm" className="w-full gap-2 mt-2 border-dashed" onClick={() => setShowAddSub(true)}>
            <Plus className="h-3.5 w-3.5" />세부 사업 추가
          </Button>
        </CardContent>
      )}

      {/* 세부 사업 등록 다이얼로그 */}
      <Dialog open={showAddSub} onOpenChange={setShowAddSub}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>세부 사업 등록</DialogTitle>
            <p className="text-sm text-muted-foreground">상위 사업: {parent.projectName}</p>
          </DialogHeader>
          <SubProjectForm form={subForm} onChange={(v) => setSubForm((f) => ({ ...f, ...v }))} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddSub(false); setSubForm(defaultSubForm); }}>취소</Button>
            <Button onClick={handleAddSub} disabled={createSub.isPending}>
              {createSub.isPending ? "등록 중..." : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 세부 사업 수정 다이얼로그 */}
      {editSub && (
        <Dialog open={!!editSub} onOpenChange={() => setEditSub(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>세부 사업 수정</DialogTitle></DialogHeader>
            <SubProjectForm form={editSub} onChange={(v) => setEditSub((f) => f ? { ...f, ...v } : f)} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditSub(null)}>취소</Button>
              <Button onClick={handleUpdateSub} disabled={updateSub.isPending}>
                {updateSub.isPending ? "저장 중..." : "저장"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* 사업 계획서 관리 다이얼로그 */}
      <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              사업 계획서 관리
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{parent.projectName}</p>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* 업로드 버튼 */}
            <label className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-border rounded-lg p-4 cursor-pointer hover:bg-muted/30 transition-colors">
              <input type="file" accept=".pdf" className="hidden" onChange={handlePlanFileChange} disabled={isUploading} />
              {isUploading ? (
                <span className="text-sm text-muted-foreground">업로드 중...</span>
              ) : (
                <>
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">PDF 파일을 클릭하여 업로드 (최대 20MB)</span>
                </>
              )}
            </label>

            {/* 업로드된 파일 목록 */}
            {planFiles.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">업로드된 계획서가 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {planFiles.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/30">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm flex-1 truncate">{f.fileName}</span>
                    <a
                      href={f.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                      title="열기"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button
                      onClick={() => deletePlan.mutate({ id: f.id })}
                      disabled={deletePlan.isPending}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      title="삭제"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPlanDialog(false)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── 세부 사업 폼 공통 컴포넌트 ────────────────────────────────────────────────

type SubFormData = {
  projectName: string;
  subProjectName: string;
  plannedPeople: string;
  plannedExtended: string;
  plannedCount: string;
  isAdHoc: boolean;
};

function SubProjectForm({
  form,
  onChange,
}: {
  form: SubFormData;
  onChange: (v: Partial<SubFormData>) => void;
}) {
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label>세부 사업명 <span className="text-destructive">*</span></Label>
        <Input
          placeholder="예: 방문 건강 관리"
          value={form.projectName}
          onChange={(e) => onChange({ projectName: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>세부 구분명 <span className="text-muted-foreground text-xs">(선택)</span></Label>
        <Input
          placeholder="예: 1차 방문"
          value={form.subProjectName}
          onChange={(e) => onChange({ subProjectName: e.target.value })}
        />
      </div>
      <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
        <p className="text-sm font-medium">계획값 설정</p>
        <div className="flex items-center gap-3">
          <Switch
            id="isAdHoc"
            checked={form.isAdHoc}
            onCheckedChange={(v) => onChange({ isAdHoc: v })}
          />
          <Label htmlFor="isAdHoc" className="cursor-pointer">수시 진행 사업</Label>
        </div>
        {!form.isAdHoc && (
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">실인원 계획</Label>
              <Input type="number" placeholder="명" value={form.plannedPeople} onChange={(e) => onChange({ plannedPeople: e.target.value })} min={0} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">연인원 계획</Label>
              <Input type="number" placeholder="명" value={form.plannedExtended} onChange={(e) => onChange({ plannedExtended: e.target.value })} min={0} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">횟수 계획</Label>
              <Input type="number" placeholder="회" value={form.plannedCount} onChange={(e) => onChange({ plannedCount: e.target.value })} min={0} />
            </div>
          </div>
        )}
        {form.isAdHoc && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50">
            <Badge variant="secondary" className="text-xs">수시</Badge>
            <span className="text-xs text-muted-foreground">횟수 제한 없이 수시로 진행</span>
          </div>
        )}
      </div>
    </div>
  );
}
