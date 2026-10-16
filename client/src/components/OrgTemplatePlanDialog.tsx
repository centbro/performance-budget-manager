import { useState } from "react";
import { toast } from "sonner";
import { Copy, LayoutTemplate, Sparkles, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Section = { heading: string; content: string };
const copyText = (t: string) => navigator.clipboard.writeText(t).then(() => toast.success("복사했습니다."));

/** 우리 기관 사업계획서 양식(PDF)에 맞춰 사업계획서 작성 */
export default function OrgTemplatePlanDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const utils = trpc.useUtils();
  const templates = trpc.tools.templates.useQuery(undefined, { enabled: open });
  const [selected, setSelected] = useState("");
  const [regName, setRegName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [f, setF] = useState({ title: "", region: "", target: "", count: "", budget: "", period: "", effect: "", extra: "" });
  const [sections, setSections] = useState<Section[]>([]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const fill = trpc.tools.fillTemplate.useMutation({
    onSuccess: (d) => setSections(d.sections),
    onError: (e) => toast.error(e.message || "작성에 실패했습니다."),
  });

  const upload = async () => {
    if (!regName.trim()) return toast.error("양식 이름을 입력해 주세요.");
    if (!file) return toast.error("PDF 파일을 선택해 주세요.");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("name", regName.trim());
      fd.append("file", file);
      const res = await fetch("/api/upload/template", { method: "POST", body: fd, credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "등록에 실패했습니다.");
      toast.success("양식을 등록했습니다.");
      setRegName(""); setFile(null);
      await utils.tools.templates.invalidate();
      setSelected(String(body.id));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const submit = () => {
    if (!selected) return toast.error("양식을 선택해 주세요.");
    if (!f.title.trim()) return toast.error("사업명을 입력해 주세요.");
    if (!f.target.trim() || !f.effect.trim()) return toast.error("대상과 원하는 효과를 입력해 주세요.");
    const facts = [
      f.region && `지역: ${f.region}`,
      `대상: ${f.target}`,
      f.count && `대상 인원: ${f.count}`,
      f.budget && `총예산: ${f.budget}`,
      f.period && `사업기간: ${f.period}`,
      `원하는 효과: ${f.effect}`,
      f.extra && `추가 정보: ${f.extra}`,
    ].filter(Boolean).join("\n");
    fill.mutate({
      templateId: Number(selected),
      title: f.title.trim(),
      facts,
      extra: "사업계획서로 작성(필요성·목표·세부내용·성과지표·예산 등 양식 항목에 맞춤). 입력되지 않은 통계·수치는 [확인 필요]로 표시",
      useReferences: true,
    });
  };
  const all = sections.map((s) => `${s.heading}\n${s.content}`).join("\n\n");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>우리 기관 양식으로 사업계획서 작성</DialogTitle></DialogHeader>
        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Upload className="w-4 h-4" />기관 양식 선택·등록</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Select value={selected} onValueChange={(v) => { setSelected(v); setSections([]); }}>
                  <SelectTrigger><SelectValue placeholder={templates.data?.length ? "등록된 양식 선택" : "등록된 양식이 없습니다"} /></SelectTrigger>
                  <SelectContent>{(templates.data ?? []).map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
                <div className="border-t pt-3 space-y-2">
                  <Input value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="새 양식 이름 (예: 우리센터 사업계획서)" />
                  <Input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  <Button className="w-full" variant="outline" size="sm" onClick={upload} disabled={uploading}>
                    {uploading ? <Spinner className="w-4 h-4 mr-2" /> : <LayoutTemplate className="w-4 h-4 mr-2" />}
                    {uploading ? "분석 중… (최대 1분)" : "PDF 양식 등록"}
                  </Button>
                  <p className="text-xs text-muted-foreground">한글·워드에서 저장한 PDF(스캔본 불가, 10MB 이하). 항목 구조만 사용합니다.</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">사업 내용</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div><Label>사업명 *</Label><Input value={f.title} onChange={set("title")} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>지역</Label><Input value={f.region} onChange={set("region")} placeholder="화성시" /></div>
                  <div><Label>사업기간</Label><Input value={f.period} onChange={set("period")} placeholder="2027.1~12" /></div>
                  <div><Label>대상 인원</Label><Input value={f.count} onChange={set("count")} placeholder="100명" /></div>
                  <div><Label>총예산</Label><Input value={f.budget} onChange={set("budget")} placeholder="3천만원" /></div>
                </div>
                <div><Label>대상 *</Label><Input value={f.target} onChange={set("target")} placeholder="예: 화성시 이주노동자" /></div>
                <div><Label>원하는 효과 *</Label><Textarea value={f.effect} onChange={set("effect")} className="min-h-[70px]" /></div>
                <div><Label>추가 정보</Label><Textarea value={f.extra} onChange={set("extra")} className="min-h-[60px]" placeholder="기관 특징, 기존 사업 등" /></div>
                <Button className="w-full" onClick={submit} disabled={fill.isPending || !selected}>
                  {fill.isPending ? <Spinner className="w-4 h-4 mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  {fill.isPending ? "작성 중…" : "양식에 맞춰 작성"}
                </Button>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-3">
            {sections.length === 0 && !fill.isPending && (
              <p className="text-sm text-muted-foreground pt-2">양식을 고르고 사업 내용을 입력하면 기관 양식의 항목 순서대로 칸마다 나누어 보여 드립니다. 각 칸의 <b>복사</b> 버튼으로 한글·워드에 붙여 넣으세요. 이 결과는 저장되지 않으니 복사해 두세요. 입력하지 않은 통계·수치는 [확인 필요]로 표시됩니다.</p>
            )}
            {sections.length > 0 && (
              <>
                <div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => copyText(all)}><Copy className="w-4 h-4 mr-1" />전체 복사</Button></div>
                {sections.map((s, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-sm">{s.heading}</CardTitle>
                      <Button variant="outline" size="sm" onClick={() => copyText(s.content)}><Copy className="w-4 h-4 mr-1" />복사</Button>
                    </CardHeader>
                    <CardContent>
                      <Textarea value={s.content} onChange={(e) => setSections((p) => p.map((x, j) => (j === i ? { ...x, content: e.target.value } : x)))} className="min-h-[96px] text-sm leading-relaxed" />
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
