import { useLocation } from "wouter";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { accessInfo } from "@shared/access";
import { useAuthContext } from "../App";

/** 사이드바 하단 등에 쓰는 남은 이용 기간 한 줄 표시(관리자는 숨김) */
export function AccessLine({ className = "" }: { className?: string }) {
  const { user } = useAuthContext();
  if (!user || user.role === "admin") return null;
  const info = accessInfo(user.accessUntil);
  if (info.state === "unlimited") return null;
  const text = info.state === "expired" ? "이용 기간 만료" : info.daysLeft === 0 ? "오늘까지 이용" : `이용 기간 D-${info.daysLeft}`;
  const tone = info.state === "expired" ? "text-rose-600" : info.warn ? "text-amber-600" : "text-muted-foreground";
  return (
    <p className={`flex items-center gap-1 text-[11px] ${tone} ${className}`}>
      <CalendarClock className="h-3 w-3 shrink-0" />
      {text} <span className="opacity-70">(~{info.until.slice(5).replace("-", "/")})</span>
    </p>
  );
}

/** 만료 임박(7일 이내)·만료 시 화면 상단 안내 배너 */
export function AccessBanner() {
  const { user } = useAuthContext();
  const [, setLocation] = useLocation();
  if (!user || user.role === "admin") return null;
  const info = accessInfo(user.accessUntil);
  if (info.state === "unlimited" || (info.state === "active" && !info.warn)) return null;
  const expired = info.state === "expired";
  return (
    <div className={`flex items-center gap-2 px-4 py-2 text-sm ${expired ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800"}`}>
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        {expired
          ? `이용 기간이 ${info.until}에 만료되었습니다.`
          : info.daysLeft === 0 ? `이용 기간이 오늘(${info.until})까지입니다.` : `이용 기간이 ${info.daysLeft}일 남았습니다 (~${info.until}).`}
        {" "}연장은 관리자에게 문의해 주세요.
      </span>
      <button className="underline font-medium" onClick={() => setLocation("/board")}>문의 남기기</button>
    </div>
  );
}
