import { useState } from "react";
import { toast } from "sonner";
import { Copy, Megaphone, MessageSquarePlus, Send, Sparkles, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PROMO_CHANNELS, PROMO_KINDS, type PromoChannelId, type PromoKindId } from "@shared/promo";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Variant = { label: string; title: string; body: string; hashtags: string[] };
const copyText = (t: string) => navigator.clipboard.writeText(t).then(() => toast.success("복사했습니다."));
const fullText = (v: Variant) => [v.title, v.body, v.hashtags.join(" ")].filter(Boolean).join("\n\n");

function SamplesCard({ picked, setPicked }: { picked: number[]; setPicked: (ids: number[]) => void }) {
  const utils = trpc.useUtils();
  const list = trpc.promo.samples.useQuery();
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("blog");
  const [body, setBody] = useState("");
  const save = trpc.promo.saveSample.useMutation({
    onSuccess: (d) => {
      toast.success("샘플을 저장했습니다.");
      setName(""); setBody("");
      utils.promo.samples.invalidate();
      setPicked([...picked, d.id].slice(-3));
    },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.promo.deleteSample.useMutation({
    onSuccess: (_d, v) => { utils.promo.samples.invalidate(); setPicked(picked.filter((x) => x !== v.id)); },
  });
  const toggle = (id: number) =>
    setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : picked.length >= 3 ? (toast.error("샘플은 최대 3개까지 고를 수 있습니다."), picked) : [...picked, id]);

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MessageSquarePlus className="w-4 h-4" />1. 우리 기관 글 샘플 (문체 학습)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {(list.data ?? []).length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">이번 글에 참고할 샘플을 고르세요(최대 3개).</p>
            {(list.data ?? []).map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={picked.includes(s.id)} onCheckedChange={() => toggle(s.id)} />
                <span className="flex-1 truncate">{s.name}</span>
                <Badge variant="outline">{PROMO_CHANNELS.find((c) => c.id === s.channel)?.label ?? "기타"}</Badge>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.confirm("이 샘플을 삭제할까요?") && del.mutate({ id: s.id })}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            ))}
          </div>
        )}
        <div className="border-t pt-3 space-y-2">
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="샘플 이름 (예: 지난 명랑운동회 후기)" />
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{PROMO_CHANNELS.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[120px] text-sm" placeholder="기관에서 예전에 올린 홍보글·소식글을 그대로 붙여 넣으세요. 말투와 구성만 참고하고 내용은 가져오지 않습니다." />
          <Button className="w-full" variant="outline" size="sm" disabled={save.isPending} onClick={() => name.trim() && body.trim() ? save.mutate({ name: name.trim(), channel, body: body.trim() }) : toast.error("이름과 글을 입력해 주세요.")}>
            {save.isPending ? <Spinner className="w-4 h-4 mr-2" /> : null}샘플 저장
          </Button>
          <p className="text-xs text-muted-foreground">샘플 없이도 작성할 수 있습니다. 샘플에 참여자 이름·연락처 같은 개인정보가 있으면 지우고 올려 주세요.</p>
        </div>
      </CardContent>
    </Card>
  );
}

