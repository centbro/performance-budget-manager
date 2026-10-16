import { useState } from "react";
import { toast } from "sonner";
import { Lock, MessageSquarePlus, Send, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuthContext } from "../App";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORIES = ["건의", "오류 제보", "문의", "기타"] as const;
const STATUSES = ["접수", "확인중", "답변완료"] as const;
const statusCls: Record<string, string> = {
  접수: "bg-amber-100 text-amber-700 border-amber-200",
  확인중: "bg-blue-100 text-blue-700 border-blue-200",
  답변완료: "bg-emerald-100 text-emerald-700 border-emerald-200",
};
const fmt = (d: Date | string) => new Date(d).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });

type Post = import("../../../drizzle/schema").BoardPost;

function PostCard({ post, isAdmin }: { post: Post; isAdmin: boolean }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState(post.adminReply ?? "");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>((post.status as (typeof STATUSES)[number]) ?? "접수");
  const refresh = () => { utils.board.list.invalidate(); utils.board.openCount.invalidate(); };
  const replyMut = trpc.board.reply.useMutation({ onSuccess: () => { toast.success("저장했습니다."); refresh(); }, onError: (e) => toast.error(e.message) });
  const del = trpc.board.delete.useMutation({ onSuccess: () => { toast.success("삭제했습니다."); refresh(); }, onError: (e) => toast.error(e.message) });

  return (
    <Card>
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{post.category}</Badge>
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusCls[post.status] ?? ""}`}>{post.status}</span>
          <CardTitle className="text-sm flex-1 min-w-0 truncate">{post.title}</CardTitle>
          <span className="text-xs text-muted-foreground">{fmt(post.createdAt)}</span>
        </div>
        {isAdmin && <p className="text-xs text-muted-foreground">{post.authorName} · {post.authorEmail}</p>}
      </CardHeader>
      {open && (
        <CardContent className="space-y-3 text-sm">
          <p className="whitespace-pre-wrap leading-relaxed">{post.content}</p>
          {post.adminReply && !isAdmin && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
              <p className="text-xs font-medium text-primary mb-1">관리자 답변 · {post.repliedAt ? fmt(post.repliedAt) : ""}</p>
              <p className="whitespace-pre-wrap">{post.adminReply}</p>
            </div>
          )}
          {isAdmin && (
            <div className="space-y-2 border-t pt-3">
              <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="답변 내용" className="min-h-[80px]" />
              <div className="flex items-center gap-2">
                <Select value={status} onValueChange={(v) => setStatus(v as (typeof STATUSES)[number])}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" disabled={replyMut.isPending} onClick={() => replyMut.mutate({ id: post.id, reply, status: reply.trim() && status === "접수" ? "답변완료" : status })}>
                  {replyMut.isPending ? <Spinner className="w-4 h-4 mr-1" /> : <Send className="w-4 h-4 mr-1" />}답변 저장
                </Button>
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => window.confirm("이 글을 삭제할까요?") && del.mutate({ id: post.id })}><Trash2 className="w-4 h-4 mr-1" />삭제</Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function BoardPage() {
  const { user } = useAuthContext();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const list = trpc.board.list.useQuery();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("건의");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [filter, setFilter] = useState("전체");
  const create = trpc.board.create.useMutation({
    onSuccess: () => { toast.success("관리자에게 전달했습니다."); setTitle(""); setContent(""); utils.board.list.invalidate(); utils.board.openCount.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const posts = (list.data ?? []).filter((p) => filter === "전체" || p.status === filter);

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold">의견 게시판</h1>
          <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" />
            {isAdmin ? "모든 사용자가 남긴 의견입니다. 사용자는 본인 글과 답변만 볼 수 있습니다." : "건의·오류 제보·문의(이용 기간 연장 등)를 남겨 주세요. 내가 쓴 글과 관리자 답변만 보이며, 다른 사용자에게는 공개되지 않습니다."}
          </p>
        </div>

        {!isAdmin && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MessageSquarePlus className="w-4 h-4" />새 의견 작성</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                <Select value={category} onValueChange={(v) => setCategory(v as (typeof CATEGORIES)[number])}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" maxLength={200} />
              </div>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[120px]" placeholder="내용을 적어 주세요. 오류는 어느 화면에서 어떤 동작을 했는지 알려 주시면 빨리 확인할 수 있습니다." maxLength={5000} />
              <p className="text-xs text-muted-foreground">이용 대상자의 이름·연락처 같은 개인정보는 적지 마세요.</p>
              <Button disabled={create.isPending} onClick={() => create.mutate({ category, title, content })}>
                {create.isPending ? <Spinner className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}관리자에게 보내기
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{isAdmin ? "받은 의견" : "내가 보낸 의견"} ({posts.length})</h2>
          {isAdmin && (
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{["전체", ...STATUSES].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
        {list.isLoading ? <div className="flex justify-center py-10"><Spinner /></div> : posts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6">{isAdmin ? "받은 의견이 없습니다." : "아직 보낸 의견이 없습니다."}</p>
        ) : (
          <div className="space-y-3">{posts.map((p) => <PostCard key={p.id} post={p} isAdmin={!!isAdmin} />)}</div>
        )}
      </div>
    </DashboardLayout>
  );
}
