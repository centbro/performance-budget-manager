import { useState } from "react";
import { useLocation } from "wouter";
import { BookOpen, ClipboardCheck, ClipboardPen, MessagesSquare, X, FolderOpen, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/App";

const TONES = ["bg-teal-50 text-teal-600", "bg-amber-50 text-amber-600", "bg-sky-50 text-sky-600", "bg-rose-50 text-rose-500", "bg-violet-50 text-violet-600", "bg-emerald-50 text-emerald-600"];

const ACTIONS = [
  { to: "/doc-chat", icon: MessagesSquare, title: "대화로 문서 작성", desc: "폴더를 지정하고 시키면 문서 작성" },
  { to: "/grant-review", icon: ClipboardCheck, title: "공모사업 점수 평가", desc: "모집요강 기준으로 채점·보완점" },
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

  const { user } = useAuthContext();
  const name = user?.name?.trim();
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold">{name ? `${name}님, 오늘은 무엇을 도와드릴까요? 👋` : "오늘은 무엇을 도와드릴까요? 👋"}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">자주 쓰는 작업을 골라 바로 시작해 보세요.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {ACTIONS.map((a, i) => (
          <Card key={a.to} className="group cursor-pointer gap-0 py-0 border-transparent shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md" onClick={() => setLocation(a.to)}>
            <CardContent className="p-3 sm:p-4 space-y-1.5">
              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${TONES[i % TONES.length]}`}><a.icon className="h-[18px] w-[18px]" /></span>
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
                <li><FolderOpen className="inline h-3.5 w-3.5 mr-1" />작년·재작년 문서가 든 폴더를 지정하고 만들 문서를 말로 시키세요 — <button className="underline text-foreground" onClick={() => setLocation("/doc-chat")}>대화로 문서 작성</button></li>
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
