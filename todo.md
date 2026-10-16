# 실적·예산 관리 시스템 TODO

## 데이터베이스 스키마
- [x] projects 테이블 (사업명, 세부사업명, 계획값: 실인원/연인원/횟수, 수시여부)
- [x] participants 테이블 (사업별 대상자: 이름, 성별)
- [x] performance_records 테이블 (진행 날짜, 사업ID, 횟수)
- [x] performance_participants 테이블 (진행 기록별 참여자 연결)
- [x] budgets 테이블 (사업별 총예산, 분기별 예산)
- [x] expenses 테이블 (지출 날짜, 금액, 항목구분, 내용)

## 백엔드 API
- [x] 사업 CRUD (등록/조회/수정/삭제)
- [x] 대상자 CRUD (사업별 등록/조회/수정/삭제)
- [x] 진행 실적 CRUD (등록/조회/수정/삭제)
- [x] 월별 누적 실적 집계 API (실인원/연인원/횟수, 남녀 구분)
- [x] 달성률 계산 API
- [x] 예산 CRUD (총예산 입력, 분기별 배분/조정)
- [x] 지출 내역 CRUD
- [x] 분기별 잔여예산 및 사용률 집계 API

## 프론트엔드 UI
- [x] DashboardLayout 기반 사이드바 레이아웃 구성
- [x] 글로벌 스타일 (우아한 컬러 팔레트, 폰트 설정)
- [x] 대시보드 홈 (요약 현황)
- [x] 사업 관리 페이지 (사업 등록/목록/수정/삭제)
- [x] 대상자 관리 페이지 (사업별 대상자 등록/목록)
- [x] 실적 입력 페이지 (진행 날짜/참여자 선택/횟수 입력)
- [x] 실적 현황 페이지 (월별 누적 테이블 + 차트, 달성률)
- [x] 예산 관리 페이지 (총예산 입력, 분기별 배분/조정)
- [x] 지출 내역 페이지 (지출 입력/목록, 분기별 잔여예산, 사용률)

## 테스트
- [x] 사업 CRUD 테스트
- [x] 실적 집계 로직 테스트
- [x] 예산/지출 계산 테스트

## 계층형 사업 구조 개편 (큰 사업 → 세부 사업)
- [x] DB: projects 테이블을 parentId 컨럼 추가 (NULL이면 큰 사업, 값 있으면 세부 사업)
- [x] DB: 마이그레이션 SQL 생성 및 적용
- [x] API: 세부 사업 CRUD (큰 사업 하위에 세부 사업 등록/조회/수정/삭제)
- [x] API: 대상자는 큰 사업(parentId=NULL)에만 귀속
- [x] API: 실적 기록은 세부 사업(parentId 있음)에 귀속, 참여자는 큰 사업 대상자 목록에서 선택
- [x] API: 예산은 큰 사업에 귀속 (기존 유지)
- [x] API: monthlyStats를 세부 사업 기준으로 조회
- [x] UI: 사이드바 - 큰 사업 하위에 세부 사업 목록 표시, 세부 사업별 실적 입력/현황 링크
- [x] UI: 사업 관리 페이지 - 큰 사업 등록 + 세부 사업 등록/목록 UI
- [x] UI: 대상자 관리 - 큰 사업 기준으로 대상자 관리
- [x] UI: 실적 입력 - 세부 사업 선택 + 큰 사업 대상자 목록에서 참여자 선택
- [x] UI: 실적 현황 - 세부 사업별 월별 누적 현황
- [x] UI: 예산 관리 - 큰 사업 기준 유지

