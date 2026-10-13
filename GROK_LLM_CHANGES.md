# LLM → Grok API 변경 사항

## 변경된 파일
- `server/_core/env.ts` : `XAI_API_KEY`, `XAI_API_URL`, `XAI_MODEL` 환경변수 추가
- `server/_core/llm.ts` : `invokeLLM`을 xAI Grok Chat Completions API로 교체

## 사용 방법
`.env`에 다음을 추가하세요:

```env
XAI_API_KEY=xai-...
# 선택
# XAI_API_URL=https://api.x.ai/v1
# XAI_MODEL=grok-4
```

## 동작
- 엔드포인트: `{XAI_API_URL}/chat/completions`
- 모델: `XAI_MODEL` (기본 `grok-4`)
- `max_tokens` 파라미터를 그대로 전달
- `file_url` (PDF 등)은 Grok이 직접 지원하지 않을 수 있어 텍스트 노트(`[첨부 파일 ...]`)로 변환 후 전달
- 이미지(`image_url`)는 그대로 전달 (vision 지원 시 동작)

## 호출 위치
- `server/routers.ts` 의 평가서 생성 (`evaluation.generate`)
- `server/routers.ts` 의 사업계획서 생성 (`businessPlans.generate`)

## PDF 텍스트 추출 (추가됨)
평가서 생성 시 첨부된 사업계획서 PDF를 다운로드한 뒤 텍스트를 추출하여 프롬프트에 포함합니다.

- 새 파일: `server/pdfExtract.ts`
- 의존성: `pdf-parse` (`package.json`에 추가됨)
- 평가서 생성 시 `file_url` 대신 추출된 텍스트를 프롬프트에 넣습니다.

설치:
```bash
pnpm install
# 또는
npm install --legacy-peer-deps
```

기존 Manus `invokeLLM` 인터페이스는 그대로 유지되어 호출부 수정 없이 동작합니다.
