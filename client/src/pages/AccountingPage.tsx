import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2, Wallet } from "lucide-react";

const won = (n: number) => n.toLocaleString("ko-KR");
const num = (s: string) => parseInt(s.replace(/[^0-9]/g, ""), 10) || 0;
const today = () => new Date().toISOString().slice(0, 10);
const Q = ["1분기(1~3월)", "2분기(4~6월)", "3분기(7~9월)", "4분기(10~12월)"];

export default function AccountingPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [openId, setOpenId] = useState<number | null>(null);
  return openId ? <BudgetDetail id={openId} onBack={() => setOpenId(null)} /> : <BudgetList year={year} setYear={setYear} onOpen={setOpenId} />;
}

function BudgetList({ year, setYear, onOpen }: { year: number; setYear: (y: number) => void; onOpen: (id: number) => void }) {
  const utils = trpc.useUtils();
  const { data: list = [], isLoading } = trpc.acct.list.useQuery({ year });
  const [form, setForm] = useState<{ name: string; split: boolean } | null>(null);
  const create = trpc.acct.create.useMutation({
    onSuccess: (r) => { utils.acct.list.invalidate(); setForm(null); onOpen(r.id); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Wallet className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight flex-1">예산 관리 (회계)</h1>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{[0, 1, 2].map((d) => { const y = new Date().getFullYear() + 1 - d; return <SelectItem key={y} value={String(y)}>{y}년</SelectItem>; })}</SelectContent>
        </Select>
        <Button onClick={() => setForm({ name: "", split: false })}><Plus className="h-4 w-4 mr-1" />예산 등록</Button>
      </div>
      <p className="text-sm text-muted-foreground">사업을 등록하지 않아도 됩니다. 예산을 만들고 → 세부항목을 정하고 → 지출을 기록하세요. 분기별로 나눌지는 예산마다 선택할 수 있습니다.</p>
      {isLoading ? null : list.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">{year}년에 등록한 예산이 없습니다. '예산 등록'으로 시작해 보세요.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {list.map((b) => (
            <Card key={b.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => onOpen(b.id)}>
              <CardContent className="py-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium flex-1">{b.name}</span>
                  <span className="text-xs text-muted-foreground">{b.splitQuarter ? "분기별 관리" : "연간 관리"}</span>
                </div>
                <Progress value={Math.min(100, b.rate)} />
                <div className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                  <span>예산 {won(b.total)}원</span><span>집행 {won(b.spent)}원 ({b.rate}%)</span><span>잔액 {won(b.remaining)}원</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>예산 등록</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="space-y-1"><Label>예산 이름</Label><Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="예) 2026 후원금, 보조금" /></div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div><div className="text-sm font-medium">분기별로 나눠 관리</div><div className="text-xs text-muted-foreground">끄면 연간 금액만 관리합니다. 나중에 바꿀 수 있어요.</div></div>
                <Switch checked={form.split} onCheckedChange={(v) => setForm({ ...form, split: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>취소</Button>
            <Button disabled={!form?.name.trim() || create.isPending} onClick={() => form && create.mutate({ year, name: form.name, splitQuarter: form.split })}>만들기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type ItemForm = { id?: number; name: string; amount: string; q: string[] };
type ExpForm = { id?: number; itemId: string; date: string; amount: string; desc: string };

function BudgetDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.acct.get.useQuery({ id });
  const inv = () => { utils.acct.get.invalidate({ id }); utils.acct.list.invalidate(); };
  const onError = (e: { message: string }) => toast.error(e.message);
  const update = trpc.acct.update.useMutation({ onSuccess: inv, onError });
  const del = trpc.acct.delete.useMutation({ onSuccess: () => { utils.acct.list.invalidate(); onBack(); }, onError });
  const saveItem = trpc.acct.saveItem.useMutation({ onSuccess: () => { inv(); setItem(null); }, onError });
  const delItem = trpc.acct.deleteItem.useMutation({ onSuccess: inv, onError });
  const saveExp = trpc.acct.saveExpense.useMutation({ onSuccess: () => { inv(); setExp(null); }, onError });
  const delExp = trpc.acct.deleteExpense.useMutation({ onSuccess: inv, onError });
  const [item, setItem] = useState<ItemForm | null>(null);
  const [exp, setExp] = useState<ExpForm | null>(null);
  const [rename, setRename] = useState<string | null>(null);
  const itemName = useMemo(() => new Map((data?.summary.items ?? []).map((i) => [i.id, i.name])), [data]);
  if (isLoading || !data) return <div className="p-6 text-sm text-muted-foreground">불러오는 중…</div>;
  const s = data.summary;
  const split = data.splitQuarter;
  const qSum = item ? item.q.reduce((a, v) => a + num(v), 0) : 0;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-xl font-semibold flex-1 min-w-[10rem]">{data.name} <span className="text-sm font-normal text-muted-foreground">{data.year}년</span></h1>
        <Button variant="outline" size="sm" onClick={() => setRename(data.name)}><Pencil className="h-3.5 w-3.5 mr-1" />이름</Button>
        <Button variant="outline" size="sm" onClick={() => confirm(`'${data.name}' 예산과 세부항목·지출을 모두 삭제할까요?`) && del.mutate({ id })}><Trash2 className="h-3.5 w-3.5 mr-1" />삭제</Button>
      </div>

      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div><div className="text-sm font-medium">분기별로 나눠 관리</div><div className="text-xs text-muted-foreground">{split ? "세부항목마다 분기별 금액을 정합니다." : "세부항목의 연간 금액만 관리합니다."} 바꿔도 총액은 유지됩니다.</div></div>
            <Switch checked={split} onCheckedChange={(v) => update.mutate({ id, splitQuarter: v })} />
          </div>
          <Progress value={Math.min(100, s.rate)} />
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm"><span>총예산 <b>{won(s.total)}원</b></span><span>집행 <b>{won(s.spent)}원</b> ({s.rate}%)</span><span>잔액 <b className={s.remaining < 0 ? "text-destructive" : ""}>{won(s.remaining)}원</b></span></div>
          {split && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {s.q.map((q, k) => (
                <div key={k} className="rounded-md border p-2 text-xs"><div className="font-medium mb-1">{Q[k]}</div><div>예산 {won(q.budget)}</div><div>집행 {won(q.spent)}</div><div className={q.budget - q.spent < 0 ? "text-destructive" : "text-muted-foreground"}>잔액 {won(q.budget - q.spent)}</div></div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">세부항목</CardTitle>
          <Button size="sm" onClick={() => setItem({ name: "", amount: "", q: ["", "", "", ""] })}><Plus className="h-4 w-4 mr-1" />항목 추가</Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {s.items.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">세부항목이 없습니다. 예) 인건비, 운영비, 프로그램비</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground border-b"><th className="py-2">항목</th><th className="text-right">예산</th>{split && Q.map((_, k) => <th key={k} className="text-right">{k + 1}분기</th>)}<th className="text-right">집행</th><th className="text-right">잔액</th><th /></tr></thead>
              <tbody>
                {s.items.map((it) => (
                  <tr key={it.id} className="border-b last:border-0">
                    <td className="py-2">{it.name}</td><td className="text-right">{won(it.amount)}</td>
                    {split && it.q.map((v, k) => <td key={k} className="text-right text-muted-foreground">{won(v)}</td>)}
                    <td className="text-right">{won(it.spent)}</td><td className={`text-right ${it.remaining < 0 ? "text-destructive" : ""}`}>{won(it.remaining)}</td>
                    <td className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setItem({ id: it.id, name: it.name, amount: String(it.amount), q: it.q.map(String) })}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => confirm(`'${it.name}' 항목과 그 지출 내역을 삭제할까요?`) && delItem.mutate({ budgetId: id, id: it.id })}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">지출 내역</CardTitle>
          <Button size="sm" disabled={s.items.length === 0} onClick={() => setExp({ itemId: String(s.items[0]?.id ?? ""), date: today(), amount: "", desc: "" })}><Plus className="h-4 w-4 mr-1" />지출 기록</Button>
        </CardHeader>
        <CardContent>
          {data.expenses.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">{s.items.length === 0 ? "세부항목을 먼저 추가해 주세요." : "기록된 지출이 없습니다."}</p> : (
            <div className="divide-y">
              {data.expenses.map((e) => (
                <div key={e.id} className="flex items-center gap-2 py-2 text-sm">
                  <span className="text-muted-foreground w-24 shrink-0">{e.expenseDate}</span>
                  <span className="w-28 shrink-0 truncate">{itemName.get(e.itemId) ?? "-"}</span>
                  <span className="flex-1 truncate text-muted-foreground">{e.description}</span>
                  <b>{won(e.amount)}원</b>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExp({ id: e.id, itemId: String(e.itemId), date: e.expenseDate, amount: String(e.amount), desc: e.description })}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => confirm("이 지출을 삭제할까요?") && delExp.mutate({ budgetId: id, id: e.id })}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!item} onOpenChange={(o) => !o && setItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{item?.id ? "세부항목 수정" : "세부항목 추가"}</DialogTitle></DialogHeader>
          {item && (
            <div className="space-y-3">
              <div className="space-y-1"><Label>항목 이름</Label><Input autoFocus value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} placeholder="예) 인건비" /></div>
              {split ? (
                <div className="space-y-2">
                  <Label>분기별 금액 (합계 {won(qSum)}원)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {Q.map((label, k) => (
                      <div key={k} className="space-y-1"><span className="text-xs text-muted-foreground">{label}</span>
                        <Input inputMode="numeric" value={item.q[k] ? won(num(item.q[k])) : ""} onChange={(e) => setItem({ ...item, q: item.q.map((v, j) => (j === k ? String(num(e.target.value)) : v)) })} /></div>
                    ))}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => { const t = num(item.amount) || qSum; const b = Math.floor(t / 4); setItem({ ...item, amount: String(t), q: [b + (t - b * 4), b, b, b].map(String) }); }}>합계를 4분기로 똑같이 나누기</Button>
                </div>
              ) : (
                <div className="space-y-1"><Label>연간 예산 (원)</Label><Input inputMode="numeric" value={item.amount ? won(num(item.amount)) : ""} onChange={(e) => setItem({ ...item, amount: String(num(e.target.value)) })} /></div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setItem(null)}>취소</Button>
            <Button disabled={!item?.name.trim() || saveItem.isPending} onClick={() => item && saveItem.mutate({ budgetId: id, id: item.id, name: item.name, amount: num(item.amount), q: split ? item.q.map(num) : undefined })}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!exp} onOpenChange={(o) => !o && setExp(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{exp?.id ? "지출 수정" : "지출 기록"}</DialogTitle></DialogHeader>
          {exp && (
            <div className="space-y-3">
              <div className="space-y-1"><Label>세부항목</Label>
                <Select value={exp.itemId} onValueChange={(v) => setExp({ ...exp, itemId: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{s.items.map((i) => <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label>날짜</Label><Input type="date" value={exp.date} onChange={(e) => setExp({ ...exp, date: e.target.value })} /></div>
                <div className="space-y-1"><Label>금액 (원)</Label><Input inputMode="numeric" value={exp.amount ? won(num(exp.amount)) : ""} onChange={(e) => setExp({ ...exp, amount: String(num(e.target.value)) })} /></div>
              </div>
              <div className="space-y-1"><Label>내용</Label><Input value={exp.desc} onChange={(e) => setExp({ ...exp, desc: e.target.value })} placeholder="예) 3월 강사비" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setExp(null)}>취소</Button>
            <Button disabled={!exp || !exp.itemId || !exp.date || num(exp.amount) <= 0 || saveExp.isPending} onClick={() => exp && saveExp.mutate({ budgetId: id, id: exp.id, itemId: Number(exp.itemId), expenseDate: exp.date, amount: num(exp.amount), description: exp.desc })}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rename !== null} onOpenChange={(o) => !o && setRename(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>예산 이름 바꾸기</DialogTitle></DialogHeader>
          <Input autoFocus value={rename ?? ""} onChange={(e) => setRename(e.target.value)} />
          <DialogFooter><Button variant="outline" onClick={() => setRename(null)}>취소</Button><Button disabled={!rename?.trim()} onClick={() => { update.mutate({ id, name: rename! }); setRename(null); }}>저장</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