## 회원가입 및 관리자 승인 시스템
- [x] DB: local_users 테이블 (이메일, 비밀번호 해시, 이름, 상태: pending/approved/rejected, 역할: admin/user)
- [x] DB: sessions 테이블 (자체 세션 관리)
- [x] API: 회원가입 (이메일/비번/이름 입력 → pending 상태로 저장)
- [x] API: 로그인 (이메일/비번 검증 → approved 상태만 허용)
- [x] API: 로그아웃
- [x] API: 관리자 - 가입 요청 목록 조회
- [x] API: 관리자 - 사용자 승인/거부/삭제
- [x] API: 관리자 계정 자동 초기화
- [x] UI: 로그인 페이지 (이메일/비번 입력)
- [x] UI: 회원가입 페이지 (이름/이메일/비번 입력 → 사용 요청)
- [x] UI: 승인 대기 화면 (가입 후 관리자 승인 안내)
- [x] UI: 관리자 페이지 (가입 요청 목록, 승인/거부 버튼, 사용자 관리)
- [x] UI: 기존 Manus OAuth 로그인 제거 → 자체 로그인으로 교체
- [x] 관리자만 접근 가능한 라우트 보호

## 인증 시스템 통합 완성
- [x] server/_core/context.ts를 local session 기반 사용자 인증까지 지원하도록 수정 (자체 로그인 사용자가 protectedProcedure 통과)
- [x] 기존 업무 기능 전체가 local 로그인만으로 정상 동작하는지 검증

## 통합 인증 테스트
- [x] local 로그인 상태에서 protectedProcedure 기반 업무 기능 동작 검증 테스트

## 대시보드 종합현황 표 (이미지 형태)
- [x] 백엔드 API: 전체 사업 종합 현황 데이터 한 번에 조회 (큰 사업 > 세부 사업, 계획+실적+남녀)
- [x] 대시보드 UI: 큰 사업명 rowspan 병합 표, 세부 사업별 계획/실적/남녀 표시
- [x] 소계 행: 큰 사업별 세부 사업 합계
- [x] 달성 여부에 따른 색상 강조 (미달성: 빨강, 달성: 파랑)

## 버그 수정
- [x] 신규 사업 등록/수정/삭제 시 대시보드 종합현황에 즉시 반영 (dashboardOverview invalidate 누락 수정)

## 실적 입력 참여자 선택 UI 개선
- [x] 이름 검색 기능 추가 (Search 아이콘 + 입력창 + X 버튼)
- [x] 검색 결과 기반 전체 선택/해제 버튼 (검색 중이면 "검색 결과 선택(N)" 표시)
- [x] 선택된 참여자를 태그(pill) 형태로 하단에 표시 (클릭 시 해제)
- [x] 선택된 항목 배경색 강조 (bg-primary/5)

## 대상자 엑셀 대량 등록
- [x] xlsx 라이브러리 설치 (프론트엔드 파싱용)
- [x] 백엔드 participants.bulkCreate tRPC 프로시저 추가
- [x] 엑셀 양식 다운로드 기능 (이름/성별 샘플 포함)
- [x] 파일 업로드 UI (드래그 영역, .xlsx/.xls/.csv 지원)
- [x] 파싱 결과 미리보기 테이블 (정상/오류 행 구분)
- [x] 오류 행 건너뛰고 정상 행만 일괄 등록
- [x] 성별 다양한 표현 인식 (남/여/남성/여성/male/female/m/f)

## 대시보드 예산 현황 섹션
- [x] getDashboardBudget DB 함수 추가 (큰 사업별 총예산·분기예산·집행액·잔액·집행률)
- [x] performance.dashboardBudget tRPC 프로시저 추가
- [x] 대시보드에 "사업별 예산 현황" 표 섹션 추가 (집행률 배지, 잔액 음수 시 빨간색, 예산 미설정 표시, 예산 페이지 이동 링크)

## 사업 계획서 PDF 업로드 및 AI 평가서 자동완성
- [x] project_plans 테이블 생성 (DB 마이그레이션 완료)
- [x] 백엔드 API: PDF 업로드/목록/삭제/서명된URL 조회 (projectPlans 라우터)
- [x] 백엔드 API: AI 평가서 생성 (evaluation.generate 프로시저) - 내장 LLM 사용, 음슴체
- [x] 사업 관리 페이지 큰 사업 카드에 "계획서" 버튼 및 PDF 업로드 다이얼로그 추가
- [x] 사업 관리 페이지 큰 사업 카드에 "평가서" 버튼 추가 (/evaluation/:id 라우트 이동)
- [x] EvaluationPage.tsx 생성 - 연도/기간 선택, AI 생성 버튼, 섹션별 결과 표시, 복사/다운로드
- [x] DashboardLayout 사이드바에 "AI 평가서" 메뉴 항목 추가 (큰 사업별)
- [x] App.tsx에 /evaluation/:projectId 라우트 등록

