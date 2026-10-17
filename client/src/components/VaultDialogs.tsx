import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Lock, ShieldCheck, TriangleAlert } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { createVault, unlockVault, validateVaultPassword, VAULT_MIN_PASSWORD, type VaultMeta } from "@shared/vaultCrypto";
import { setVaultKey } from "@/lib/vault";

/** 처음 잠금 비밀번호 만들기 */
export function VaultSetupDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  const utils = trpc.useUtils();
  const setup = trpc.vault.setup.useMutation();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);

  const close = (o: boolean) => { if (!o) { setPw(""); setPw2(""); setAck(false); } onOpenChange(o); };
  const submit = async () => {
    const err = validateVaultPassword(pw);
    if (err) return toast.error(err);
    if (pw !== pw2) return toast.error("비밀번호 확인이 일치하지 않습니다.");
    if (!ack) return toast.error("안내 사항에 동의해 주세요.");
    setBusy(true);
    try {
      const { meta, key } = await createVault(pw);
      await setup.mutateAsync(meta);
      await utils.vault.status.invalidate();
      setVaultKey(key);
      toast.success("잠금이 설정되었습니다.");
      close(false);
      onDone?.();
    } catch (e: any) {
      toast.error(e?.message ?? "잠금 설정에 실패했습니다.");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" />개인정보 잠금 설정</DialogTitle>
          <DialogDescription>대상자의 이름·전화번호·생년월일을 이 비밀번호로 암호화해 저장합니다. 서버(운영자 포함)는 비밀번호를 알 수 없어 내용을 볼 수 없습니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="v-pw">잠금 비밀번호 ({VAULT_MIN_PASSWORD}자 이상)</Label>
            <Input id="v-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-pw2">비밀번호 확인</Label>
            <Input id="v-pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </div>
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
            <p className="flex items-center gap-1.5 font-medium"><TriangleAlert className="h-3.5 w-3.5" />꼭 읽어 주세요</p>
            <p>비밀번호를 잊으면 <b>누구도 이름·전화번호를 복구할 수 없습니다.</b> 운영자도 불가능합니다. 이 경우 초기화하면 가려진 이름(김*수)만 남습니다.</p>
            <p>로그인 비밀번호와 다른 값으로 정하고, 안전한 곳에 따로 적어 두세요.</p>
          </div>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="mt-1" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            <span>비밀번호를 잊으면 복구할 수 없다는 점을 이해했습니다.</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>취소</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "설정 중..." : "잠금 설정"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 비밀번호를 입력해 잠금 해제 */
export function VaultUnlockDialog({ open, onOpenChange, meta, onUnlocked, onForgot }: {
  open: boolean; onOpenChange: (o: boolean) => void; meta: VaultMeta | null; onUnlocked?: () => void; onForgot?: () => void;
}) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);
  const close = (o: boolean) => { if (!o) { setPw(""); setWrong(false); } onOpenChange(o); };
  const submit = async () => {
    if (!meta || !pw) return;
    setBusy(true); setWrong(false);
    try {
      const key = await unlockVault(pw, meta);
      if (!key) { setWrong(true); return; }
      setVaultKey(key);
      onUnlocked?.();
      close(false);
    } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Lock className="h-5 w-5" />잠금 해제</DialogTitle>
          <DialogDescription>비밀번호를 입력하면 이 화면에서만 이름·전화번호가 보입니다. 3분 동안 쓰지 않으면 다시 잠깁니다.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-2">
          <Input type="password" autoFocus autoComplete="off" placeholder="잠금 비밀번호" value={pw} onChange={(e) => { setPw(e.target.value); setWrong(false); }} />
          {wrong && <p className="text-xs text-destructive">비밀번호가 맞지 않습니다.</p>}
          {onForgot && (
            <button type="button" className="text-xs text-muted-foreground underline" onClick={() => { close(false); onForgot(); }}>비밀번호를 잊으셨나요?</button>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>취소</Button>
          <Button onClick={submit} disabled={busy || !pw}>{busy ? "확인 중..." : "해제"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 비밀번호를 잊었을 때 초기화 */
export function VaultResetDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const utils = trpc.useUtils();
  const reset = trpc.vault.reset.useMutation();
  const [text, setText] = useState("");
  const close = (o: boolean) => { if (!o) setText(""); onOpenChange(o); };
  const submit = async () => {
    try {
      await reset.mutateAsync({ confirm: "초기화" });
      await utils.vault.status.invalidate();
      await utils.participants.list.invalidate();
      toast.success("초기화했습니다. 이름·전화번호는 가려진 값만 남았습니다.");
      close(false);
    } catch (e: any) { toast.error(e?.message ?? "초기화에 실패했습니다."); }
  };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-destructive">잠금 초기화</DialogTitle>
          <DialogDescription>암호화된 <b>이름·전화번호·생년월일은 영구히 삭제</b>되고 '김*수', '010-****-5678' 같은 가려진 값만 남습니다. 되돌릴 수 없습니다. 이후 새 비밀번호로 다시 설정할 수 있습니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="v-reset">계속하려면 <b>초기화</b> 를 입력하세요</Label>
          <Input id="v-reset" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>취소</Button>
          <Button variant="destructive" onClick={submit} disabled={text !== "초기화" || reset.isPending}>초기화</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
