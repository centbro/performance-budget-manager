import { toast } from "sonner";

/** 지금 열려 있는 화면의 버전(불러온 메인 스크립트 파일명) */
const loadedVersion = () => document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]')?.getAttribute("src") ?? "";

/**
 * 배포로 새 버전이 나왔는데 옛 화면이 열려 있으면 '새로고침' 안내를 띄운다.
 * (작성 중인 내용이 사라질 수 있어 저절로 새로고침하지는 않는다.)
 */
export function startVersionCheck() {
  const mine = loadedVersion();
  if (!mine) return; // 개발 모드
  let shown = false;
  const check = async () => {
    if (shown || document.hidden) return;
    try {
      const r = await fetch("/api/version", { cache: "no-store" });
      const { v } = await r.json();
      if (v && v !== mine) {
        shown = true;
        toast("새 버전이 나왔어요", {
          description: "새로고침하면 바뀐 기능이 적용됩니다.",
          duration: Infinity,
          action: { label: "새로고침", onClick: () => window.location.reload() },
        });
      }
    } catch { /* 네트워크 오류는 다음에 다시 확인 */ }
  };
  document.addEventListener("visibilitychange", check);
  window.setInterval(check, 3 * 60 * 1000);
  window.setTimeout(check, 15 * 1000);
}
