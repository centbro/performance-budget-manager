import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { GRANT_FIELDS } from "@shared/grantGuide";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

/** 대상·예산·원하는 효과만 입력하면 공동모금회 양식 초안을 한 번에 만든다. */
export default function QuickPlanDialog({ open, onOpenChange }: Props) {
  const [, navigate] = useLocation();
  const thisYear = new Date().getFullYear();
  const [title, setTitle] = useState("");
  const [year, setYear] = useState(thisYear + 1);
  const [field, setField] = useState<string>(GRANT_FIELDS[0]);
  const [region, setRegion] = useState("");
  const [target, setTarget] = useState("");
  const [count, setCount] = useState("");
  const [budget, setBudget] = useState("");
  const [effect, setEffect] = useState("");
  const [extra, setExtra] = useState("");
  const refs = trpc.tools.references.useQuery();
  const refCount = refs.data?.length ?? 0;
  const [useRefs, setUseRefs] = useState(true);

  const mutation = trpc.businessPlans.quickGenerate.useMutation({
    onSuccess: ({ id }) => {
      toast.success("공동모금회 양식 초안이 생성되었습니다.");
      onOpenChange(false);
      navigate(`/business-plans/${id}`);
    },
    onError: (e) => toast.error(e.message || "생성에 실패했습니다."),
  });

  const submit = () => {
    const targetCount = Number(count.replace(/,/g, ""));
    const budgetWon = Number(budget.replace(/,/g, ""));
    if (!title.trim()) return toast.error("사업명을 입력해 주세요.");
    if (!target.trim()) return toast.error("대상을 입력해 주세요.");
    if (!(targetCount > 0)) return toast.error("대상 인원을 숫자로 입력해 주세요.");
    if (!(budgetWon > 0)) return toast.error("총예산을 숫자(원)로 입력해 주세요.");
    if (!effect.trim()) return toast.error("원하는 효과를 입력해 주세요.");
    mutation.mutate({
      title: title.trim(),
      year,
      field,
      region: region.trim(),
      targetDescription: target.trim(),
      targetCount,
      budget: budgetWon,
      desiredEffect: effect.trim(),
      extra: extra.trim() || undefined,
      useReferences: refCount > 0 && useRefs,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !mutation.isPending && onOpenChange(v)}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            공동모금회 양식으로 한 번에 생성
          </DialogTitle>
          <DialogDescription>
            대상·예산·원하는 효과를 입력하면 사업개요부터 예산표까지 초안을 만듭니다. 근거 자료가 없는
            통계는 [확인 필요]로 표시되니 제출 전 반드시 채워 주세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>사업명 *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 이주노동자 한국어 교실" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>배분분야</Label>
              <Select value={field} onValueChange={setField}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRANT_FIELDS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>사업 연도</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[thisYear, thisYear + 1, thisYear + 2].map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}년
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>지역</Label>
            <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="예: 경기도 화성시" />
          </div>
          <div className="space-y-2">
            <Label>대상 *</Label>
            <Textarea value={target} onChange={(e) => setTarget(e.target.value)} placeholder="예: 화성시에 거주하는 이주노동자 (한국어 소통이 어려운 성인)" className="min-h-[64px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>실인원(명) *</Label>
              <Input inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} placeholder="40" />
            </div>
            <div className="space-y-2">
              <Label>총예산(원) *</Label>
              <Input inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="12000000" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>원하는 효과 *</Label>
            <Textarea value={effect} onChange={(e) => setEffect(e.target.value)} placeholder="예: 일상 한국어 소통 능력 향상, 사회적 고립감 감소" className="min-h-[64px]" />
          </div>
          <div className="space-y-2">
            <Label>추가 정보 (선택)</Label>
            <Textarea value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="기관 강점, 연계 기관, 기존 사업 이력 등" className="min-h-[56px]" />
          </div>
          <label className={`flex items-start gap-2 text-sm ${refCount === 0 ? "opacity-60" : ""}`}>
            <Checkbox checked={refCount > 0 && useRefs} disabled={refCount === 0} onCheckedChange={(v) => setUseRefs(v === true)} className="mt-0.5" />
            <span>
              내 참고자료 반영
              <span className="block text-xs text-muted-foreground">
                {refCount === 0 ? "업무 도우미 › 참고자료 보관함에 지침·자료 PDF를 올리면 쓸 수 있습니다." : `올려 둔 자료 ${refCount}개에서 관련 부분을 찾아 근거로 씁니다.`}
              </span>
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            취소
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner className="w-4 h-4 mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {mutation.isPending ? "생성 중… (최대 1분)" : "초안 생성"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
