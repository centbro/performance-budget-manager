# 실적·예산 관리 + 공동모금회 사업계획서 생성기 (psk.lol)

사회복지 기관용 웹앱입니다. 사업별 실적·대상자·예산·지출·일정 관리와, 공동모금회(사랑의열매) 양식 사업계획서 AI 생성을 제공합니다.

- 프론트엔드: React 19, Vite, Tailwind CSS 4, wouter
- 백엔드: Express 4, tRPC 11, Drizzle ORM (MySQL/TiDB)
- 인증: 자체 이메일/비밀번호 + 관리자 승인
- AI: Google Gemini (OpenAI 호환 엔드포인트)

## 시작하기

```bash
pnpm install
cp .env.example .env   # 값 채우기
pnpm check && pnpm test
pnpm dev               # http://localhost:3000
```

환경변수는 `.env.example` 참고. 최초 관리자 계정은 `ADMIN_EMAIL`/`ADMIN_PASSWORD`가 설정된 경우에만 자동 생성됩니다(코드에 비밀번호를 두지 않음).

## 사업계획서 기능

- **공동모금회 양식 한 번에 생성** (`QuickPlanDialog`, `businessPlans.quickGenerate`): 대상·예산·원하는 효과 → Ⅰ~Ⅹ 섹션 초안.
- **대화형 작성** (기존): 섹션별 질문에 답하며 작성 후 최종본 생성.
- **심사기준 자가진단** (`SelfCheckPanel`, `businessPlans.selfCheck`): 필요성 · 목표/평가 타당성 · 예산 합리성 · 일관성. 기준은 `shared/grantGuide.ts`이며 매년 공고문과 대조해 갱신하세요.
- **배분사례집 검색** (`/cases`, `cases.search`): `server/data/caseIndex.json` 발췌 색인(2016~2025, 약 320건).

- **업무 도우미** (`/tools`, `tools.programIdeas` / `tools.draftDocument`): 대상별 프로그램 아이디어 3안 비교, 기안서·결과보고서·업무보고서·공문 초안. 입력하지 않은 사실은 [확인 필요]로 표시.

- **우리 기관 양식으로 작성** (`/tools`의 세 번째 탭): 기관 양식 PDF를 등록하면 항목 구조를 분석해 저장(`doc_templates` 테이블, 시작 시 자동 생성)하고, 이후 그 항목 순서대로 칸별 내용을 만들어 복사해 붙여 넣게 한다. 스캔본 PDF 불가, 전화·이메일·주민번호는 자동 마스킹.

### 사례집 색인 다시 만들기

```bash
python3 scripts/build_case_index.py <사례집 PDF 폴더>   # pdftotext(poppler) 필요
```

스캔본 PDF(텍스트 없음)는 건너뜁니다. 색인은 자동 추출 발췌이므로 정확한 내용은 원문을 확인하세요.

## 주요 파일

```
shared/businessPlanData.ts   사업계획서 섹션·질문·척도집
shared/grantGuide.ts         공동모금회 분야·심사기준·생성 입력 타입
server/grantPlan.ts          생성/자가진단 프롬프트·파싱
server/caseSearch.ts         사례집 검색
server/routers.ts            tRPC API
client/src/pages/            화면
```

배포(Railway)는 `RAILWAY.md` 참고.
