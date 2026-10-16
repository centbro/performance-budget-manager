import { useState } from "react";
import { useLocation } from "wouter";
import { BookOpen, ClipboardCheck, ClipboardPen, FileText, Megaphone, Wand2, X, Upload, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ACTIONS = [
  { to: "/business-plans", icon: FileText, title: "사업계획서 쓰기", desc: "공동모금회 양식 또는 우리 기관 양식" },
  { to: "/grant-review", icon: ClipboardCheck, title: "공모사업 점수 평가", desc: "모집요강 기준으로 채점·보완점" },
  { to: "/tools", icon: Wand2, title: "기안서·공문 쓰기", desc: "행정 문서 초안, 프로그램 아이디어" },
  { to: "/promo", icon: Megaphone, title: "홍보·소식글 쓰기", desc: "블로그·인스타·보도자료" },
  { to: "/case-records", icon: ClipboardPen, title: "사례 기록하기", desc: "메모만 적으면 양식에 자동 정리" },
  { to: "/projects", icon: BookOpen, title: "실적·예산 관리", desc: "참여자, 실적, 예산, 일정" },
] as const;

const STORAGE_KEY = "quickstart-dismissed";
const readDismissed = () => {
  try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
};

/** 첫 화면 상단: 오늘 하려는 일 바로가기 + 처음 시작 안내 */
export default function QuickStart() {
  const [, setLocation] = useLocation();
  const [hideGuide, setHideGuide] = useState(readDismissed);
  const dismiss = () => {
    setHideGuide(true);
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* 저장 불가 환경 */ }
  };

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">무엇을 하시겠어요?</h2>
        <p className="text-sm text-muted-foreground">자주 쓰는 작업으로 바로 이동합니다.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {ACTIONS.map((a) => (
          <Card key={a.to} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => setLocation(a.to)}>
            <CardContent className="p-4 space-y-1">
              <a.icon className="h-5 w-5 text-primary" />
              <p className="font-medium text-sm">{a.title}</p>
              <p className="text-xs text-muted-foreground">{a.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {!hideGuide && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="flex-1 text-sm space-y-1">
              <p className="font-medium">처음이세요? 이렇게 시작하면 편해요</p>
              <ol className="list-decimal pl-5 text-muted-foreground space-y-0.5">
                <li><Upload className="inline h-3.5 w-3.5 mr-1" />우리 기관 양식(PDF)을 한 번 등록하세요 — <button className="underline text-foreground" onClick={() => setLocation("/tools")}>행정 문서·양식</button></li>
                <li>기관에서 쓰던 홍보글을 샘플로 저장하세요 — <button className="underline text-foreground" onClick={() => setLocation("/promo")}>홍보·소식글</button></li>
                <li>사업 지침·공고문 PDF를 올려 두면 글을 쓸 때 근거로 반영됩니다 — <button className="underline text-foreground" onClick={() => setLocation("/references")}>참고자료 보관함</button></li>
              </ol>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="안내 닫기" onClick={dismiss}><X className="h-4 w-4" /></Button>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
