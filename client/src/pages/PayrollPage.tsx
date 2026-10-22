import { useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { Banknote, Copy, Plus, Save, Trash2, FilePlus2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAY_GRADES, MAX_STEP, basePay } from "@shared/payrollTable";
import { calcPay, defaultHourly, type PayInput } from "@shared/payroll";

type Emp = {
  key: number; name: string; grade: number; step: number;
  baseOverride: string; hourlyOverride: string;
  overtimeHours: string; leaveDays: string; holidayBonus: boolean;
  family: string; seniority: string; meal: string; position: string; otherPay: string;
  pensionBase: string; healthBase: string; incomeTax: string; otherDeduct: string;
};

const STORE_KEY = "payroll_sets_v1";
let seq = 1;
const newEmp = (): Emp => ({
  key: seq++, name: "", grade: 4, step: 1, baseOverride: "", hourlyOverride: "", overtimeHours: "", leaveDays: "", holidayBonus: false,
  family: "", seniority: "", meal: "160,000", position: "", otherPay: "", pensionBase: "", healthBase: "", incomeTax: "", otherDeduct: "",
});
const won = (n: number) => n.toLocaleString("ko-KR");
const num = (s: string) => Number(String(s).replace(/[^\d.]/g, "")) || 0;
const money = (s: string) => { const n = num(s); return n ? won(Math.floor(n)) : ""; };

function toInput(e: Emp): PayInput & { base: number } {
  const base = e.baseOverride ? num(e.baseOverride) : basePay(e.grade, e.step);
  const hourly = e.hourlyOverride ? num(e.hourlyOverride) : defaultHourly(base);
  return {
    base, baseSalary: base, overtimeHours: num(e.overtimeHours), hourlyWage: hourly, leaveDays: num(e.leaveDays), holidayBonus: e.holidayBonus,
    familyAllowance: num(e.family), seniorityAllowance: num(e.seniority), mealAllowance: num(e.meal), positionAllowance: num(e.position), otherPay: num(e.otherPay),
    pensionBase: num(e.pensionBase), healthBase: num(e.healthBase), incomeTax: num(e.incomeTax), otherDeduct: num(e.otherDeduct),
  };
}

type Saved = { title: string; emps: Emp[]; savedAt: string };
function readStore(): Saved[] { try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]"); } catch { return []; } }
function writeStore(v: Saved[]) { try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); return true; } catch { return false; } }

