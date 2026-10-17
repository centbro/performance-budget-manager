import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, ImageIcon, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { NoteContent } from "@shared/noteImage";
import { NOTE_SIZE, downloadCanvas, ensureNoteFonts, renderNote, type NoteRatio, type NoteStyle } from "@/lib/noteRender";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STYLES: { id: NoteStyle; label: string }[] = [
  { id: "note", label: "손그림 노트" },
  { id: "mindmap", label: "마인드맵" },
];

export default function NoteImageTab() {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [footer, setFooter] = useState("");
  const [style, setStyle] = useState<NoteStyle>("note");
  const [ratio, setRatio] = useState<NoteRatio>("feed");
  const [content, setContent] = useState<NoteContent | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { data: saved = [] } = trpc.tools.savedIdeas.useQuery();

  const m = trpc.tools.noteImage.useMutation({
    onSuccess: (c) => setContent(c),
    onError: (e) => toast.error(e.message || "생성에 실패했습니다."),
  });

  // 내용·스타일이 바뀔 때마다 다시 그린다(글꼴을 먼저 불러온 뒤)
  useEffect(() => {
    if (!content || !canvasRef.current) return;
    let alive = true;
    const all = [content.title, content.subtitle, content.footer, ...content.items.flatMap((i) => [i.heading, i.desc])].join("");
    ensureNoteFonts(all).then(() => { if (alive && canvasRef.current) renderNote(canvasRef.current, content, style, ratio); });
    return () => { alive = false; };
  }, [content, style, ratio]);

  const submit = () => {
    if (text.trim().length < 30) return toast.error("정리할 내용을 30자 이상 적어 주세요.");
    m.mutate({ text: text.trim(), title: title.trim() || undefined, footer: footer.trim() || undefined });
  };

  const importIdea = (id: string) => {
    const s = saved.find((x) => String(x.id) === id);
    if (!s) return;
    const i = s.idea;
    setText([`프로그램: ${i.name}`, i.summary, `주요 활동: ${i.activities.join(" / ")}`, `기대 변화: ${i.outcome}`, `성과지표: ${i.indicator}`, `예산: ${i.budgetEstimate}`].filter(Boolean).join("\n"));
    setTitle(i.name.slice(0, 40));
  };

  const edit = (idx: number, patch: Partial<NoteContent["items"][0]>) =>
    setContent((c) => (c ? { ...c, items: c.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) } : c));

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="min-w-0">
        <CardContent className="space-y-4 pt-6">
          {saved.length > 0 && (
            <div className="space-y-2">
              <Label>저장한 아이디어에서 불러오기</Label>
              <Select onValueChange={importIdea}>
                <SelectTrigger><SelectValue placeholder="선택하면 아래 칸에 채워집니다" /></SelectTrigger>
                <SelectContent>{saved.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.idea.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>정리할 내용 *</Label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[170px]" maxLength={6000}
              placeholder="사업 개요, 교육 내용, 결과 요약 등을 붙여 넣으세요. 사진·보고용 카드뉴스처럼 한 장에 정리해 드립니다." />
            <p className="text-xs text-muted-foreground">이름·전화번호 등 개인정보는 넣지 마세요. 입력한 글은 AI로 전달됩니다.</p>
          </div>
          <div className="space-y-2"><Label>제목 (선택)</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder="비우면 AI가 정합니다" /></div>
          <div className="space-y-2"><Label>아래 문구 (선택)</Label><Input value={footer} onChange={(e) => setFooter(e.target.value)} maxLength={40} placeholder="예: 화성시외국인복지센터 · 2026" /></div>
          <Button className="w-full" onClick={submit} disabled={m.isPending}>
            {m.isPending ? <Spinner className="w-4 h-4 mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {m.isPending ? "정리하는 중…" : content ? "다시 정리하기" : "노트 이미지 만들기"}
          </Button>
        </CardContent>
      </Card>

      <div className="min-w-0 space-y-4">
        {!content && !m.isPending && (
          <p className="text-sm text-muted-foreground pt-2">글을 넣으면 핵심 6~8개를 아이콘과 함께 한 장의 이미지로 만들어 드립니다. 만든 뒤 글자와 아이콘은 직접 고칠 수 있고, PNG로 저장해 인스타·밴드·보고 자료에 쓸 수 있습니다.</p>
        )}
        {content && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-md border bg-muted/40 p-0.5 text-sm">
                {STYLES.map((s) => (
                  <button key={s.id} onClick={() => setStyle(s.id)} className={`px-3 py-1 rounded ${style === s.id ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>{s.label}</button>
                ))}
              </div>
              <Select value={ratio} onValueChange={(v) => setRatio(v as NoteRatio)}>
                <SelectTrigger className="h-9 w-auto min-w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(NOTE_SIZE) as NoteRatio[]).map((k) => <SelectItem key={k} value={k}>{NOTE_SIZE[k].label}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" className="ml-auto" onClick={() => canvasRef.current && downloadCanvas(canvasRef.current, `노트_${content.title}`)}>
                <Download className="w-4 h-4 mr-1.5" />PNG 저장
              </Button>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 flex justify-center">
              <canvas ref={canvasRef} className="max-w-full h-auto rounded shadow-sm" style={{ maxHeight: "75vh", width: "auto" }} aria-label="노트 이미지 미리보기" />
            </div>
            <Card>
              <CardContent className="pt-5 space-y-3">
                <p className="text-sm font-medium flex items-center gap-1.5"><ImageIcon className="w-4 h-4" />내용 고치기 <span className="text-xs font-normal text-muted-foreground">(고치면 이미지에 바로 반영됩니다)</span></p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input value={content.title} maxLength={24} onChange={(e) => setContent({ ...content, title: e.target.value })} aria-label="제목" />
                  <Input value={content.subtitle} maxLength={36} onChange={(e) => setContent({ ...content, subtitle: e.target.value })} aria-label="부제" placeholder="부제" />
                </div>
                {content.items.map((it, i) => (
                  <div key={i} className="grid grid-cols-[3.2rem_9rem_minmax(0,1fr)] gap-2 max-sm:grid-cols-[3.2rem_minmax(0,1fr)]">
                    <Input value={it.emoji} maxLength={4} className="text-center text-lg px-1" onChange={(e) => edit(i, { emoji: e.target.value })} aria-label={`항목 ${i + 1} 아이콘`} />
                    <Input value={it.heading} maxLength={12} onChange={(e) => edit(i, { heading: e.target.value })} aria-label={`항목 ${i + 1} 소제목`} />
                    <Input value={it.desc} maxLength={48} className="max-sm:col-span-2" onChange={(e) => edit(i, { desc: e.target.value })} aria-label={`항목 ${i + 1} 설명`} />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">AI가 정리한 내용은 원문과 다를 수 있으니 숫자·표현을 확인한 뒤 사용하세요.</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
