import { useState } from "react";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** 참여자 전체 정보를 비밀번호로 잠근 엑셀로 내려받는다. 화면에는 가려진 값만 보이고, 전체는 이 파일에서만 확인한다. */
export default function EncryptedExportDialog({ open, onOpenChange, projectId }: { open: boolean; onOpenChange: (v: boolean) => void; projectId: number }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const reset = () => { setPw(""); setPw2(""); };

  const submit = async () => {
    if (pw.length < 8) return toast.error("비밀번호는 8자 이상으로 정해 주세요.");
    if (pw !== pw2) return toast.error("비밀번호 확인이 일치하지 않습니다.");
    setBusy(true);
    try {
      const res = await fetch("/api/export/participants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId, password: pw }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || "내려받지 못했습니다.");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") ?? "";
      const m = cd.match(/filename\*=UTF-8''([^;]+)/);
      const name = m ? decodeURIComponent(m[1]) : "참여자명단_암호화.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
      toast.success("내려받았습니다. 엑셀에서 열 때 방금 정한 비밀번호를 입력하세요.");
      reset();
      onOpenChange(false);
    } catch {
      toast.error("내려받지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Lock className="w-4 h-4" />암호 엑셀로 내려받기</DialogTitle>
          <DialogDescription>이름·연락처 등 전체 정보가 들어 있는 엑셀을 비밀번호로 잠가서 내려받습니다. 화면에서는 가려진 값만 보입니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="xp1">엑셀 비밀번호 (8자 이상)</Label>
            <Input id="xp1" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} maxLength={64} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="xp2">비밀번호 확인</Label>
            <Input id="xp2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} maxLength={64} onKeyDown={(e) => { if (e.key === "Enter" && !busy) submit(); }} />
          </div>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
            <li>이 비밀번호는 서버에 저장되지 않습니다. 잊으면 파일을 열 수 없고 복구할 수 없어요.</li>
            <li>로그인 비밀번호와 다른 것을 쓰세요. 파일을 메일이나 메신저로 보낼 때는 비밀번호를 따로 전달하세요.</li>
            <li>엑셀 프로그램에서 파일을 열면 비밀번호를 물어봅니다. 한글·웹 뷰어 등 일부 프로그램은 열지 못할 수 있습니다.</li>
          </ul>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>취소</Button>
          <Button onClick={submit} disabled={busy}>{busy && <Spinner className="w-4 h-4 mr-1" />}내려받기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
