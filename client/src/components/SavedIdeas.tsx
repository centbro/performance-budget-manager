import { useState } from "react";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck, ChevronDown, ChevronUp, Copy, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import IdeaEvalPanel, { type IdeaContext } from "@/components/IdeaEvalPanel";
import type { ProgramIdea } from "@shared/workTools";

export const ideaToText = (idea: ProgramIdea) =>
  [`■ ${idea.name}`, idea.summary, "", "[주요 활동]", ...idea.activities.map((a) => `- ${a}`), "", `[기대 변화] ${idea.outcome}`, `[성과지표] ${idea.indicator}`, `[어림 예산] ${idea.budgetEstimate}`].join("\n");

/** 아이디어 카드의 저장 버튼 */
export function SaveIdeaButton({ idea, ctx }: { idea: ProgramIdea; ctx: IdeaContext }) {
  const utils = trpc.useUtils();
  const [done, setDone] = useState(false);
  const m = trpc.tools.saveIdea.useMutation({
    onSuccess: (r) => { setDone(true); toast.success(r?.duplicated ? "이미 저장된 아이디어라 내용을 갱신했습니다." : "저장했습니다. 아래 '저장한 아이디어'에서 다시 볼 수 있어요."); utils.tools.savedIdeas.invalidate(); },
    onError: (e) => toast.error(e.message || "저장하지 못했습니다."),
  });
  return (
    <Button size="sm" variant={done ? "secondary" : "outline"} disabled={m.isPending} onClick={() => m.mutate({ idea, context: { ...ctx, region: ctx.region ?? "" } })}>
      {m.isPending ? <Spinner className="w-4 h-4 mr-1.5" /> : done ? <BookmarkCheck className="w-4 h-4 mr-1.5" /> : <Bookmark className="w-4 h-4 mr-1.5" />}
      {done ? "저장됨" : "저장"}
    </Button>
  );
}

/** 저장한 아이디어 목록 */
export default function SavedIdeas() {
  const q = trpc.tools.savedIdeas.useQuery();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const del = trpc.tools.deleteSavedIdea.useMutation({
    onSuccess: () => { toast.success("삭제했습니다."); utils.tools.savedIdeas.invalidate(); },
    onError: (e) => toast.error(e.message || "삭제하지 못했습니다."),
  });
  const items = q.data ?? [];
  const copy = async (idea: ProgramIdea) => {
    try { await navigator.clipboard.writeText(ideaToText(idea)); toast.success("복사했습니다."); } catch { toast.error("복사하지 못했습니다."); }
  };

  return (
    <div className="border-t pt-4">
      <button type="button" className="w-full flex items-center gap-2 text-left" onClick={() => setOpen((v) => !v)}>
        <BookmarkCheck className="w-4 h-4 text-primary" />
        <span className="flex-1 text-sm font-medium">저장한 아이디어 <span className="text-muted-foreground font-normal">({q.isLoading ? "…" : items.length}개)</span></span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {items.length === 0 && <p className="text-sm text-muted-foreground">아직 저장한 아이디어가 없습니다. 위 카드의 '저장' 버튼을 눌러 보관하세요.</p>}
          {items.map((it) => (
            <Card key={it.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start gap-2">
                  <Badge variant="secondary" className="shrink-0">{it.ctx.targetGroup}</Badge>
                  <CardTitle className="text-base flex-1 min-w-0">{it.idea.name}</CardTitle>
                  <Button size="icon" variant="ghost" className="shrink-0 h-8 w-8" title="복사" onClick={() => copy(it.idea)}><Copy className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="shrink-0 h-8 w-8" title="삭제" disabled={del.isPending}
                    onClick={() => { if (window.confirm("이 아이디어를 삭제할까요?")) del.mutate({ id: it.id }); }}><Trash2 className="w-4 h-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground">목표: {it.ctx.goal} · {new Date(it.createdAt).toLocaleDateString("ko-KR")} 저장</p>
                <p className="text-sm text-muted-foreground">{it.idea.summary}</p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><span className="font-semibold">주요 활동</span><ul className="list-disc pl-5 mt-1 space-y-0.5">{it.idea.activities.map((a, j) => <li key={j}>{a}</li>)}</ul></div>
                <p><span className="font-semibold">기대 변화 · </span>{it.idea.outcome}</p>
                <p><span className="font-semibold">성과지표 · </span>{it.idea.indicator}</p>
                <p><span className="font-semibold">어림 예산 · </span>{it.idea.budgetEstimate}</p>
              </CardContent>
              <IdeaEvalPanel idea={it.idea} ctx={it.ctx} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
