export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// 자체 이메일/비밀번호 인증만 사용하므로 로그인 경로는 항상 /login
export const getLoginUrl = () => "/login";
