import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { accessInfo, kstDateString } from "@shared/access";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function accessLabel(until: Date | string | null | undefined) {
  const i = accessInfo(until);
  if (i.state === "unlimited") return { text: "무제한", cls: "text-muted-foreground" };
  if (i.state === "expired") return { text: `만료 (${i.until})`, cls: "text-rose-600 font-medium" };
  return { text: `D-${i.daysLeft} (~${i.until})`, cls: i.warn ? "text-amber-600 font-medium" : "" };
}

/** 관리자: 사용자의 이용 기간 설정(연장 / 날짜 지정 / 무제한) */
export default function AccessDialog({ user, onClose }: { user: { id: number; name: string; accessUntil?: Date | string | null } | null; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [date, setDate] = useState("");
  useEffect(() => {
    setDate(user?.accessUntil ? kstDateString(new Date(user.accessUntil)) : "");
  }, [user]);
  const mut = trpc.localAuth.adminSetAccess.useMutation({
    onSuccess: () => { toast.success("이용 기간을 저장했습니다."); utils.localAuth.adminListUsers.invalidate(); onClose(); },
    onError: (e) => toast.error(e.message || "저장에 실패했습니다."),
  });
  if (!user) return null;
  const cur = accessLabel(user.accessUntil);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{user.name} · 이용 기간</DialogTitle>
          <DialogDescription>현재: <span className={cur.cls}>{cur.text}</span></DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">현재 만료일(지났다면 오늘)부터 연장</p>
            <div className="flex flex-wrap gap-2">
              {[30, 90, 180, 365].map((d) => (
                <Button key={d} variant="outline" size="sm" disabled={mut.isPending} onClick={() => mut.mutate({ userId: user.id, mode: "extend", days: d })}>+{d}일</Button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">만료일 직접 지정</p>
            <div className="flex gap-2">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Button disabled={!date || mut.isPending} onClick={() => mut.mutate({ userId: user.id, mode: "date", date })}>저장</Button>
            </div>
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" disabled={mut.isPending} onClick={() => mut.mutate({ userId: user.id, mode: "unlimited" })}>무제한으로</Button>
          <Button variant="outline" onClick={onClose}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
