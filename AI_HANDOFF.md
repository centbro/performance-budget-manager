# 복지실무톡 (psk.lol) — 다른 대화창/AI 인수인계 (2026-10-27 기준)

사회복지 기관 실무자용 한국어 웹앱. 저장소 `centbro/performance-budget-manager`, `main`에 합치면 Render가 자동 배포. 사용자(뇌로, 화성시외국인복지센터)는 한국어로 대화하며 **git 커밋·PR·병합을 전부 Claude에게 맡긴다.** 답변은 항상 한국어.

## 1. 기술 스택
- 프론트: React 19 + Vite + Tailwind 4 + wouter(라우팅) / 백엔드: Express + tRPC 11(superjson) + Drizzle(MySQL/TiDB)
- 인증: 자체 이메일/비밀번호, `local_session` 쿠키, 관리자 승인제(`local_users.status`). 서버 `validateSession`
- AI: Gemini(OpenAI 호환 엔드포인트), `server/simpleLlm.ts`. AI 기능은 `aiProcedure(feature)`로 요금제 한도 적용(`shared/plans.ts`: 프로 9,900원 / 프리미엄 15,000원)
- 테이블 자동 생성: `server/autoMigrate.ts`의 `CREATE TABLE IF NOT EXISTS` 문자열 + `ALTER TABLE ... ADD COLUMN`(중복 컬럼 오류 무시). **새 테이블/컬럼은 drizzle/schema.ts와 autoMigrate.ts 둘 다 고쳐야 함**

## 2. 시작하기
```bash
npm install            # (pnpm도 가능)
cp .env.example .env   # 값 채우기
npx tsc --noEmit       # 타입 검사 (항상 clean 유지)
npx vitest run         # 테스트(server/**/*.test.ts만), 현재 278개 통과
npm run build          # vite build + esbuild
npm run dev            # 개발 서버 :3000
```
환경변수: `DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, GEMINI_API_KEY, GEMINI_API_URL, GEMINI_MODEL, GEMINI_MODEL_FALLBACK, GEMINI_MODEL_STRONG, TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, TELEGRAM_WEBHOOK_SECRET, PUBLIC_BASE_URL(RENDER_EXTERNAL_URL), PORT`. 실제 값은 이 패키지에 없음(Render 환경변수에 있음).

## 3. Git/배포 작업 방식 (중요)
- 기능마다 `origin/main`에서 새 브랜치 → 커밋 → PR → squash 병합. 병합 후 충돌이 나면 origin/main 위로 rebase.
- 이 환경에서는 `gh pr create`가 막혀(GraphQL 403) **REST로** 한다:
  ```bash
  R=centbro/performance-budget-manager
  N=$(gh api repos/$R/pulls -f title=... -f head=<브랜치> -f base=main -f body=... --jq .number)
  sleep 6; gh api -X PUT repos/$R/pulls/$N/merge -f merge_method=squash
  ```
