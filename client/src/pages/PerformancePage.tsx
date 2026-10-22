import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, X } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ArrowLeft, CalendarDays, Users, Hash, Lock, LockOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { VaultUnlockDialog, VaultResetDialog } from "@/components/VaultDialogs";
import { lockVault, useDecryptedSecrets, useVaultKey } from "@/lib/vault";

type RecordForm = {
  recordDate: string;
  count: string;
  note: string;
  participantIds: number[];
};

const today = new Date().toISOString().slice(0, 10);
const defaultForm: RecordForm = { recordDate: today, count: "1", note: "", participantIds: [] };

export default function PerformancePage() {
  const params = useParams<{ projectId: string }>();
  const projectId = parseInt(params.projectId ?? "0");
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: project } = trpc.projects.get.useQuery({ id: projectId });
  // 세부 사업의 parentId로 큰 사업 대상자 조회
  const parentId = project?.parentId ?? null;
  const { data: participants = [] } = trpc.participants.list.useQuery(
    { projectId: parentId! },
    { enabled: parentId != null }
  );
  const { data: records = [], isLoading } = trpc.performance.list.useQuery({ projectId });

  // ── 이름 전체 보기: 개인정보 잠금이 켜져 있으면 비밀번호로 풀어야 실제 이름이 보인다 ──
  const { data: vault } = trpc.vault.status.useQuery();
  const vaultKey = useVaultKey();
  const { secrets } = useDecryptedSecrets(participants, vaultKey);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const vaultOn = !!vault?.enabled;
  const unlocked = vaultOn && !!vaultKey;
  const plainById = new Map(participants.map((p) => [p.id, p] as const));
  /** 잠금 해제 상태면 복호화한 이름(아직 잠그지 않은 기존 데이터는 저장된 원문), 아니면 화면에 온 값 그대로 */
  const fullName = (id: number, fallback: string) => {
    const sec = secrets.get(id)?.name;
    if (sec) return sec;
    const p = plainById.get(id);
    if (unlocked && p && !p.encPayload) return p.name;
    return fallback;
  };
  useEffect(() => () => lockVault(), []);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<(typeof records)[0] | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [form, setForm] = useState<RecordForm>(defaultForm);
  const [participantSearch, setParticipantSearch] = useState("");

  const createMutation = trpc.performance.create.useMutation({
    onSuccess: () => {
      utils.performance.list.invalidate();
      utils.performance.monthlyStats.invalidate();
      setIsCreateOpen(false);
      setForm(defaultForm);
      toast.success("실적이 등록되었습니다.");
    },
    onError: () => toast.error("실적 등록에 실패했습니다."),
  });

  const updateMutation = trpc.performance.update.useMutation({
    onSuccess: () => {
      utils.performance.list.invalidate();
      utils.performance.monthlyStats.invalidate();
      setEditingRecord(null);
      toast.success("실적이 수정되었습니다.");
    },
    onError: () => toast.error("실적 수정에 실패했습니다."),
  });

  const deleteMutation = trpc.performance.delete.useMutation({
    onSuccess: () => {
      utils.performance.list.invalidate();
      utils.performance.monthlyStats.invalidate();
      setDeletingId(null);
      toast.success("실적이 삭제되었습니다.");
    },
    onError: () => toast.error("실적 삭제에 실패했습니다."),
  });

  const handleOpenCreate = () => {
    setForm(defaultForm);
    setParticipantSearch("");
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (r: (typeof records)[0]) => {
    const dateStr = typeof r.recordDate === "string" ? r.recordDate : (r.recordDate as Date).toISOString().slice(0, 10);
    setForm({
      recordDate: dateStr,
      count: r.count.toString(),
      note: r.note ?? "",
      participantIds: r.participants.map((p) => p.participantId),
    });
    setParticipantSearch("");
    setEditingRecord(r);
  };

  const handleSubmit = () => {
    if (!form.recordDate) { toast.error("날짜를 입력해 주세요."); return; }
    if (!form.count || parseInt(form.count) < 1) { toast.error("횟수를 입력해 주세요."); return; }
    if (form.participantIds.length === 0) { toast.error("참여 대상자를 선택해 주세요."); return; }

    const payload = {
      recordDate: form.recordDate,
      count: parseInt(form.count),
      note: form.note || undefined,
      participantIds: form.participantIds,
    };

    if (editingRecord) {
      updateMutation.mutate({ id: editingRecord.id, ...payload });
    } else {
      createMutation.mutate({ projectId, ...payload });
    }
  };

  const toggleParticipant = (id: number) => {
    setForm((f) => ({
      ...f,
      participantIds: f.participantIds.includes(id)
        ? f.participantIds.filter((pid) => pid !== id)
        : [...f.participantIds, id],
    }));
  };

  // Sort records by date descending
  const sortedRecords = useMemo(() =>
    [...records].sort((a, b) => {
      const da = typeof a.recordDate === "string" ? a.recordDate : (a.recordDate as Date).toISOString().slice(0, 10);
      const db = typeof b.recordDate === "string" ? b.recordDate : (b.recordDate as Date).toISOString().slice(0, 10);
      return db.localeCompare(da);
    }),
    [records]
  );

  const selectedParticipants = participants.filter((p) => form.participantIds.includes(p.id));
  const selectedMale = selectedParticipants.filter((p) => p.gender === "male").length;
  const selectedFemale = selectedParticipants.filter((p) => p.gender === "female").length;

  // 검색 필터링된 참여자 목록
  const filteredParticipants = useMemo(() => {
    if (!participantSearch.trim()) return participants;
    const q = participantSearch.trim().toLowerCase();
    return participants.filter((p) => fullName(p.id, p.name).toLowerCase().includes(q));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants, participantSearch, secrets, unlocked]);

  // 현재 검색 결과에서 모두 선택되어 있는지 여부
  const isAllFilteredSelected = filteredParticipants.length > 0 &&
    filteredParticipants.every((p) => form.participantIds.includes(p.id));

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setLocation("/projects")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-[12rem]">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">실적 입력</h1>
          {project && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {project.projectName}{project.subProjectName ? ` · ${project.subProjectName}` : ""}
            </p>
          )}
        </div>
        <Button onClick={handleOpenCreate} size="sm" disabled={participants.length === 0}>
          <Plus className="h-4 w-4 mr-1.5" />
          실적 등록
        </Button>
      </div>

      {vaultOn && (
        <Card className={unlocked ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}>
          <CardContent className="p-3 flex flex-wrap items-center gap-3">
            {unlocked ? <LockOpen className="h-4 w-4 text-emerald-600 shrink-0" /> : <Lock className="h-4 w-4 text-amber-600 shrink-0" />}
            <p className={`text-sm flex-1 ${unlocked ? "text-emerald-800" : "text-amber-800"}`}>
              {unlocked
                ? "잠금이 풀려 이름이 전체로 보입니다. 3분간 쓰지 않거나 이 화면을 나가면 다시 잠깁니다."
                : "대상자 이름이 가려져 있습니다. 비밀번호로 잠금을 풀면 전체 이름이 보입니다."}
            </p>
            {unlocked
              ? <Button size="sm" variant="outline" onClick={() => lockVault()}>다시 잠그기</Button>
              : <Button size="sm" onClick={() => setUnlockOpen(true)}>이름 전체 보기</Button>}
          </CardContent>
        </Card>
      )}

      {parentId != null && participants.length === 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              실적을 입력하려면 먼저{" "}
              <button className="underline font-medium" onClick={() => setLocation(`/participants/${parentId}`)}>
                큰 사업에 대상자를 등록
              </button>
              해 주세요.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Records */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : sortedRecords.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 gap-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <CalendarDays className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              등록된 실적이 없습니다.<br />실적을 입력해 주세요.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {sortedRecords.map((record) => {
                const dateStr = typeof record.recordDate === "string" ? record.recordDate : (record.recordDate as Date).toISOString().slice(0, 10);
                const malePs = record.participants.filter((p) => p.gender === "male");
                const femalePs = record.participants.filter((p) => p.gender === "female");
                const uniqueParticipants = new Map<number, typeof record.participants[0]>();
                record.participants.forEach((p) => uniqueParticipants.set(p.participantId, p));

                return (
                  <div key={record.id} className="px-5 py-4 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                            {dateStr}
                          </div>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Hash className="h-3.5 w-3.5" />
                            {record.count}회
                          </div>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            {uniqueParticipants.size}명 참여
                          </div>
                        </div>

                        {/* Gender breakdown */}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          {malePs.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-xs border-blue-200 text-blue-600 bg-blue-50 px-1.5 py-0">남 {new Set(malePs.map(p => p.participantId)).size}명</Badge>
                            </div>
                          )}
                          {femalePs.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-xs border-rose-200 text-rose-500 bg-rose-50 px-1.5 py-0">여 {new Set(femalePs.map(p => p.participantId)).size}명</Badge>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {Array.from(uniqueParticipants.values()).map((p) => (
                              <span key={p.participantId} className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                                {fullName(p.participantId, p.name)}
                              </span>
                            ))}
                          </div>
                        </div>

                        {record.note && (
                          <p className="text-xs text-muted-foreground mt-1.5 italic">{record.note}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleOpenEdit(record)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeletingId(record.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen || !!editingRecord} onOpenChange={(open) => {
        if (!open) { setIsCreateOpen(false); setEditingRecord(null); }
      }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRecord ? "실적 수정" : "실적 등록"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="recordDate">진행 날짜 <span className="text-destructive">*</span></Label>
                <Input
                  id="recordDate"
                  type="date"
                  value={form.recordDate}
                  onChange={(e) => setForm((f) => ({ ...f, recordDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="count">횟수 <span className="text-destructive">*</span></Label>
                <Input
                  id="count"
                  type="number"
                  min={1}
                  value={form.count}
                  onChange={(e) => setForm((f) => ({ ...f, count: e.target.value }))}
                />
              </div>
            </div>

            {/* Participants Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>참여 대상자 <span className="text-destructive">*</span></Label>
                {form.participantIds.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-blue-600 font-medium">남 {selectedMale}명</span>
                    <span className="text-rose-500 font-medium">여 {selectedFemale}명</span>
                    <span className="text-muted-foreground">선택 {form.participantIds.length}명</span>
                  </div>
                )}
              </div>

              {/* 검색 입력 */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="이름으로 검색..."
                  value={participantSearch}
                  onChange={(e) => setParticipantSearch(e.target.value)}
                  className="pl-8 pr-8 h-8 text-sm"
                />
                {participantSearch && (
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setParticipantSearch("")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* 선택 조작 버튼 */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 flex-1"
                  onClick={() => {
                    if (isAllFilteredSelected) {
                      // 현재 필터 결과에서 모두 해제
                      const filteredIds = new Set(filteredParticipants.map((p) => p.id));
                      setForm((f) => ({ ...f, participantIds: f.participantIds.filter((id) => !filteredIds.has(id)) }));
                    } else {
                      // 현재 필터 결과 모두 선택
                      const filteredIds = filteredParticipants.map((p) => p.id);
                      setForm((f) => ({ ...f, participantIds: Array.from(new Set([...f.participantIds, ...filteredIds])) }));
                    }
                  }}
                >
                  {isAllFilteredSelected
                    ? participantSearch ? `검색 결과 해제 (${filteredParticipants.length})` : "전체 해제"
                    : participantSearch ? `검색 결과 선택 (${filteredParticipants.length})` : "전체 선택"
                  }
                </Button>
                {form.participantIds.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 text-muted-foreground"
                    onClick={() => setForm((f) => ({ ...f, participantIds: [] }))}
                  >
                    전체 해제
                  </Button>
                )}
              </div>

              {/* 참여자 목록 */}
              <div className="border rounded-lg divide-y max-h-52 overflow-y-auto">
                {participants.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 text-center">등록된 대상자가 없습니다.</p>
                ) : filteredParticipants.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 text-center">검색 결과가 없습니다.</p>
                ) : (
                  filteredParticipants.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                        form.participantIds.includes(p.id) ? "bg-primary/5" : "hover:bg-muted/30"
                      }`}
                      onClick={() => toggleParticipant(p.id)}
                    >
                      <Checkbox
                        checked={form.participantIds.includes(p.id)}
                        onCheckedChange={() => toggleParticipant(p.id)}
                      />
                      <span className="text-sm flex-1">{fullName(p.id, p.name)}</span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${p.gender === "male" ? "border-blue-200 text-blue-600 bg-blue-50" : "border-rose-200 text-rose-500 bg-rose-50"}`}
                      >
                        {p.gender === "male" ? "남" : "여"}
                      </Badge>
                    </div>
                  ))
                )}
              </div>

              {/* 선택된 사람 태그 표시 */}
              {selectedParticipants.length > 0 && (
                <div className="flex flex-wrap gap-1 p-2 bg-muted/20 rounded-lg border border-dashed">
                  {selectedParticipants.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleParticipant(p.id)}
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        p.gender === "male"
                          ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                          : "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                      }`}
                    >
                      {fullName(p.id, p.name)}
                      <X className="h-2.5 w-2.5" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="note">메모 (선택)</Label>
              <Textarea
                id="note"
                placeholder="진행 관련 메모를 입력하세요"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                rows={2}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); setEditingRecord(null); }}>취소</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "저장 중..." : editingRecord ? "수정" : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>실적을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deletingId) deleteMutation.mutate({ id: deletingId }); }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <VaultUnlockDialog
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        meta={vault?.enabled ? { salt: vault.salt, iterations: vault.iterations, verifier: vault.verifier } : null}
        onForgot={() => setResetOpen(true)}
      />
      <VaultResetDialog open={resetOpen} onOpenChange={setResetOpen} />
    </div>
  );
}
