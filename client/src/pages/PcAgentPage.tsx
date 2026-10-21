import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, Sparkles, Terminal, FolderOpen, FileText, Copy } from "lucide-react";

type Op =
  | { op: "shell"; cmd: string }
  | { op: "ls"; path: string }
  | { op: "read"; path: string };

export default function PcAgentPage() {
  const utils = trpc.useUtils();
  const status = trpc.pcAgent.status.useQuery(undefined, { refetchInterval: 4000 });
  const logs = trpc.pcAgent.log.useQuery();
  const [token, setToken] = useState<string | null>(null);
  const [goal, setGoal] = useState("");
  const [cmd, setCmd] = useState("");
  const [explain, setExplain] = useState("");
  const [path, setPath] = useState(".");
  const [result, setResult] = useState("");

  const create = trpc.pcAgent.createToken.useMutation({
    onSuccess: (r) => { setToken(r.token); utils.pcAgent.status.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const revoke = trpc.pcAgent.revokeToken.useMutation({
    onSuccess: () => { setToken(null); toast.success("연결을 끊고 코드를 폐기했습니다."); utils.pcAgent.status.invalidate(); },
  });
  const run = trpc.pcAgent.run.useMutation({
    onSuccess: (r) => { setResult(r.ok ? r.output || "(출력 없음)" : `실패: ${r.error}\n${r.output}`); utils.pcAgent.log.invalidate(); },
    onError: (e) => setResult(`실패: ${e.message}`),
  });
  const plan = trpc.pcAgent.plan.useMutation({
    onSuccess: (r) => { setCmd(r.cmd); setExplain(r.explain); },
    onError: (e) => toast.error(e.message),
  });

  const st = status.data;
  const connected = !!st?.connected;
  const origin = typeof window !== "undefined" ? window.location.origin.replace(/^http/, "ws") : "";
  const startCmd = `node pc-agent.mjs --server ${origin} --token ${token ?? "연결코드"} --root "C:\\작업폴더" --auto-read`;
  const exec = (o: Op) => { setResult("PC에서 승인을 기다리는 중… (PC 화면의 질문에 y)"); run.mutate(o); };
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast.success("복사했습니다."));

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Monitor className="h-5 w-5" />
        <h1 className="text-xl font-bold">내 PC 연결 (관리자)</h1>
        <Badge variant={connected ? "default" : "secondary"}>{connected ? "연결됨" : "연결 안 됨"}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. 연결하기</CardTitle>
          <CardDescription>
            내 PC에서 도우미 프로그램을 직접 실행했을 때만 연결됩니다(Node.js 22 이상 필요). 사이트가 보낸 작업은 PC 화면에서 <b>y를 눌러 승인</b>해야 실행되고, 창을 닫으면 연결도 끝납니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {connected && st?.connected && (
            <p className="rounded-md bg-emerald-50 p-2 text-emerald-800">
              {st.info.hostname} ({st.info.platform}) · 작업 폴더 {st.info.root}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm"><a href="/api/admin/pc-agent.mjs">도우미 프로그램 받기</a></Button>
            <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending}>{st?.hasToken ? "연결 코드 다시 만들기" : "연결 코드 만들기"}</Button>
            {st?.hasToken && <Button size="sm" variant="destructive" onClick={() => revoke.mutate()}>연결 끊고 코드 폐기</Button>}
          </div>
          {token && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">연결 코드는 지금 한 번만 보입니다. PC에서 아래처럼 실행하세요(작업 폴더는 원하는 곳으로).</p>
              <div className="flex gap-2">
                <Input readOnly value={startCmd} className="font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={() => copy(startCmd)}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1 text-base"><Sparkles className="h-4 w-4" />2. AI에게 시키기</CardTitle>
          <CardDescription>하고 싶은 일을 적으면 AI가 명령을 제안합니다. 내용을 확인·수정한 뒤 직접 실행하세요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="예) 작업 폴더에 있는 .xlsx 파일 목록을 최근 수정순으로 보여줘" rows={2} />
          <Button size="sm" disabled={!connected || goal.trim().length < 2 || plan.isPending} onClick={() => plan.mutate({ goal })}>{plan.isPending ? "생각 중…" : "명령 제안받기"}</Button>
          {explain && <p className="text-sm text-muted-foreground">{explain}</p>}
          <Textarea value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder="실행할 명령" rows={2} className="font-mono text-xs" />
          <Button size="sm" disabled={!connected || !cmd.trim() || run.isPending} onClick={() => exec({ op: "shell", cmd })}><Terminal className="mr-1 h-4 w-4" />PC에서 실행(승인 필요)</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">3. 폴더·파일 직접 보기</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="작업 폴더 기준 경로" />
            <Button size="sm" variant="outline" disabled={!connected || run.isPending} onClick={() => exec({ op: "ls", path })}><FolderOpen className="mr-1 h-4 w-4" />폴더</Button>
            <Button size="sm" variant="outline" disabled={!connected || run.isPending} onClick={() => exec({ op: "read", path })}><FileText className="mr-1 h-4 w-4" />읽기</Button>
          </div>
          {result && <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{result}</pre>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">최근 작업 기록</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-xs">
          {(logs.data ?? []).length === 0 && <p className="text-muted-foreground">아직 없습니다.</p>}
          {(logs.data ?? []).map((l) => (
            <div key={l.id} className="flex gap-2 border-b py-1">
              <span className="shrink-0 text-muted-foreground">{new Date(l.createdAt).toLocaleString("ko-KR")}</span>
              <span className="flex-1 break-all">{l.summary}</span>
              <span className={l.ok ? "text-emerald-600" : "text-rose-600"}>{l.ok ? "성공" : "실패"}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
