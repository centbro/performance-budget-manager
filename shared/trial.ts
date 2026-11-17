import { endOfDayKst } from "./access";

/** 신규 가입 무료 이용: 이 날(한국 시간) 끝까지 모두 무료. 2027년부터 유료 전환 예정. */
export const FREE_UNTIL_DATE = "2026-12-31";
/** 무료 기간이 끝난 뒤 가입한 사람에게 주는 체험 기간(일) */
export const TRIAL_DAYS = 14;

const DAY = 24 * 3600_000;

/** 지금 가입하면 받는 이용 만료일: 무료 기간 중이면 무료 종료일, 이후면 가입일 + 체험 기간 */
export function trialUntil(now: Date = new Date()): Date {
  const freeEnd = endOfDayKst(FREE_UNTIL_DATE);
  return now.getTime() <= freeEnd.getTime() ? freeEnd : new Date(now.getTime() + TRIAL_DAYS * DAY);
}

/** 가입 안내 문구(화면·가입 완료 메시지 공용) */
export function trialLabel(now: Date = new Date()): string {
  const [y, m, d] = FREE_UNTIL_DATE.split("-").map(Number);
  return now.getTime() <= endOfDayKst(FREE_UNTIL_DATE).getTime()
    ? `${y}년 ${m}월 ${d}일까지 모든 기능을 무료로 이용할 수 있습니다.`
    : `${TRIAL_DAYS}일 동안 모든 기능을 체험할 수 있습니다.`;
}
