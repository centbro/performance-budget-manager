import { useState } from "react";
import { toast } from "sonner";
import { MessageSquareText, Sparkles, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Row = { title: string; startDate: string; endDate: string; description: string; projectId: string; color: string };
const COLORS: Record<string, string> = { blue: "bg-blue-500", green: "bg-green-500", red: "bg-red-500", orange: "bg-orange-500", purple: "bg-purple-500", pink: "bg-pink-500" };

/** 대화체로 적으면 일정으로 정리해 미리 보여 주고, 확인하면 한 번에 등록 */
export default function ScheduleChatDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);

  const parse = trpc.schedules.parseChat.useMutation({
    onSuccess: (d) => {
      setProjects(d.projects);
      // 사업이 하나뿐이면, 사업/개인 구분이 애매한 일정은 그 사업으로 우선 선택(수정 가능)
      const only = d.projects.length === 1 ? String(d.projects[0].id) : "";
      setRows(d.items.map((i) => ({ ...i, projectId: i.projectId === null ? only : String(i.projectId) })));
    },
    onError: (e) => toast.error(e.message || "정리하지 못했습니다."),
  });
  const create = trpc.schedules.createMany.useMutation({
    onSuccess: (d) => {
      toast.success(`일정 ${d.count}건을 등록했습니다.`);
      setText(""); setRows([]);
      onOpenChange(false);
      onDone();
    },
    onError: (e) => toast.error(e.message || "등록에 실패했습니다."),
  });

  const patch = (i: number, p: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const submit = () => {
    if (rows.some((r) => r.projectId === "")) return toast.error("사업 또는 개인 업무를 선택하지 않은 일정이 있습니다.");
    if (rows.some((r) => !r.title.trim())) return toast.error("일정명이 비어 있는 항목이 있습니다.");
    create.mutate({
      items: rows.map((r) => ({
        projectId: Number(r.projectId), title: r.title.trim(), description: r.description || undefined,
        startDate: r.startDate, endDate: r.endDate < r.startDate ? r.startDate : r.endDate, color: r.color,
      })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><MessageSquareText className="w-5 h-5" />대화로 일정 추가</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[110px] text-sm"
            placeholder={"말하듯이 적어 주세요. 여러 개를 한꺼번에 적어도 됩니다.\n예) 다음 주 화요일 오후 2시에 명랑운동회 준비회의, 11월 8일 토요일 운동회 본행사, 11월 20일까지 결과보고서 제출"}
          />
          <Button onClick={() => text.trim() ? parse.mutate({ text: text.trim() }) : toast.error("내용을 적어 주세요.")} disabled={parse.isPending}>
            {parse.isPending ? <Spinner className="w-4 h-4 mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {parse.isPending ? "정리 중…" : "일정으로 정리"}
          </Button>

          {rows.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              <p className="text-sm font-medium">이렇게 등록할까요? (잘못된 칸은 바로 고칠 수 있어요)</p>
              {rows.map((r, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-full shrink-0 ${COLORS[r.color] ?? COLORS.blue}`} />
                    <Input value={r.title} onChange={(e) => patch(i, { title: e.target.value })} className="font-medium" />
                    <Button variant="ghost" size="icon" title="이 일정 빼기" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[150px_150px_1fr]">
                    <Input type="date" value={r.startDate} onChange={(e) => patch(i, { startDate: e.target.value, endDate: r.endDate < e.target.value ? e.target.value : r.endDate })} />
                    <Input type="date" value={r.endDate} onChange={(e) => patch(i, { endDate: e.target.value })} />
                    <Select value={r.projectId} onValueChange={(v) => patch(i, { projectId: v })}>
                      <SelectTrigger className={r.projectId !== "" ? "" : "border-destructive"}><SelectValue placeholder="사업 또는 개인 업무 선택" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">개인 업무 (사업 없음)</SelectItem>
                        {projects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input value={r.description} onChange={(e) => patch(i, { description: e.target.value })} placeholder="메모(시간·장소 등)" className="text-sm" />
                </div>
              ))}
              {projects.length === 0 && <p className="text-sm text-muted-foreground">등록된 사업이 없어 개인 업무로만 등록할 수 있습니다.</p>}
            </div>
          )}
        </div>
        {rows.length > 0 && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setRows([])}>다시 쓰기</Button>
            <Button onClick={submit} disabled={create.isPending}>{create.isPending ? <Spinner className="w-4 h-4 mr-2" /> : null}일정 {rows.length}건 등록</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
