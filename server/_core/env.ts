export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  // Google Gemini
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiApiUrl: process.env.GEMINI_API_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-3.8-flash",
};
