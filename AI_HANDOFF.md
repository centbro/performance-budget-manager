# 실적·예산 관리 시스템 — 외부 AI 인수인계

## 프로젝트 개요
사회복지 기관용 웹앱입니다. 사업별 실적·대상자·예산·지출·일정과 AI 사업계획서/평가서 자동완성을 제공합니다.

- 프론트엔드: React 19, Vite, Tailwind CSS 4
- 백엔드: Express 4, tRPC 11, Drizzle ORM
- 데이터베이스: MySQL/TiDB 호환 DB
- 인증: 자체 이메일/비밀번호 인증 + 관리자 승인
- 언어: 한국어

## 외부 환경에서 시작하기

```bash
pnpm install
cp .env.example .env   # 아래 환경변수를 실제 값으로 채우기
pnpm check
pnpm test
pnpm dev
```

기본 개발 서버는 `http://localhost:3000`입니다.

## 필요한 환경변수

실제 비밀값은 이 패키지에 포함하지 않았습니다.

- `DATABASE_URL`: MySQL/TiDB 연결 문자열
- `JWT_SECRET`: 세션 서명용 랜덤 비밀값
- **AI 기능 (Google Gemini)**:
  - `GEMINI_API_KEY`: Gemini API 키 (필수, AI Studio에서 발급)
  - `GEMINI_API_URL`: (선택) 기본값 `https://generativelanguage.googleapis.com/v1beta/openai`
  - `GEMINI_MODEL`: (선택) 기본값 `gemini-2.5-flash`
- 파일 업로드: `server/storage.ts`(로컬 파일 저장).
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`: 최초 관리자 계정 생성용(미설정 시 자동 생성 안 함).
- Manus OAuth/SDK/스토리지 프록시는 제거되었고 자체 인증만 사용합니다.

## 주요 파일

- `client/src/pages/ProjectsPage.tsx`: 사업 등록·목록·수정·삭제
- `client/src/pages/Dashboard.tsx`: 사업별 실적 종합현황 및 기간 필터
- `client/src/pages/EvaluationPage.tsx`: 평가서 기간 선택·실적 미리보기·AI 생성
- `client/src/pages/BudgetPage.tsx`: 분기별 누적 지출 배분
- `client/src/pages/BusinessPlanDetailPage.tsx`: 사업계획서 대화형 작성·섹션 편집
- `server/routers.ts`: tRPC API 및 사용자 소유권 검증
- `server/db.ts`: DB 조회·저장·소유권 필터
- `server/projectAccess.ts`: 사업 소유권 공통 판정
- `server/evaluationPeriod.ts`: 평가서 기간 계산
- `drizzle/schema.ts`: DB 스키마
- `drizzle/*.sql`: 마이그레이션 파일

## 현재 완료된 핵심 기능

1. 사용자는 본인이 등록한 사업만 조회·수정·삭제할 수 있습니다.
2. 대상자·실적·예산·지출·일정·대시보드 집계도 사용자별로 분리됩니다.
3. 실적 생성·수정 시 연결 대상자도 같은 계정·사업 소유인지 검증합니다.
4. 타 계정의 실적 수정·삭제 요청은 차단되며 기존 참여자 연결이 보존됩니다.
5. 평가서 자동완성에서 연간/분기/상하반기/사용자 지정 월 범위를 선택할 수 있습니다.
6. AI 생성 전 선택 기간의 실적 건수를 미리 볼 수 있습니다.
7. 사업계획서는 대화형 입력 후 생성되고 섹션별 인라인 편집이 가능합니다.
8. 예산 지출은 실제 지출일이 아니라 1분기부터 순차적으로 누적 배분되어 표시됩니다.

## 검증 결과

- TypeScript: `pnpm exec tsc --noEmit` 통과
- Vitest: 4개 파일, 29개 테스트 통과
- 실제 일반 사용자 2개 계정을 생성해 사업·대상자·실적·대시보드 격리를 검증
- 검증에 사용한 계정과 테스트 데이터는 실행 후 삭제

## 외부 AI에게 처음 전달할 프롬프트 예시

> 이 저장소는 React/Vite + Express/tRPC + Drizzle 기반의 한국어 사회복지 실적·예산 관리 시스템이다. 먼저 `AI_HANDOFF.md`, `README.md`, `drizzle/schema.ts`, `server/routers.ts`, `server/db.ts`를 읽어라. 사용자별 데이터 소유권을 절대 약화시키지 말고, 변경 전 `pnpm check`와 `pnpm test`를 실행하라. 현재 기능을 유지하면서 내가 요청하는 변경만 최소 범위로 수정하라.

## 주의사항

- `.env` 파일, DB 비밀번호, API 키를 저장소에 커밋하지 마세요.
- `node_modules`는 패키지에 포함하지 않았습니다. `pnpm install`로 다시 설치하세요.
- DB 마이그레이션을 적용하기 전에 백업하고, `drizzle/schema.ts`와 SQL 마이그레이션의 일치를 확인하세요.

## 공동모금회 양식 생성기 (추가)

- `businessPlans.quickGenerate` / `regenerateQuick`: 대상·예산·효과 입력으로 Ⅰ~Ⅹ 섹션 생성. 입력은 `inputData._quick`에 JSON으로 보관.
- `businessPlans.selfCheck`: 심사 관점 4개 항목 진단. 결과는 `inputData._selfCheck`에 저장.
- `cases.search`: `server/data/caseIndex.json` 검색. 재생성은 `scripts/build_case_index.py`.
- DB 스키마 변경 없음(기존 `business_plans` 테이블의 JSON 컬럼 사용).
