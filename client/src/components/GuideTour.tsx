import { useEffect, useLayoutEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type Step = { title: string; body: string; target?: string };

/** 처음 접속한 사람에게 보여주는 사용법 안내(단계별 카드 + 사이드바 메뉴 강조) */
export const FULL_STEPS: Step[] = [
  { title: "복지실무톡에 오신 것을 환영합니다", body: "사회복지 실무에서 반복되는 서류·기록·일정·예산 일을 줄여 주는 도구입니다. 1분이면 끝나는 안내예요. 건너뛰어도 되고, 계정 메뉴의 '사용법 안내'에서 언제든 다시 볼 수 있습니다." },
  { title: "1. 사업 관리", body: "사업을 먼저 등록하면 실적·참여자·예산·일정이 그 사업 아래로 묶입니다. 사업명과 기간만 넣고 시작하세요.", target: "/projects" },
  { title: "2. 스케줄 관리", body: "사업 일정은 물론 당직·회의·연차 같은 개인 일정도 함께 넣을 수 있습니다. 시간까지 적어 둘 수 있어요.", target: "/global-schedule" },
  { title: "3. 대화로 문서 작성 (핵심 기능)", body: "① '폴더 열기'로 작년 문서가 있는 폴더를 고르고(크롬·엣지) ② 무슨 문서를 쓸지 말하면 ③ 참고할 파일을 AI가 골라 읽고 초안을 씁니다. 결과는 Word나 한글(hwpx)로 바로 받을 수 있고, 한글 파일은 서식을 그대로 두고 내용만 고쳐 쓸 수도 있습니다. 개인정보가 많은 명단 파일은 폴더에서 빼 주세요.", target: "/doc-chat" },
  { title: "4. 출석부·강사비 계산기", body: "반별 출결을 기록하고, 강사비는 사업소득 3.3%·기타소득 8.8% 기준으로 계산합니다.", target: "/attendance" },
  { title: "5. 예산만 관리하고 싶다면", body: "사업을 등록하지 않아도 됩니다. 화면 왼쪽 아래 계정 메뉴에서 '회계 전용 모드로 전환'하면 예산 → 세부항목 → 지출만 관리하는 화면이 나옵니다. 분기별로 나눌지는 예산마다 고를 수 있어요." },
  { title: "6. 문의와 이용 현황", body: "궁금한 점이나 바라는 기능은 '의견 게시판'에 남겨 주세요. '내 이용 현황'에서는 AI 사용량과 이용 기간을 볼 수 있습니다. AI가 쓴 글은 초안이니, 제출 전에 꼭 확인해 주세요.", target: "/board" },
];

export const ACCOUNTING_STEPS: Step[] = [
  { title: "회계 전용 모드에 오신 것을 환영합니다", body: "사업을 등록하지 않고 예산만 관리하는 화면입니다. 1분 안내예요. 계정 메뉴의 '사용법 안내'에서 다시 볼 수 있습니다." },
  { title: "1. 예산 등록", body: "'예산 등록'을 눌러 예산 이름(예: 2026 후원금)을 만듭니다. 이때 '분기별로 나눠 관리'를 켤지 고르세요. 나중에 바꿔도 총액은 유지됩니다.", target: "/accounting" },
  { title: "2. 세부항목 정하기", body: "예산 안에 인건비·운영비 같은 세부항목을 추가하고 금액을 정합니다. 분기별 관리를 켰다면 항목마다 1~4분기 금액을 넣고, '똑같이 나누기'도 쓸 수 있어요." },
  { title: "3. 지출 기록", body: "쓴 돈을 날짜·항목·금액·내용으로 기록하면 항목별·분기별 사용액과 남은 금액이 자동으로 계산됩니다." },
  { title: "4. 한눈에 보기", body: "첫 화면 대시보드에서 총예산·사용한 금액·남은 금액, 예산별 사용률, 월별 사용액, 최근 지출을 한 번에 볼 수 있습니다." },
  { title: "5. 문의", body: "궁금한 점은 '의견 게시판'에 남겨 주세요. 전체 메뉴가 필요하면 계정 메뉴에서 '전체 메뉴로 보기'로 돌아갈 수 있습니다.", target: "/board" },
];

const key = (uid: number) => `tour-done-v1-${uid}`;
export const tourSeen = (uid: number) => { try { return localStorage.getItem(key(uid)) === "1"; } catch { return true; } };
const markSeen = (uid: number) => { try { localStorage.setItem(key(uid), "1"); } catch { /* 저장이 막혀도 안내는 계속 동작 */ } };

export default function GuideTour({ userId, accounting, open, onClose }: { userId: number; accounting: boolean; open: boolean; onClose: () => void }) {
  const steps = accounting ? ACCOUNTING_STEPS : FULL_STEPS;
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[Math.min(i, steps.length - 1)];

  useEffect(() => { if (open) setI(0); }, [open, accounting]);

  useLayoutEffect(() => {
    if (!open || !step.target) { setRect(null); return; }
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!el) { setRect(null); return; }
    el.scrollIntoView({ block: "nearest" });
    const upd = () => setRect(el.getBoundingClientRect());
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, [open, i, step.target]);

  if (!open) return null;
  const finish = () => { markSeen(userId); onClose(); };
  const last = i >= steps.length - 1;

  return (
    <>
      {rect && <div className="pointer-events-none fixed z-[60] rounded-lg ring-4 ring-primary/70 transition-all" style={{ left: rect.left - 4, top: rect.top - 2, width: rect.width + 8, height: rect.height + 4 }} />}
      <div role="dialog" aria-label="사용법 안내" className="fixed bottom-4 right-4 z-[61] w-[min(24rem,calc(100vw-2rem))] rounded-xl border bg-background p-4 shadow-xl">
        <button type="button" onClick={finish} className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted" aria-label="안내 닫기"><X className="h-4 w-4" /></button>
        <p className="text-xs text-muted-foreground">{i + 1} / {steps.length}</p>
        <h3 className="mt-1 pr-6 text-base font-semibold">{step.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={finish}>건너뛰기</Button>
          <div className="flex gap-2">
            {i > 0 && <Button variant="outline" size="sm" onClick={() => setI(i - 1)}>이전</Button>}
            <Button size="sm" onClick={() => (last ? finish() : setI(i + 1))}>{last ? "시작하기" : "다음"}</Button>
          </div>
        </div>
      </div>
    </>
  );
}
