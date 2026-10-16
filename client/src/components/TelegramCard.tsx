import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Link2Off, Send } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

/** 텔레그램 봇 연결: 코드를 받아 봇에 입력하면 이 계정과 연결된다 */
export default function TelegramCard() {
  const utils = trpc.useUtils();
  const status = trpc.telegram.status.useQuery(undefined, { refetchInterval: (q) => (q.state.data?.linked ? false : 5000) });
  const [issued, setIssued] = useState<{ code: string; minutes: number; botUsername: string; at: number } | null>(null);
  const [left, setLeft] = useState(0);
  const create = trpc.telegram.createCode.useMutation({
    onSuccess: (r) => setIssued({ ...r, at: Date.now() }),
    onError: (e) => toast.error(e.message || "코드를 만들지 못했습니다."),
  });
  const unlink = trpc.telegram.unlink.useMutation({
    onSuccess: () => { toast.success("연결을 해제했습니다."); setIssued(null); utils.telegram.status.invalidate(); },
  });
  useEffect(() => {
    if (!issued) return;
    const t = setInterval(() => setLeft(Math.max(0, issued.minutes * 60 - Math.floor((Date.now() - issued.at) / 1000))), 1000);
    setLeft(issued.minutes * 60);
    return () => clearInterval(t);
  }, [issued]);

  const s = status.data;
  if (!s || !s.enabled) return null;
  const bot = issued?.botUsername || s.botUsername;
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); toast.success("복사했습니다."); } catch { toast.error("복사에 실패했습니다."); } };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" />텔레그램으로 쓰기</CardTitle>
        <CardDescription>일정 추가·조회, 홍보글 작성, 다국어 번역, 월 실적 요약을 텔레그램 대화로 할 수 있습니다. 참여자 이름·연락처·상담 내용은 보내지 마세요.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {s.linked ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-sm min-w-0">연결됨{s.username ? ` · @${s.username}` : ""} <span className="text-muted-foreground">— 텔레그램에서 /도움말 을 보내 보세요.</span></p>
            <Button variant="outline" size="sm" onClick={() => window.confirm("텔레그램 연결을 해제할까요?") && unlink.mutate()} disabled={unlink.isPending}><Link2Off className="h-4 w-4 mr-1" />연결 해제</Button>
          </div>
        ) : issued && left > 0 ? (
          <div className="space-y-2 text-sm">
            <ol className="list-decimal pl-5 space-y-1">
              <li>텔레그램에서 {bot ? <b>@{bot}</b> : "복지실무톡 봇"} 을 찾아 대화를 시작하세요.</li>
              <li>아래 명령을 그대로 보내세요.</li>
            </ol>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 text-base tracking-wider break-all">/연결 {issued.code}</code>
              <Button variant="outline" size="icon" onClick={() => copy(`/연결 ${issued.code}`)}><Copy className="h-4 w-4" /></Button>
            </div>
            <p className="text-xs text-muted-foreground">{Math.floor(left / 60)}분 {String(left % 60).padStart(2, "0")}초 안에 입력해 주세요. 연결되면 이 화면이 자동으로 바뀝니다.</p>
          </div>
        ) : (
          <Button onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending && <Spinner className="w-4 h-4 mr-2" />}텔레그램 연결하기</Button>
        )}
      </CardContent>
    </Card>
  );
}
