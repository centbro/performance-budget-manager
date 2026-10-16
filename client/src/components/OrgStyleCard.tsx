import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, FileUp, Palette } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";

/** 우리 기관 문체 프로필. 한 번 저장하면 행정 문서·결과보고서·사업계획서·홍보글이 이 말투를 참고한다. */
export default function OrgStyleCard() {
  const q = trpc.style.get.useQuery();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [tone, setTone] = useState("");
  const [sample, setSample] = useState("");
  useEffect(() => {
    if (q.data) { setOrgName(q.data.orgName); setTone(q.data.tone); setSample(q.data.sampleText); }
  }, [q.data]);
  const save = trpc.style.save.useMutation({
    onSuccess: () => { toast.success("저장했습니다. 이제 글을 쓸 때 이 기관 말투를 참고합니다."); utils.style.get.invalidate(); },
    onError: (e) => toast.error(e.message || "저장에 실패했습니다."),
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const MAX = 6000;

  /** PDF에서 글자만 읽어 아래 칸에 채운다(파일은 저장하지 않음). 저장 전에 직접 확인·수정할 수 있다. */
  const onPdf = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf") { toast.error("PDF 파일만 올릴 수 있습니다."); return; }
    setReading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/extract-text", { method: "POST", body: fd, credentials: "include" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(j.error || "PDF를 읽지 못했습니다."); return; }
      const clean = String(j.text ?? "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      const room = MAX - (sample ? sample.length + 2 : 0);
      if (room <= 0) { toast.error("이미 6,000자가 찼습니다. 기존 글을 지우고 올려 주세요."); return; }
      setSample((cur) => (cur ? cur + "\n\n" : "") + clean.slice(0, room));
      toast.success(clean.length > room ? `PDF 앞부분 ${room.toLocaleString()}자를 불러왔습니다. 내용을 확인하고 저장하세요.` : "PDF 내용을 불러왔습니다. 내용을 확인하고 저장하세요.");
    } catch {
      toast.error("PDF를 읽지 못했습니다.");
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const saved = !!(q.data && (q.data.orgName || q.data.tone || q.data.sampleText));

  return (
    <Card className="mb-5 gap-0 py-0">
      <button type="button" className="w-full flex items-center gap-2 px-4 py-3 text-left" onClick={() => setOpen((v) => !v)}>
        <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0"><Palette className="w-4 h-4" /></span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium">우리 기관 문체 설정 {saved && <span className="ml-1 text-xs text-primary font-normal">· 적용 중</span>}</span>
          <span className="block text-xs text-muted-foreground truncate">기관 말투를 한 번 알려주면 모든 글쓰기에 반영됩니다</span>
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <CardContent className="space-y-3 pb-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm">기관명</Label>
              <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="예: OO외국인복지센터" maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">문체 지침 (선택)</Label>
              <Input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="예: 개조식, 음슴체, 짧은 문장" maxLength={300} />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm">기관에서 실제로 쓴 글 (선택)</Label>
              <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => onPdf(e.target.files?.[0])} />
              <Button type="button" size="sm" variant="outline" disabled={reading} onClick={() => fileRef.current?.click()}>
                {reading ? <Spinner className="w-4 h-4 mr-1" /> : <FileUp className="w-4 h-4 mr-1" />}PDF에서 불러오기
              </Button>
            </div>
            <Textarea value={sample} onChange={(e) => setSample(e.target.value)} className="min-h-[140px] text-sm" maxLength={MAX}
              placeholder="지난 사업계획서·결과보고서·공문의 일부를 붙여 넣으세요. 어미와 문장 구성, 자주 쓰는 용어만 참고하고 내용은 가져오지 않습니다. 전화번호·주민번호 등은 자동으로 가려집니다." />
            <p className="text-xs text-muted-foreground">{sample.length.toLocaleString()} / 6,000자 · PDF는 글자만 읽고 파일은 저장하지 않습니다(스캔 이미지 PDF는 불가). 불러온 뒤 참여자 이름 같은 개인정보는 지우고 저장해 주세요.</p>
          </div>
          <Button size="sm" onClick={() => save.mutate({ orgName, tone, sampleText: sample })} disabled={save.isPending}>
            {save.isPending && <Spinner className="w-4 h-4 mr-1" />}저장
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
