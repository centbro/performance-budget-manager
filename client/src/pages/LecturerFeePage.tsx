import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Calculator, Copy, Plus, Save, Trash2, FilePlus2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calcFee, grossForNet, sumRows, type FeeKind, type FeeRow } from "@shared/lecturerFee";

type Row = { key: number; name: string; kind: FeeKind; amount: string; memo: string };
type Mode = "gross" | "net";

let seq = 1;
const newRow = (kind: FeeKind = "business"): Row => ({ key: seq++, name: "", kind, amount: "", memo: "" });
const won = (n: number) => n.toLocaleString("ko-KR");
const toNum = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;
const fmtInput = (s: string) => { const n = toNum(s); return n ? won(n) : ""; };

export default function LecturerFeePage() {
  const utils = trpc.useUtils();
  const saved = trpc.lecturerFee.list.useQuery();
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<Mode>("gross");
  const [rows, setRows] = useState<Row[]>([newRow(), newRow(), newRow()]);
  const [currentId, setCurrentId] = useState<number | undefined>();

  const save = trpc.lecturerFee.save.useMutation({
    onSuccess: (r) => { setCurrentId(r.id); toast.success("저장했습니다."); utils.lecturerFee.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.lecturerFee.remove.useMutation({
    onSuccess: (_d, v) => { if (v.id === currentId) setCurrentId(undefined); utils.lecturerFee.list.invalidate(); toast.success("삭제했습니다."); },
  });

  const grossOf = (r: Row) => (mode === "gross" ? toNum(r.amount) : grossForNet(r.kind, toNum(r.amount)));
  const calc = useMemo(() => rows.map((r) => calcFee(r.kind, grossOf(r))), [rows, mode]);
  const feeRows: FeeRow[] = rows.map((r, i) => ({ name: r.name.trim(), kind: r.kind, gross: calc[i].gross, memo: r.memo.trim() }));
  const total = sumRows(feeRows);
  const biz = sumRows(feeRows.filter((r) => r.kind === "business"));
  const oth = sumRows(feeRows.filter((r) => r.kind === "other"));

  const patch = (key: number, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const filled = feeRows.filter((r) => r.gross > 0);

  const doSave = () => {
    if (!filled.length) return toast.error("지급액을 입력한 사람이 없습니다.");
    save.mutate({ id: currentId, title: title.trim() || `강사비 ${new Date().toLocaleDateString("ko-KR")}`, rows: filled });
    if (!title.trim()) setTitle(`강사비 ${new Date().toLocaleDateString("ko-KR")}`);
  };
  const load = (s: NonNullable<typeof saved.data>[number]) => {
    setCurrentId(s.id); setTitle(s.title); setMode("gross");
    setRows(s.rows.map((r) => ({ key: seq++, name: r.name, kind: r.kind, amount: r.gross ? won(r.gross) : "", memo: r.memo ?? "" })));
  };
  const reset = () => { setCurrentId(undefined); setTitle(""); setMode("gross"); setRows([newRow(), newRow(), newRow()]); };
  const copySummary = () => {
    const lines = ["이름\t구분\t지급액\t소득세\t지방소득세\t실수령액"];
    filled.forEach((r) => { const c = calcFee(r.kind, r.gross); lines.push(`${r.name || "-"}\t${r.kind === "business" ? "사업소득" : "기타소득"}\t${c.gross}\t${c.incomeTax}\t${c.localTax}\t${c.net}`); });
    lines.push(`합계\t\t${total.gross}\t${total.incomeTax}\t${total.localTax}\t${total.net}`);
    navigator.clipboard.writeText(lines.join("\n")).then(() => toast.success("표 형태로 복사했습니다. 엑셀·한글에 붙여넣으세요."));
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Calculator className="h-5 w-5" />
          <h1 className="text-xl font-bold">강사비 계산기</h1>
          {currentId && <Badge variant="secondary">저장본 수정 중</Badge>}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">계산 기준</CardTitle>
            <CardDescription className="space-y-0.5">
              <span className="block">· 사업소득: 소득세 3% + 지방소득세 0.3% = <b>3.3%</b> 원천징수</span>
              <span className="block">· 기타소득: 소득세 8% + 지방소득세 0.8% = <b>8.8%</b> 원천징수, 지급액 <b>125,000원 이하</b>는 세금 없음</span>
              <span className="block">· 세금은 10원 미만 절사. 실제 신고·납부 전에 소속 기관 회계 기준을 꼭 확인하세요.</span>
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <Input className="w-64" placeholder="저장 이름 (예: 10월 한국어교실 강사비)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
              <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gross">지급액(세전) 입력</SelectItem>
                  <SelectItem value="net">실수령액(세후) 입력 → 지급액 역산</SelectItem>
                </SelectContent>
              </Select>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" onClick={reset}><FilePlus2 className="mr-1 h-4 w-4" />새로 시작</Button>
                <Button variant="outline" size="sm" onClick={copySummary} disabled={!filled.length}><Copy className="mr-1 h-4 w-4" />표로 복사</Button>
                <Button size="sm" onClick={doSave} disabled={save.isPending}><Save className="mr-1 h-4 w-4" />{currentId ? "덮어 저장" : "저장"}</Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="p-1">이름</th><th className="p-1">소득 구분</th>
                    <th className="p-1">{mode === "gross" ? "지급액(세전)" : "실수령액(세후)"}</th>
                    <th className="p-1 text-right">지급액</th><th className="p-1 text-right">소득세</th><th className="p-1 text-right">지방소득세</th><th className="p-1 text-right">실수령액</th>
                    <th className="p-1">메모</th><th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const c = calc[i];
                    return (
                      <tr key={r.key} className="border-b">
                        <td className="p-1"><Input className="h-8 w-28" value={r.name} onChange={(e) => patch(r.key, { name: e.target.value })} maxLength={50} /></td>
                        <td className="p-1">
                          <Select value={r.kind} onValueChange={(v) => patch(r.key, { kind: v as FeeKind })}>
                            <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="business">사업소득 3.3%</SelectItem>
                              <SelectItem value="other">기타소득 8.8%</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-1"><Input className="h-8 w-32 text-right" inputMode="numeric" value={r.amount} onChange={(e) => patch(r.key, { amount: fmtInput(e.target.value) })} placeholder="0" /></td>
                        <td className="p-1 text-right tabular-nums">{c.gross ? won(c.gross) : "-"}</td>
                        <td className="p-1 text-right tabular-nums">{c.gross ? won(c.incomeTax) : "-"}</td>
                        <td className="p-1 text-right tabular-nums">{c.gross ? won(c.localTax) : "-"}</td>
                        <td className="p-1 text-right font-medium tabular-nums">{c.gross ? won(c.net) : "-"}</td>
                        <td className="p-1"><Input className="h-8 w-28" value={r.memo} onChange={(e) => patch(r.key, { memo: e.target.value })} maxLength={100} /></td>
                        <td className="p-1"><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : rs))}><Trash2 className="h-4 w-4" /></Button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, newRow("business")])}><Plus className="mr-1 h-4 w-4" />사람 추가</Button>
              <Button variant="ghost" size="sm" onClick={() => setRows((rs) => [...rs, ...Array.from({ length: 5 }, () => newRow("business"))])}>5줄 추가</Button>
              <Button variant="ghost" size="sm" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, kind: "business" })))}>전체 사업소득으로</Button>
              <Button variant="ghost" size="sm" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, kind: "other" })))}>전체 기타소득으로</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">합계 ({total.count}명)</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground">
                <th className="p-1">구분</th><th className="p-1 text-right">인원</th><th className="p-1 text-right">지급액</th><th className="p-1 text-right">소득세</th><th className="p-1 text-right">지방소득세</th><th className="p-1 text-right">세금 합계</th><th className="p-1 text-right">실수령액</th>
              </tr></thead>
              <tbody className="tabular-nums">
                {([["사업소득 (3.3%)", biz], ["기타소득 (8.8%)", oth]] as const).map(([label, t]) => (
                  <tr key={label} className="border-b">
                    <td className="p-1">{label}</td><td className="p-1 text-right">{t.count}</td><td className="p-1 text-right">{won(t.gross)}</td><td className="p-1 text-right">{won(t.incomeTax)}</td><td className="p-1 text-right">{won(t.localTax)}</td><td className="p-1 text-right">{won(t.tax)}</td><td className="p-1 text-right">{won(t.net)}</td>
                  </tr>
                ))}
                <tr className="bg-muted/50 font-bold">
                  <td className="p-1">전체</td><td className="p-1 text-right">{total.count}</td><td className="p-1 text-right">{won(total.gross)}</td><td className="p-1 text-right">{won(total.incomeTax)}</td><td className="p-1 text-right">{won(total.localTax)}</td><td className="p-1 text-right">{won(total.tax)}</td><td className="p-1 text-right">{won(total.net)}</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">저장한 계산</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {(saved.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">아직 저장한 계산이 없습니다.</p>}
            {(saved.data ?? []).map((s) => (
              <div key={s.id} className={`flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm ${s.id === currentId ? "border-primary" : ""}`}>
                <button className="min-w-0 flex-1 text-left" onClick={() => load(s)}>
                  <span className="font-medium">{s.title}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{s.totals.count}명 · 지급 {won(s.totals.gross)}원 · 실수령 {won(s.totals.net)}원 · {new Date(s.updatedAt).toLocaleDateString("ko-KR")}</span>
                </button>
                <Button size="sm" variant="outline" onClick={() => load(s)}>불러오기</Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { if (confirm(`'${s.title}'을(를) 삭제할까요?`)) remove.mutate({ id: s.id }); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