## AI 평가서 저장·조회·수정
- [x] DB: evaluations 테이블 생성 (projectId, userId, year, period, title, contentActivity/Outcome/Performance/SelfEval, createdAt, updatedAt)
- [x] 백엔드 API: 평가서 저장/목록/상세/수정/삭제 프로시저
- [x] EvaluationPage: 생성 후 "저장" 버튼 추가
- [x] EvaluationPage: 저장된 평가서 목록 사이드패널 (기간·날짜 표시, 접기/펼치기)
- [x] EvaluationPage: 저장된 평가서 불러오기 및 인라인 편집 (섹션별 textarea)
- [x] EvaluationPage: 저장된 평가서 삭제 기능 (확인 다이얼로그)

## 사업별 일정표
- [x] DB: schedules 테이블 생성 (projectId, userId, title, description, startDate, endDate, allDay, color, createdAt)
- [x] 백엔드 API: 일정 CRUD (list/create/update/delete)
- [x] SchedulePage: 월별 캘린더 뷰 (날짜 셀에 일정 표시, 오늘 날짜 강조, 기간 일정 연속 표시)
- [x] SchedulePage: 목록 뷰 (날짜순 정렬, 색상 바, 메모 표시)
- [x] SchedulePage: 일정 등록/수정/삭제 다이얼로그 (색상 선택, 기간 입력)
- [x] 사이드바에 "일정표" 메뉴 항목 추가 (큰 사업별)
- [x] App.tsx에 /schedule/:projectId 라우트 등록

## 버그 수정 및 기능 추가 (2차)
- [x] 사업 계획서 PDF 저장 실패 버그 수정 (base64 tRPC → multipart/form-data REST 엔드포인트로 변경)
- [x] 대시보드에 다가오는 일정 위젯 추가 (14일 이내 일정 목록, D-day 표시, 색상 점)

## 관리자 미승인 요청 배지
- [x] 백엔드: 미승인 사용자 수 조회 API 추가 (adminPendingCount, 30초 자동 갱신)
- [x] DashboardLayout.tsx: 관리자 메뉴 옆에 미승인 수 숫자 배지 표시 (빨간 원형, 99+ 처리)

## 대상자 필드 확장
- [x] DB: participants 테이블에 nationality, phone, visaType, region 컬럼 추가
- [x] 백엔드: create/update/list 프로시저에 신규 필드 반영
- [x] ParticipantsPage: 등록/수정 다이얼로그에 국적·전화번호·비자종류·거주지역 입력 필드 추가
- [x] ParticipantsPage: 목록 테이블에 국적·전화번호·비자종류·거주지역 컬럼 표시
- [x] 엑셀 양식(샘플) 및 파싱 로직에 신규 필드 반영 (6열 양식)

## 전체 업무 일정 달력 (스케줄 관리)
- [x] 백엔드: 전체 사업 일정 통합 조회 API (schedules.listAll - 연도/월 기준)
- [x] GlobalSchedulePage: 월별 달력 뷰 (사업별 색상 구분, 기간 일정 연속 표시)
- [x] GlobalSchedulePage: 일정 클릭 시 상세 팝오버 (사업명, 날짜, 설명, 해당 일정표 이동 링크)
- [x] GlobalSchedulePage: 사업별 범례(legend) 표시
- [x] 사이드바 상단 메뉴에 "스케줄 관리" 항목 추가
- [x] App.tsx에 /global-schedule 라우트 등록

## 스케줄 관리 페이지 일정 직접 입력
- [x] GlobalSchedulePage: "일정 추가" 버튼 추가 (헤더 우측)
- [x] GlobalSchedulePage: 일정 등록 다이얼로그 (사업 선택 드롭다운 + 제목/날짜/설명/색상 입력)
- [x] GlobalSchedulePage: 등록 후 목록 자동 갱신 (schedules.listAll invalidate)
- [x] GlobalSchedulePage: 달력 날짜 셀 클릭 시 해당 날짜로 다이얼로그 열기

