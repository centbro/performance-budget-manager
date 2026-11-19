import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";

const pad = (n: number) => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

type Filter = "all" | "open" | "done";

function dueLabel(due: string | null, done: boolean) {
  if (!due) return null;
  const t = todayStr();
  const md = `${Number(due.slice(5, 7))}/${Number(due.slice(8, 10))}`;
  if (done) return { text: md, cls: "bg-muted text-muted-foreground" };
  if (due < t) return { text: `${md} 기한 지남`, cls: "bg-red-100 text-red-700" };
  if (due === t) return { text: "오늘까지", cls: "bg-amber-100 text-amber-700" };
  return { text: `${md}까지`, cls: "bg-muted text-muted-foreground" };
}

export default function TodoPage() {
  const utils = trpc.useUtils();
  const { data: todos = [], isLoading } = trpc.todos.list.useQuery();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editId, setEditId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDue, setEditDue] = useState("");

  const refresh = () => utils.todos.list.invalidate();
  const onError = () => toast.error("저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  const addMut = trpc.todos.add.useMutation({ onSuccess: () => { setTitle(""); refresh(); }, onError });
  const updMut = trpc.todos.update.useMutation({ onSuccess: refresh, onError });
  const delMut = trpc.todos.delete.useMutation({ onSuccess: refresh, onError });
  const clearMut = trpc.todos.clearDone.useMutation({ onSuccess: () => { refresh(); toast.success("완료한 항목을 지웠습니다."); }, onError });

  const total = todos.length;
  const doneCount = todos.filter((t) => t.done).length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const overdue = todos.filter((t) => !t.done && t.dueDate && t.dueDate < todayStr()).length;

  const shown = useMemo(() => {
    const list = todos.filter((t) => (filter === "all" ? true : filter === "open" ? !t.done : t.done));
    // 미완료 먼저, 기한 빠른 순(기한 없음은 뒤), 같으면 등록순
    return [...list].sort((a, b) => Number(a.done) - Number(b.done) || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.id - b.id);
  }, [todos, filter]);

  const add = () => {
    if (!title.trim()) return;
    addMut.mutate({ title: title.trim(), dueDate: due || null });
  };
  const saveEdit = () => {
    if (editId == null) return;
    if (!editTitle.trim()) return toast.error("내용을 입력해 주세요.");
    updMut.mutate({ id: editId, title: editTitle.trim(), dueDate: editDue || null });
    setEditId(null);
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-bold">할 일</h1>
        <p className="text-sm text-muted-foreground">해야 할 일을 적고 끝낼 때마다 체크하세요. 진행률이 자동으로 계산됩니다.</p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-3xl font-bold">{pct}%</span>
              <span className="ml-2 text-sm text-muted-foreground">{total ? `${total}개 중 ${doneCount}개 완료` : "아직 등록한 할 일이 없습니다"}</span>
            </div>
            {overdue > 0 && <span className="text-xs rounded-full bg-red-100 text-red-700 px-2 py-0.5">기한 지난 일 {overdue}개</span>}
          </div>
          <Progress value={pct} className="h-2.5" />
          {total > 0 && doneCount === total && <p className="text-sm text-green-600">모두 끝냈습니다. 수고하셨어요!</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2">
          <Input className="flex-1 min-w-[200px]" placeholder="할 일을 입력하고 Enter" value={title} maxLength={200}
            onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && add()} />
          <Input type="date" className="w-40" value={due} onChange={(e) => setDue(e.target.value)} title="기한(선택)" />
          <Button onClick={add} disabled={addMut.isPending || !title.trim()}><Plus className="w-4 h-4 mr-1" />추가</Button>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {([["all", "전체"], ["open", "진행 중"], ["done", "완료"]] as [Filter, string][]).map(([k, label]) => (
            <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>{label}</Button>
          ))}
        </div>
        {doneCount > 0 && (
          <Button size="sm" variant="ghost" className="text-muted-foreground"
            onClick={() => { if (window.confirm(`완료한 ${doneCount}개를 목록에서 지울까요?`)) clearMut.mutate(); }}>
            완료 항목 비우기
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        {isLoading && <p className="text-sm text-muted-foreground py-6 text-center">불러오는 중...</p>}
        {!isLoading && shown.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-lg">
            {total === 0 ? "위 입력칸에 첫 할 일을 적어 보세요." : "해당하는 항목이 없습니다."}
          </p>
        )}
        {shown.map((t) => {
          const dl = dueLabel(t.dueDate, t.done);
          const editing = editId === t.id;
          return (
            <div key={t.id} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
              <Checkbox checked={t.done} onCheckedChange={(v) => updMut.mutate({ id: t.id, done: v === true })} className="h-5 w-5" />
              {editing ? (
                <>
                  <Input className="flex-1 h-8" value={editTitle} maxLength={200} autoFocus onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) saveEdit(); if (e.key === "Escape") setEditId(null); }} />
                  <Input type="date" className="w-36 h-8" value={editDue} onChange={(e) => setEditDue(e.target.value)} />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveEdit} title="저장"><Check className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditId(null)} title="취소"><X className="w-4 h-4" /></Button>
                </>
              ) : (
                <>
                  <span className={`flex-1 text-sm break-words ${t.done ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
                  {dl && <span className={`shrink-0 text-[11px] rounded-full px-2 py-0.5 ${dl.cls}`}>{dl.text}</span>}
                  <Button size="icon" variant="ghost" className="h-8 w-8" title="수정" onClick={() => { setEditId(t.id); setEditTitle(t.title); setEditDue(t.dueDate ?? ""); }}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" title="삭제" onClick={() => delMut.mutate({ id: t.id })}><Trash2 className="w-3.5 h-3.5" /></Button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