function VariantCard({ v, channel, picked, onChange }: { v: Variant; channel: PromoChannelId; picked: number[]; onChange: (v: Variant) => void }) {
  const [instruction, setInstruction] = useState("");
  const refine = trpc.promo.refine.useMutation({
    onSuccess: (r) => { onChange({ ...r, label: v.label }); setInstruction(""); },
    onError: (e) => toast.error(e.message),
  });
  const quick = ["더 짧게", "더 친근하게", "더 공식적으로", "이모지 줄이기"];
  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2"><Badge>{v.label}</Badge></CardTitle>
        <Button variant="outline" size="sm" onClick={() => copyText(fullText(v))}><Copy className="w-4 h-4 mr-1" />전체 복사</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <Input value={v.title} onChange={(e) => onChange({ ...v, title: e.target.value })} placeholder="제목/첫 줄" className="font-medium" />
        <Textarea value={v.body} onChange={(e) => onChange({ ...v, body: e.target.value })} className="min-h-[180px] text-sm leading-relaxed" />
        {v.hashtags.length > 0 && <p className="text-sm text-primary break-words">{v.hashtags.join(" ")}</p>}
        <div className="flex flex-wrap gap-1">
          {quick.map((q) => (
            <Button key={q} variant="outline" size="sm" className="h-7 text-xs" disabled={refine.isPending} onClick={() => refine.mutate({ channel, title: v.title, body: v.body, instruction: q, sampleIds: picked })}>{q}</Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="채팅으로 수정 요청 (예: 신청 방법을 맨 위로)" onKeyDown={(e) => e.key === "Enter" && instruction.trim() && refine.mutate({ channel, title: v.title, body: v.body, instruction: instruction.trim(), sampleIds: picked })} />
          <Button size="icon" disabled={refine.isPending || !instruction.trim()} onClick={() => refine.mutate({ channel, title: v.title, body: v.body, instruction: instruction.trim(), sampleIds: picked })}>
            {refine.isPending ? <Spinner className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PromoPage() {
  const [kind, setKind] = useState<PromoKindId>("recruit");
  const [channel, setChannel] = useState<PromoChannelId>("blog");
  const [org, setOrg] = useState("");
  const [facts, setFacts] = useState("");
  const [extra, setExtra] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const gen = trpc.promo.generate.useMutation({
    onSuccess: (d) => setVariants(d.variants),
    onError: (e) => toast.error(e.message || "작성에 실패했습니다."),
  });
  const run = () => {
    if (!facts.trim()) return toast.error("알리고 싶은 내용을 적어 주세요.");
    gen.mutate({ kind, channel, org: org.trim(), facts: facts.trim(), extra: extra.trim() || undefined, sampleIds: picked });
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Megaphone className="w-6 h-6" />홍보·소식글</h1>
          <p className="text-muted-foreground text-sm mt-1">기관에서 쓰던 글을 샘플로 저장해 두고, 몇 가지만 적으면 같은 말투로 홍보글·소식글 초안을 여러 안으로 만들어 드립니다.</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
          <div className="space-y-4">
            <SamplesCard picked={picked} setPicked={setPicked} />
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4" />2. 알리고 싶은 내용 몇 가지만</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label>글 종류</Label>
                    <Select value={kind} onValueChange={(v) => setKind(v as PromoKindId)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PROMO_KINDS.map((k) => <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label>올릴 곳</Label>
                    <Select value={channel} onValueChange={(v) => setChannel(v as PromoChannelId)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PROMO_CHANNELS.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{PROMO_KINDS.find((k) => k.id === kind)?.hint}</p>
                <div className="space-y-1"><Label>기관명 (선택)</Label><Input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="예: 화성시외국인복지센터" /></div>
                <div className="space-y-1">
                  <Label>내용 *</Label>
                  <Textarea value={facts} onChange={(e) => setFacts(e.target.value)} className="min-h-[150px] text-sm" placeholder={kind === "recruit" ? "예) 11월 8일(토) 오후 1시, 화성시민체육관, 외국인근로자 명랑운동회, 약 200명 모집, 무료, 간식 제공, 신청은 센터 전화 또는 카톡" : "예) 지난 토요일 외국인근로자 명랑운동회 진행, 12개국 180명 참여, 줄다리기가 제일 인기, 참가자들이 서로 응원하며 친해짐"} />
                </div>
                <div className="space-y-1"><Label>추가 요청 (선택)</Label><Input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="예: 쉬운 말로, 다문화 가정 대상" /></div>
                <Button className="w-full" onClick={run} disabled={gen.isPending}>
                  {gen.isPending ? <Spinner className="w-4 h-4 mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  {gen.isPending ? "작성 중…" : "초안 3가지 만들기"}
                </Button>
                {picked.length === 0 && <p className="text-xs text-muted-foreground">샘플을 고르지 않으면 일반적인 복지기관 문체로 작성합니다.</p>}
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            {variants.length === 0 && !gen.isPending && (
              <p className="text-sm text-muted-foreground pt-2">내용을 적고 만들기를 누르면 서로 다른 느낌의 초안 3가지가 나옵니다. 마음에 드는 안을 골라 직접 고치거나, 아래 채팅창에 "신청 방법을 맨 위로"처럼 요청해 다듬으세요. 일시·장소·문의처처럼 알려 주지 않은 정보는 [확인 필요]로 남습니다.</p>
            )}
            {variants.map((v, i) => (
              <VariantCard key={i} v={v} channel={channel} picked={picked} onChange={(nv) => setVariants((p) => p.map((x, j) => (j === i ? nv : x)))} />
            ))}
            {variants.length > 0 && kind === "news" && <p className="text-xs text-muted-foreground">게시 전 확인: 사진 속 인물과 후기에 나온 참여자의 이름·얼굴 공개 동의를 받았는지 확인하세요.</p>}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