function MoneyField({ label, value, onChange, hint, placeholder }: { label: string; value: string; onChange: (v: string) => void; hint?: string; placeholder?: string }) {
  const id = useId();
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input id={id} className="h-8 text-right" inputMode="numeric" value={value} placeholder={placeholder ?? "0"} onChange={(e) => onChange(money(e.target.value))} />
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function PayrollPage() {
  const [title, setTitle] = useState("");
  const [emps, setEmps] = useState<Emp[]>([newEmp()]);
  const [saved, setSaved] = useState<Saved[]>([]);
  useEffect(() => setSaved(readStore()), []);

  const patch = (key: number, p: Partial<Emp>) => setEmps((l) => l.map((e) => (e.key === key ? { ...e, ...p } : e)));
  const results = useMemo(() => emps.map((e) => calcPay(toInput(e))), [emps]);
  const sum = useMemo(() => {
    const t = { gross: 0, deduct: 0, net: 0, employer: 0, n: 0 };
    emps.forEach((e, i) => { if (results[i].gross > 0) { t.n++; t.gross += results[i].gross; t.deduct += results[i].totalDeduct; t.net += results[i].net; t.employer += results[i].employerTotal; } });
    return t;
  }, [emps, results]);

  const doSave = () => {
    const t = title.trim() || `급여 ${new Date().toLocaleDateString("ko-KR")}`;
    const list = readStore().filter((s) => s.title !== t);
    list.unshift({ title: t, emps, savedAt: new Date().toISOString() });
    if (!writeStore(list.slice(0, 50))) return toast.error("이 브라우저에는 저장할 수 없습니다.");
    setTitle(t); setSaved(list.slice(0, 50)); toast.success("이 컴퓨터(브라우저)에 저장했습니다.");
  };
  const load = (s: Saved) => { setTitle(s.title); setEmps(s.emps.map((e) => ({ ...newEmp(), ...e, key: seq++ }))); };
  const del = (t: string) => { if (!confirm(`'${t}'을(를) 삭제할까요?`)) return; const l = readStore().filter((s) => s.title !== t); writeStore(l); setSaved(l); };
  const copyTable = () => {
    const head = ["이름", "기본급", "시간외수당", "가족수당", "명절휴가비", "직급수당", "연차수당", "장기근속수당", "정액급식비", "기타", "지급합계", "국민연금", "건강보험", "요양보험", "고용보험", "소득세", "주민세", "기타공제", "공제합계", "실수령액"];
    const lines = [head.join("\t")];
    emps.forEach((e, i) => { const r = results[i]; if (!r.gross) return; const p = r.pays, d = r.deductions;
      lines.push([e.name || `직원${i + 1}`, p.base, p.overtime, p.family, p.holiday, p.position, p.leave, p.seniority, p.meal, p.other, r.gross, d.pension, d.health, d.ltc, d.employment, d.incomeTax, d.localTax, d.other, r.totalDeduct, r.net].join("\t")); });
    navigator.clipboard.writeText(lines.join("\n")).then(() => toast.success("표로 복사했습니다. 엑셀에 붙여넣으세요."));
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-4 p-4">
        <div className="flex items-center gap-2"><Banknote className="h-5 w-5" /><h1 className="text-xl font-bold">직원 급여 계산기</h1></div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">계산 기준 (2026년)</CardTitle>
            <CardDescription className="space-y-0.5">
              <span className="block">· 기본급: 2026년 사회복지시설 종사자 기본급 권고 기준표(직위·호봉). 금액을 직접 고칠 수도 있습니다.</span>
              <span className="block">· 국민연금 4.75% / 건강보험 3.595% / 요양보험 = 건강보험료×13.14% / 고용보험 0.9% / 주민세 = 소득세×10% (각 10원 미만 절사)</span>
              <span className="block">· 국민연금·건강보험·고용보험은 <b>신고된 기준소득월액·보수월액</b>으로 계산합니다(급여명세서의 금액과 같아야 합니다).</span>
              <span className="block">· 소득세는 간이세액표(부양가족 수 반영)에서 찾은 금액을 직접 입력하세요. 자동 계산은 아직 없습니다.</span>
              <span className="block">· 입력한 내용은 서버로 보내지 않고, 저장도 <b>이 컴퓨터의 브라우저</b>에만 됩니다.</span>
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <Input className="w-64" placeholder="저장 이름 (예: 2026년 10월 급여)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setTitle(""); setEmps([newEmp()]); }}><FilePlus2 className="mr-1 h-4 w-4" />새로 시작</Button>
            <Button variant="outline" size="sm" onClick={copyTable} disabled={!sum.n}><Copy className="mr-1 h-4 w-4" />표로 복사</Button>
            <Button size="sm" onClick={doSave}><Save className="mr-1 h-4 w-4" />저장</Button>
          </div>
        </div>

        {emps.map((e, idx) => {
          const r = results[idx]; const inp = toInput(e); const autoBase = basePay(e.grade, e.step);
          return (
            <Card key={e.key}>
              <CardContent className="space-y-3 pt-6">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1"><Label className="text-xs">이름(별칭)</Label><Input aria-label="이름" className="h-8 w-32" value={e.name} onChange={(ev) => patch(e.key, { name: ev.target.value })} placeholder={`직원${idx + 1}`} maxLength={50} /></div>
                  <div className="space-y-1"><Label className="text-xs">직위</Label>
                    <Select value={String(e.grade)} onValueChange={(v) => patch(e.key, { grade: Number(v), baseOverride: "" })}>
                      <SelectTrigger className="h-8 w-64"><SelectValue /></SelectTrigger>
                      <SelectContent>{PAY_GRADES.map((g, i) => <SelectItem key={i} value={String(i)}>{g}</SelectItem>)}</SelectContent>
                    </Select></div>
                  <div className="space-y-1"><Label className="text-xs">호봉</Label>
                    <Select value={String(e.step)} onValueChange={(v) => patch(e.key, { step: Number(v), baseOverride: "" })}>
                      <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>{Array.from({ length: MAX_STEP }, (_, i) => <SelectItem key={i} value={String(i + 1)}>{i + 1}호봉</SelectItem>)}</SelectContent>
                    </Select></div>
                  <Button size="icon" variant="ghost" className="ml-auto h-8 w-8" onClick={() => setEmps((l) => (l.length > 1 ? l.filter((x) => x.key !== e.key) : l))}><Trash2 className="h-4 w-4" /></Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">지급 항목</p>
                    <div className="grid grid-cols-2 gap-2">
                      <MoneyField label="기본급" value={e.baseOverride} onChange={(v) => patch(e.key, { baseOverride: v })} placeholder={autoBase ? won(autoBase) : "해당 호봉 없음"} hint={autoBase ? "비우면 기준표 금액" : "기준표에 없는 호봉 — 직접 입력"} />
                      <MoneyField label="통상시급" value={e.hourlyOverride} onChange={(v) => patch(e.key, { hourlyOverride: v })} placeholder={won(defaultHourly(inp.base))} hint="비우면 기본급÷209" />
                      <div className="space-y-1"><Label className="text-xs">연장근로시간</Label><Input aria-label="연장근로시간" className="h-8 text-right" inputMode="decimal" value={e.overtimeHours} onChange={(ev) => patch(e.key, { overtimeHours: ev.target.value.replace(/[^\d.]/g, "") })} placeholder="0" /><p className="text-[10px] text-muted-foreground">시간 × 통상시급 × 1.5</p></div>
                      <div className="space-y-1"><Label className="text-xs">연차수당 잔여일수</Label><Input aria-label="연차수당 잔여일수" className="h-8 text-right" inputMode="decimal" value={e.leaveDays} onChange={(ev) => patch(e.key, { leaveDays: ev.target.value.replace(/[^\d.]/g, "") })} placeholder="0" /><p className="text-[10px] text-muted-foreground">8시간 × 통상시급 × 일수</p></div>
                      <MoneyField label="가족수당" value={e.family} onChange={(v) => patch(e.key, { family: v })} hint="지자체 기준 금액" />
                      <MoneyField label="장기근속수당" value={e.seniority} onChange={(v) => patch(e.key, { seniority: v })} />
                      <MoneyField label="정액급식비" value={e.meal} onChange={(v) => patch(e.key, { meal: v })} />
                      <MoneyField label="직급·직책수당" value={e.position} onChange={(v) => patch(e.key, { position: v })} />
                      <MoneyField label="기타 지급" value={e.otherPay} onChange={(v) => patch(e.key, { otherPay: v })} />
                      <label className="flex items-center gap-2 pt-5 text-xs"><Checkbox checked={e.holidayBonus} onCheckedChange={(c) => patch(e.key, { holidayBonus: !!c })} />이번 달 명절휴가비(기본급×60%)</label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">공제 항목</p>
                    <div className="grid grid-cols-2 gap-2">
                      <MoneyField label="국민연금 기준소득월액" value={e.pensionBase} onChange={(v) => patch(e.key, { pensionBase: v })} hint="신고된 금액" />
                      <MoneyField label="건강·고용보험 보수월액" value={e.healthBase} onChange={(v) => patch(e.key, { healthBase: v })} hint="신고된 금액" />
                      <MoneyField label="소득세 (간이세액표)" value={e.incomeTax} onChange={(v) => patch(e.key, { incomeTax: v })} hint="주민세는 자동(10%)" />
                      <MoneyField label="기타 공제" value={e.otherDeduct} onChange={(v) => patch(e.key, { otherDeduct: v })} />
                    </div>
                  </div>
                </div>

                {r.gross > 0 && (
                  <div className="grid gap-3 rounded-md bg-muted/40 p-3 text-sm md:grid-cols-3">
                    <div>
                      <p className="mb-1 text-xs font-semibold text-muted-foreground">지급</p>
                      {([["기본급", r.pays.base], ["시간외수당", r.pays.overtime], ["가족수당", r.pays.family], ["명절휴가비", r.pays.holiday], ["직급수당", r.pays.position], ["연차수당", r.pays.leave], ["장기근속수당", r.pays.seniority], ["정액급식비", r.pays.meal], ["기타", r.pays.other]] as const).filter(([, v]) => v > 0).map(([k, v]) => (
                        <div key={k} className="flex justify-between tabular-nums"><span>{k}</span><span>{won(v)}</span></div>))}
                      <div className="mt-1 flex justify-between border-t pt-1 font-semibold tabular-nums"><span>지급 합계</span><span>{won(r.gross)}</span></div>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-muted-foreground">공제</p>
                      {([["국민연금", r.deductions.pension], ["건강보험", r.deductions.health], ["요양보험", r.deductions.ltc], ["고용보험", r.deductions.employment], ["소득세", r.deductions.incomeTax], ["주민세", r.deductions.localTax], ["기타", r.deductions.other]] as const).filter(([, v]) => v > 0).map(([k, v]) => (
                        <div key={k} className="flex justify-between tabular-nums"><span>{k}</span><span>{won(v)}</span></div>))}
                      <div className="mt-1 flex justify-between border-t pt-1 font-semibold tabular-nums"><span>공제 합계</span><span>{won(r.totalDeduct)}</span></div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground">실수령액</p>
                      <p className="text-2xl font-bold tabular-nums">{won(r.net)}원</p>
                      <p className="text-xs text-muted-foreground">기관 부담 4대보험(산재 제외) 약 {won(r.employerTotal)}원</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        <Button variant="outline" onClick={() => setEmps((l) => [...l, newEmp()])}><Plus className="mr-1 h-4 w-4" />직원 추가</Button>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">합계 ({sum.n}명)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4 tabular-nums">
            <div><p className="text-xs text-muted-foreground">지급 합계</p><p className="font-bold">{won(sum.gross)}원</p></div>
            <div><p className="text-xs text-muted-foreground">공제 합계</p><p className="font-bold">{won(sum.deduct)}원</p></div>
            <div><p className="text-xs text-muted-foreground">실수령 합계</p><p className="font-bold">{won(sum.net)}원</p></div>
            <div><p className="text-xs text-muted-foreground">기관 부담 4대보험(산재 제외)</p><p className="font-bold">{won(sum.employer)}원</p></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">저장한 계산 (이 브라우저)</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {saved.length === 0 && <p className="text-sm text-muted-foreground">아직 없습니다.</p>}
            {saved.map((s) => (
              <div key={s.title} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <button className="min-w-0 flex-1 text-left" onClick={() => load(s)}><span className="font-medium">{s.title}</span><span className="ml-2 text-xs text-muted-foreground">{s.emps.length}명 · {new Date(s.savedAt).toLocaleDateString("ko-KR")}</span></button>
                <Button size="sm" variant="outline" onClick={() => load(s)}>불러오기</Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => del(s.title)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