## 대시보드 실적 종합현황 분기별 필터
- [x] 백엔드: 분기별 실적 집계 API (performance.dashboardOverviewByQuarter - 연도/분기 기준)
- [x] 대시보드 실적 종합현황: 연간/Q1/Q2/Q3/Q4 탭 필터 추가
- [x] 분기 선택 시 해당 분기 실적만 집계하여 표시 (달성률 재계산)
- [x] 분기별 현황과 연간 현황 동시 비교 가능하도록 UI 구성

## AI 평가서 자동완성 분기별 수치 반영
- [x] 평가서 생성 UI에 분기 선택 옵션 추가 (전체/Q1/Q2/Q3/Q4) (기존 UI 유지)
- [x] 백엔드 평가서 생성 프로시저에 quarter 파라미터 추가 (기존 period 파라미터 활용)
- [x] 분기 선택 시 해당 분기 실적 수치만 LLM 프롬프트에 반영
- [x] 생성된 평가서에 분기 정보 명시 (예: "2025년 1분기 평가서")

## 사업계획서 AI 작성 기능
- [x] DB 스키마: business_plans 테이블 생성 및 마이그레이션 완료
- [x] 척도집 목차 추출 및 SCALE_CATALOG 상수로 내장 (LLM 프롬프트 컨텍스트용)
- [x] 백엔드: businessPlansRouter (list/get/create/chat/generate/getSections/getQuestions) 프로시저 구현
- [x] 백엔드: 대화형 입력 → 섹션별 LLM 생성 프롬프트 (양식 기반, 척도집 참고)
- [x] 프론트엔드: BusinessPlanPage - 목록 + 새 계획서 작성 다이얼로그
- [x] 프론트엔드: BusinessPlanDetailPage - 좌측 섹션 네비게이션 + 우측 대화형 채팅 + 최종본 탭
- [x] 프론트엔드: 최종본 다운로드/복사 기능
- [x] 사이드바에 "사업계획서" 메뉴 추가
- [x] App.tsx에 /business-plans, /business-plans/:id 라우트 등록

## 사업계획서 최종본 인라인 편집
- [x] 백엔드: businessPlanDb.ts에 updateGeneratedSection 헬퍼 함수 추가
- [x] 백엔드: businessPlansRouter에 updateSection 프로시저 추가 (planId, sectionId, content)
- [x] 프론트엔드: editingSectionId / editingContent 상태 추가
- [x] 프론트엔드: 각 섹션 Card에 편집(Pencil) 버튼 추가
- [x] 프론트엔드: 편집 모드 시 Textarea로 전환, 저장/취소 버튼 표시
- [x] 프론트엔드: 저장 시 generatedSections 상태 업데이트 + DB 저장 뮤테이션 호출

## 사업계획서 질문 중복 버그 수정
- [x] 사업계획서 작성 화면에서 섹션 첫 질문이 중복 표시되는 원인 수정
- [x] 섹션 전환 시 안내 메시지와 첫 질문 표시 로직을 정리해 중복 질문 방지
- [x] 질문 진행 수 계산 로직 검토 및 재검증
- [x] 관련 테스트 및 타입 검증 실행


## 사용자별 사업 데이터 분리 및 사업 관리 강화
- [x] 현재 인증·사업 데이터 모델 및 UI 흐름 점검
- [x] 사업 생성·조회·수정·삭제에 사용자 소유권 검증 추가
- [x] 사업 등록·목록·관리 화면을 사용자별 흐름에 맞게 보완
- [x] 타입 검사·단위 테스트·브라우저 주요 흐름 검증
- [x] 체크포인트 저장 및 배포 상태 확인

> 체크포인트 25750574 저장 및 미리보기 반영을 확인함. 현재 세션에는 별도 publish/deploy 도구가 없으며, 공개 도메인 `psk.lol/__manus__/version.json`은 403으로 버전 메타데이터 확인이 제한됨.