- 병합 뒤 Stop hook이 "푸시 안 됨"이라고 하면 `git push -u origin <브랜치>`(항상 up-to-date) 후 짧게 안내.
- 커밋 메시지 끝: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` + `Claude-Session: <세션 URL>`; PR 본문 끝: `🤖 Generated with [Claude Code](https://claude.com/claude-code)` + 세션 URL.
- 새 대화에서는 세션 URL이 다르니 그 대화의 안내문(attribution reminder)을 따를 것.

## 4. 폴더 지도
- `client/src/pages/` 화면, `client/src/components/DashboardLayout.tsx` 사이드바 메뉴(`MENU_GROUPS`, 회계 모드는 `ACCOUNTING_GROUPS`), `client/src/App.tsx` 라우트·AuthGuard·회계 모드 리다이렉트
- `server/routers.ts` tRPC 라우터 전부(budgetRouter, acctRouter, localAuthRouter, tools …), `server/_core/index.ts` 일반 Express 라우트(`/api/doc-edit/*`, `/api/doc-form`, `/api/version`)
- `shared/` 서버·화면 공용 순수 로직(`docEdit.ts`, `acct.ts`, `plans.ts` 등) — 테스트 쉬움
- `drizzle/schema.ts` 스키마, `server/autoMigrate.ts` 실제 테이블 생성

## 5. 현재 주요 기능 (최근 작업 순)
1. **회계 전용 모드 + 회계 대시보드** (#64, #65): 사업 없이 `acct_budgets → acct_items(세부항목) → acct_expenses`. 예산마다 `splitQuarter`(분기 나눔) 선택, 켜고 끄면 항목 총액 유지하며 재정리. `local_users.accountingMode`가 true면 메뉴가 예산 관리+지원만 보이고 다른 주소는 `/accounting`으로 이동(App.tsx). 전환은 사이드바 계정 메뉴. 대시보드(`acct.dashboard`)는 총예산/사용/잔액, 예산·항목별 사용률, 분기, 월별, 최근 지출. 로직 `shared/acct.ts`, DB `server/acctDb.ts`, 화면 `AccountingPage.tsx`. 기존 사업 예산(`budgets/expenses`, `BudgetPage.tsx`)과는 별개.
2. **배포 후 옛 화면 방지** (#65): index.html은 `no-cache`, `/api/version`(빌드된 메인 스크립트 파일명) + `client/src/lib/versionCheck.ts`가 새 버전이면 "새로고침" 토스트.
3. **스케줄 관리 개인 일정** (#63): `schedules.projectId = 0`이 개인 업무(당직·회의 등), 시간은 description 첫 줄 `시간: HH:MM~HH:MM`로 인코딩.
4. **대화로 문서 작성** (`DocChatPage.tsx`, `server/docEdit.ts`, `shared/docEdit.ts`): 브라우저 폴더 열기(File System Access API, `client/src/lib/folderAccess.ts`)로 hwpx/docx를 서식 유지한 채 고쳐 쓰기. 표 행 추가/삭제, 빈 행 자동 삭제, 열 너비·행 높이 맞춤, 기존 표 복사해 새 표 만들기, "표·빈칸 정리" 지시는 AI 없이 처리, 직전 수정 취소·다시 고치기, 자주 쓰는 문서(양식) 저장(`doc_forms`, base64). 옛 .hwp(OLE)는 못 고침 → 한글에서 hwpx로 다시 저장 안내.
5. 그 밖: 사업·대상자·실적·예산·평가서·사업계획서(AI), 출석부, 강사비 계산기(3.3%/8.8%), 사례 기록, 공모사업 점수 평가, 참고자료 보관함, 의견 게시판, 관리자 승인/요금제, 텔레그램 봇.

## 6. 지켜야 할 규칙
- 사용자별 데이터 소유권 검증을 약화시키지 말 것(모든 쿼리에 userId 조건).
- 변경 전후 `npx tsc --noEmit`, `npx vitest run`, `npm run build`. 한 번에 한 기능씩 작게.
- 비밀값 커밋 금지. `.env`는 저장소에 없음.
- 이 환경은 실제 한글(Hancom), 실제 DB, 브라우저 화면에서 직접 확인하지 못함 → 검증은 단위 테스트·타입·빌드까지이고, 사용자에게 그 한계를 솔직히 알릴 것.

## 7. 사용자 쪽에 남아 있는 일/보류
- 배포 직후 접속 불안정, 텔레그램 봇 무응답, Gemini 결제/폴백 환경변수, 개인정보처리방침 입력값, 기존 참여자 "지금 잠그기" 처리
- 폴더에 있는 옛 .hwp(확장자만 hwpx) 5개는 한글에서 진짜 hwpx로 다시 저장 필요
- 제안만 하고 답 못 받은 것: 반복 일정(매주 당직), 양식 이름 변경/순서, 옛 .hwp 글 읽기, 내 폴더 정리/노트 이미지 메뉴 복구, 회계 모드를 가입 단계에서 고르기

## 8. 새 대화창에 처음 붙여넣을 말
> 이 저장소는 복지실무톡(React/Vite + Express/tRPC + Drizzle, 한국어 사회복지 실무 웹앱)이다. 먼저 `AI_HANDOFF.md`를 읽고, 필요한 파일(`server/routers.ts`, `drizzle/schema.ts`, 해당 `client/src/pages/*`)을 확인해라. 항상 한국어로 답하고, 기능마다 새 브랜치에서 작업해 tsc/vitest/build를 통과시킨 뒤 PR(REST 방식)로 main에 병합까지 해라. 사용자별 데이터 소유권은 약화시키지 마라.
