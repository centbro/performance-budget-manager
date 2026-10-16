import { trpc } from "@/lib/trpc";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import AccessDialog, { accessLabel } from "@/components/AccessDialog";
import AdminUsageCard from "@/components/AdminUsageCard";
import { PLANS } from "@shared/plans";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CheckCircle, XCircle, Trash2, Users, Clock, UserCheck, UserX, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminPage() {
  const { user, isLoading, isAdmin } = useLocalAuth();
  const [, setLocation] = useLocation();
  const planMutation = trpc.plan.adminSetPlan.useMutation({
    onSuccess: () => { toast.success("요금제를 변경했습니다."); utils.localAuth.adminListUsers.invalidate(); },
    onError: (e) => toast.error(e.message || "변경에 실패했습니다."),
  });
  const [accessTarget, setAccessTarget] = useState<{ id: number; name: string; accessUntil?: Date | string | null } | null>(null);

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      setLocation("/");
    }
  }, [isLoading, user, isAdmin, setLocation]);

  const utils = trpc.useUtils();
  const { data: users = [], isLoading: usersLoading } = trpc.localAuth.adminListUsers.useQuery(undefined, {
    enabled: !!user && isAdmin,
  });

  const approveMutation = trpc.localAuth.adminApprove.useMutation({
    onSuccess: () => {
      toast.success("사용자를 승인했습니다.");
      utils.localAuth.adminListUsers.invalidate();
    },
    onError: () => toast.error("승인에 실패했습니다."),
  });

  const rejectMutation = trpc.localAuth.adminReject.useMutation({
    onSuccess: () => {
      toast.success("사용자를 거부했습니다.");
      utils.localAuth.adminListUsers.invalidate();
    },
    onError: () => toast.error("거부에 실패했습니다."),
  });

  const deleteMutation = trpc.localAuth.adminDelete.useMutation({
    onSuccess: () => {
      toast.success("사용자를 삭제했습니다.");
      utils.localAuth.adminListUsers.invalidate();
    },
    onError: () => toast.error("삭제에 실패했습니다."),
  });

  const roleUpdateMutation = trpc.localAuth.adminUpdateRole.useMutation({
    onSuccess: () => {
      toast.success("역할을 변경했습니다.");
      utils.localAuth.adminListUsers.invalidate();
    },
    onError: () => toast.error("역할 변경에 실패했습니다."),
  });

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const pending = users.filter((u) => u.status === "pending");
  const approved = users.filter((u) => u.status === "approved");
  const rejected = users.filter((u) => u.status === "rejected");

  const statusBadge = (status: string) => {
    if (status === "pending") return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />승인 대기</Badge>;
    if (status === "approved") return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1"><UserCheck className="h-3 w-3" />승인됨</Badge>;
    if (status === "rejected") return <Badge variant="destructive" className="gap-1"><UserX className="h-3 w-3" />거부됨</Badge>;
    return null;
  };

  const roleBadge = (role: string) => {
    if (role === "admin") return <Badge className="bg-primary/10 text-primary border-primary/20 gap-1"><ShieldCheck className="h-3 w-3" />관리자</Badge>;
    return <Badge variant="outline" className="gap-1"><Users className="h-3 w-3" />일반</Badge>;
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">사용자 관리</h1>
        <p className="text-sm text-muted-foreground mt-1">가입 요청 승인 및 사용자 계정을 관리합니다</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">승인 대기</p>
              <p className="text-xl font-bold text-foreground">{pending.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <UserCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">승인된 사용자</p>
              <p className="text-xl font-bold text-foreground">{approved.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
              <UserX className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">거부된 사용자</p>
              <p className="text-xl font-bold text-foreground">{rejected.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 승인 대기 목록 */}
      {pending.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-amber-700">
              <Clock className="h-4 w-4" />
              승인 대기 중 ({pending.length}명)
            </CardTitle>
            <CardDescription>새로운 가입 요청을 검토하고 승인 또는 거부하세요</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>요청일</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(u.createdAt).toLocaleDateString("ko-KR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 gap-1"
                          onClick={() => approveMutation.mutate({ userId: u.id })}
                          disabled={approveMutation.isPending}
                        >
                          <CheckCircle className="h-3 w-3" />
                          승인
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs gap-1"
                          onClick={() => rejectMutation.mutate({ userId: u.id })}
                          disabled={rejectMutation.isPending}
                        >
                          <XCircle className="h-3 w-3" />
                          거부
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 전체 사용자 목록 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            전체 사용자 목록
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>역할</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>요금제</TableHead>
                  <TableHead>이용 기간</TableHead>
                  <TableHead>가입일</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                    <TableCell>{roleBadge(u.role)}</TableCell>
                    <TableCell>{statusBadge(u.status)}</TableCell>
                    <TableCell className="text-sm">
                      {u.role === "admin" ? <span className="text-muted-foreground">-</span> : (
                        <select
                          className="h-7 rounded border bg-background px-1 text-xs"
                          value={u.plan === "premium" ? "premium" : "pro"}
                          onChange={(e) => planMutation.mutate({ userId: u.id, plan: e.target.value as "pro" | "premium" })}
                        >
                          <option value="pro">{PLANS.pro.label}</option>
                          <option value="premium">{PLANS.premium.label}</option>
                        </select>
                      )}
                    </TableCell>
                    <TableCell className={`text-sm ${u.role === "admin" ? "text-muted-foreground" : accessLabel(u.accessUntil).cls}`}>
                      {u.role === "admin" ? "-" : accessLabel(u.accessUntil).text}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(u.createdAt).toLocaleDateString("ko-KR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {u.status === "approved" && u.role !== "admin" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAccessTarget({ id: u.id, name: u.name, accessUntil: u.accessUntil })}>
                            기간 설정
                          </Button>
                        )}
                        {u.status === "pending" && (
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 gap-1"
                            onClick={() => approveMutation.mutate({ userId: u.id })}
                            disabled={approveMutation.isPending}
                          >
                            <CheckCircle className="h-3 w-3" />
                            승인
                          </Button>
                        )}
                        {u.status === "approved" && u.email !== "link4wish@gmail.com" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() =>
                              roleUpdateMutation.mutate({
                                userId: u.id,
                                role: u.role === "admin" ? "user" : "admin",
                              })
                            }
                            disabled={roleUpdateMutation.isPending}
                          >
                            <ShieldCheck className="h-3 w-3" />
                            {u.role === "admin" ? "일반으로" : "관리자로"}
                          </Button>
                        )}
                        {u.email !== "link4wish@gmail.com" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                              >
                                <Trash2 className="h-3 w-3" />
                                삭제
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>사용자 삭제</AlertDialogTitle>
                                <AlertDialogDescription>
                                  <strong>{u.name}</strong>({u.email}) 계정을 삭제하시겠습니까?<br />
                                  이 작업은 되돌릴 수 없습니다.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive hover:bg-destructive/90"
                                  onClick={() => deleteMutation.mutate({ userId: u.id })}
                                >
                                  삭제
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    <AdminUsageCard />
    <AccessDialog user={accessTarget} onClose={() => setAccessTarget(null)} />
    </div>
  );
}
