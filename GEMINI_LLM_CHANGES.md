# LLM → Gemini API 변경 사항

## 변경된 파일
- `server/_core/env.ts` : `GEMINI_API_KEY`, `GEMINI_API_URL`, `GEMINI_MODEL` 환경변수
- `server/_core/llm.ts` : `invokeLLM`을 Gemini OpenAI 호환 엔드포인트로 교체

## 사용 방법
`.env`에 다음을 추가하세요:

```env
GEMINI_API_KEY=AIza...
# 선택
# GEMINI_MODEL=gemini-2.5-flash
# GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/openai
```

키 발급: https://aistudio.google.com/apikey

## 동작
- 엔드포인트: Gemini OpenAI-compatible chat/completions
- 기본 모델: `gemini-2.5-flash`
- 평가서 생성 시 PDF 텍스트 추출 후 프롬프트에 포함 (`server/pdfExtract.ts`)

기존 `invokeLLM` 인터페이스는 그대로 유지됩니다.
