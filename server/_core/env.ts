export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  // Google Gemini
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiApiUrl: process.env.GEMINI_API_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-3.8-flash",
  // 사업계획서 생성·심사처럼 품질이 중요한 작업용(미설정 시 기본 모델과 동일)
  geminiModelStrong: process.env.GEMINI_MODEL_STRONG || process.env.GEMINI_MODEL || "gemini-3.8-flash",
};
