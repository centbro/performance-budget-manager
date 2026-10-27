import {
  int,
  mysqlEnum,
  mysqlTable,
  mediumtext,
  text,
  timestamp,
  varchar,
  boolean,
  decimal,
  date,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// 사업 테이블 (parentId=NULL이면 큰 사업, parentId가 있으면 세부 사업)
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  parentId: int("parentId"), // NULL=큰 사업, 값 있음=세부 사업
  projectName: varchar("projectName", { length: 200 }).notNull(),
  subProjectName: varchar("subProjectName", { length: 200 }),
  // 계획값 (세부 사업에서 사용)
  plannedPeople: int("plannedPeople"), // 실인원 계획
  plannedExtended: int("plannedExtended"), // 연인원 계획
  plannedCount: int("plannedCount"), // 횟수 계획
  isAdHoc: boolean("isAdHoc").default(false).notNull(), // 수시 여부
  year: int("year").notNull(), // 관리 연도
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// 사업 대상자 테이블
export const participants = mysqlTable("participants", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  gender: mysqlEnum("gender", ["male", "female"]).notNull(),
  nationality: varchar("nationality", { length: 100 }),
  phone: varchar("phone", { length: 30 }),
  visaType: varchar("visaType", { length: 50 }),
  region: varchar("region", { length: 100 }),
  kind: varchar("kind", { length: 10 }).default("foreigner").notNull(), // foreigner | domestic
  birthDate: varchar("birthDate", { length: 10 }), // YYYY-MM-DD
  note: varchar("note", { length: 200 }),
  /** 브라우저에서 암호화한 이름·전화·생년월일. 서버는 풀 수 없다. */
  encPayload: text("encPayload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// 반(프로그램 수업 단위) — 큰 사업에 귀속
export const programClasses = mysqlTable("program_classes", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// 반 배정 (참여자 ↔ 반, 한 사람이 여러 반 가능)
export const classMembers = mysqlTable("class_members", {
  id: int("id").autoincrement().primaryKey(),
  classId: int("classId").notNull(),
  participantId: int("participantId").notNull(),
  userId: int("userId").notNull(),
});

// 출결 기록 (반·참여자·날짜당 1건)
export const attendanceRecords = mysqlTable("attendance_records", {
  id: int("id").autoincrement().primaryKey(),
  classId: int("classId").notNull(),
  participantId: int("participantId").notNull(),
  userId: int("userId").notNull(),
  attendDate: varchar("attendDate", { length: 10 }).notNull(), // YYYY-MM-DD
  status: varchar("status", { length: 10 }).notNull(), // present | late | absent | excused
});

export type Participant = typeof participants.$inferSelect;
export type InsertParticipant = typeof participants.$inferInsert;

// 진행 실적 기록 테이블
export const performanceRecords = mysqlTable("performance_records", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  recordDate: date("recordDate").notNull(),
  count: int("count").notNull().default(1), // 횟수
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PerformanceRecord = typeof performanceRecords.$inferSelect;
export type InsertPerformanceRecord = typeof performanceRecords.$inferInsert;

// 진행 실적 - 참여자 연결 테이블
export const recordParticipants = mysqlTable("record_participants", {
  id: int("id").autoincrement().primaryKey(),
  recordId: int("recordId").notNull(),
  participantId: int("participantId").notNull(),
});

export type RecordParticipant = typeof recordParticipants.$inferSelect;
export type InsertRecordParticipant = typeof recordParticipants.$inferInsert;

// 예산 테이블
export const budgets = mysqlTable("budgets", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  year: int("year").notNull(),
  totalBudget: decimal("totalBudget", { precision: 15, scale: 0 }).notNull().default("0"),
  q1Budget: decimal("q1Budget", { precision: 15, scale: 0 }).notNull().default("0"),
  q2Budget: decimal("q2Budget", { precision: 15, scale: 0 }).notNull().default("0"),
  q3Budget: decimal("q3Budget", { precision: 15, scale: 0 }).notNull().default("0"),
  q4Budget: decimal("q4Budget", { precision: 15, scale: 0 }).notNull().default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Budget = typeof budgets.$inferSelect;
export type InsertBudget = typeof budgets.$inferInsert;

// 지출 내역 테이블
export const expenses = mysqlTable("expenses", {
  id: int("id").autoincrement().primaryKey(),
  budgetId: int("budgetId").notNull(),
  userId: int("userId").notNull(),
  expenseDate: date("expenseDate").notNull(),
  amount: decimal("amount", { precision: 15, scale: 0 }).notNull(),
  category: mysqlEnum("category", ["labor", "operation", "project"]).notNull(), // 인건비/운영비/사업비
  description: text("description").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = typeof expenses.$inferInsert;

// 사업 계획서 파일 테이블 (큰 사업에 귀속)
export const projectPlans = mysqlTable("project_plans", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(), // 큰 사업 ID
  userId: int("userId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 500 }).notNull(),
  fileSize: int("fileSize"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProjectPlan = typeof projectPlans.$inferSelect;
export type InsertProjectPlan = typeof projectPlans.$inferInsert;

// AI 평가서 저장 테이블
export const evaluations = mysqlTable("evaluations", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(), // 큰 사업 ID
  userId: int("userId").notNull(),
  year: int("year").notNull(),
  period: varchar("period", { length: 20 }).notNull(), // q1/q2/q3/q4/h1/h2/annual
  periodLabel: varchar("periodLabel", { length: 50 }).notNull(), // 예: 상반기(1~6월)
  title: varchar("title", { length: 300 }).notNull(),
  // 섹션별 내용
  contentActivity: text("contentActivity"),   // 추진 실적
  contentOutcome: text("contentOutcome"),     // 사업 성과
  contentPerformance: text("contentPerformance"), // 사업 추진 성과
  contentSelfEval: text("contentSelfEval"),   // 자체 평가
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Evaluation = typeof evaluations.$inferSelect;
export type InsertEvaluation = typeof evaluations.$inferInsert;

// 자체 인증 사용자 테이블 (이메일/비밀번호 기반)
export const localUsers = mysqlTable("local_users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  role: mysqlEnum("role", ["admin", "user"]).default("user").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  approvedAt: timestamp("approvedAt"),
  accessUntil: timestamp("accessUntil"), // 이용 만료일(null=무제한)
  plan: varchar("plan", { length: 20 }).default("pro").notNull(), // pro | premium
  accountingMode: boolean("accountingMode").default(false).notNull(), // 회계 전용 모드(사업 없이 예산 메뉴만)
});

export type LocalUser = typeof localUsers.$inferSelect;
export type InsertLocalUser = typeof localUsers.$inferInsert;

// 자체 인증 세션 테이블
export const localSessions = mysqlTable("local_sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LocalSession = typeof localSessions.$inferSelect;
export type InsertLocalSession = typeof localSessions.$inferInsert;

// 사업별 일정표 테이블
export const schedules = mysqlTable("schedules", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(), // 큰 사업 ID
  userId: int("userId").notNull(),       // 등록자
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  startDate: date("startDate").notNull(),
  endDate: date("endDate").notNull(),
  allDay: boolean("allDay").default(true).notNull(),
  color: varchar("color", { length: 20 }).default("blue").notNull(), // blue/green/red/orange/purple
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Schedule = typeof schedules.$inferSelect;
export type InsertSchedule = typeof schedules.$inferInsert;

// 사업계획서 테이블
export const businessPlans = mysqlTable("business_plans", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId"), // 연결된 큰 사업 ID (선택)
  year: int("year").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  status: mysqlEnum("status", ["draft", "in_progress", "completed"]).default("draft").notNull(),
  // 대화형 입력 데이터 (JSON)
  inputData: text("inputData"), // 사용자가 입력한 각 섹션 답변 JSON
  chatHistory: text("chatHistory"), // 대화 내역 JSON
  // 생성된 최종 계획서 내용 (섹션별 JSON)
  generatedContent: text("generatedContent"), // 생성된 계획서 JSON
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BusinessPlan = typeof businessPlans.$inferSelect;
export type InsertBusinessPlan = typeof businessPlans.$inferInsert;

// 기관 서식 보관함 (PDF 샘플에서 추출한 항목 구조)
export const docTemplates = mysqlTable("doc_templates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  analysis: text("analysis").notNull(), // 항목 구조 JSON
  sampleText: text("sampleText"), // 개인정보 마스킹 후 샘플 일부
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DocTemplate = typeof docTemplates.$inferSelect;

// 사례관리 기록 (기관 양식 항목에 맞춰 저장)
export const caseRecords = mysqlTable("case_records", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  templateId: int("templateId").notNull(),
  templateName: varchar("templateName", { length: 120 }).notNull(),
  recordDate: varchar("recordDate", { length: 10 }).notNull(), // YYYY-MM-DD
  subject: varchar("subject", { length: 100 }).notNull(), // 대상자 표기(이니셜 권장)
  category: varchar("category", { length: 60 }).notNull(), // 상담·서비스 유형
  summary: varchar("summary", { length: 300 }).notNull(),
  fields: text("fields").notNull(), // [{heading, content}] JSON
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CaseRecord = typeof caseRecords.$inferSelect;

// 의견 게시판 (작성자와 관리자만 열람)
// AI 호출 사용량 기록 (요금제 한도·비용 추적)
export const aiUsage = mysqlTable("ai_usage", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  feature: varchar("feature", { length: 40 }).notNull(),
  model: varchar("model", { length: 80 }).notNull(),
  promptTokens: int("promptTokens").default(0).notNull(),
  completionTokens: int("completionTokens").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const boardPosts = mysqlTable("board_posts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  authorName: varchar("authorName", { length: 100 }).notNull(),
  authorEmail: varchar("authorEmail", { length: 320 }).notNull(),
  category: varchar("category", { length: 20 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content").notNull(),
  status: varchar("status", { length: 20 }).default("접수").notNull(),
  adminReply: text("adminReply"),
  repliedAt: timestamp("repliedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type BoardPost = typeof boardPosts.$inferSelect;

// 홍보글 문체 샘플 보관함
export const promoSamples = mysqlTable("promo_samples", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  channel: varchar("channel", { length: 30 }).notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// 기관 문체 프로필 (사용자당 1건) — 모든 글쓰기 기능이 참고
export const orgStyles = mysqlTable("org_styles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  orgName: varchar("orgName", { length: 100 }).notNull().default(""),
  tone: varchar("tone", { length: 300 }).notNull().default(""),
  sampleText: text("sampleText").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 텔레그램 연결 (사용자 1명 ↔ 텔레그램 대화 1개)
export const telegramLinks = mysqlTable("telegram_links", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  chatId: varchar("chatId", { length: 32 }).notNull().unique(),
  username: varchar("username", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// 텔레그램 연결용 일회용 코드 (10분)
export const telegramLinkCodes = mysqlTable("telegram_link_codes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  code: varchar("code", { length: 12 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// 참고자료 보관함 (사용자가 올린 지침·사업 참고 PDF)
export const referenceDocs = mysqlTable("reference_docs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  pageCount: int("pageCount").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const referenceChunks = mysqlTable("reference_chunks", {
  id: int("id").autoincrement().primaryKey(),
  docId: int("docId").notNull(),
  userId: int("userId").notNull(),
  page: int("page").notNull(),
  text: text("text").notNull(),
});

// 저장한 프로그램 아이디어 (AI가 제안한 안을 보관)
export const savedIdeas = mysqlTable("saved_ideas", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  ideaJson: text("ideaJson").notNull(),
  ctxJson: text("ctxJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// 대상자 개인정보 잠금(비밀번호는 저장하지 않음 — salt와 확인용 암호문만)
export const userVaults = mysqlTable("user_vaults", {
  userId: int("userId").primaryKey(),
  salt: varchar("salt", { length: 64 }).notNull(),
  iterations: int("iterations").notNull(),
  verifier: varchar("verifier", { length: 200 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// 관리자 PC 도우미 연결 코드(해시만 저장)와 작업 기록
export const pcAgentTokens = mysqlTable("pc_agent_tokens", {
  userId: int("userId").primaryKey(),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const pcAgentLogs = mysqlTable("pc_agent_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  summary: varchar("summary", { length: 300 }).notNull(),
  ok: int("ok").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// 강사비 계산 저장본(여러 명을 한 묶음으로)
export const lecturerFeeSets = mysqlTable("lecturer_fee_sets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 100 }).notNull(),
  rowsJson: text("rowsJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 자주 쓰는 문서(양식): hwpx·docx 파일을 base64로 보관해 두고 대화로 내용만 채워 쓴다
export const docForms = mysqlTable("doc_forms", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  ext: varchar("ext", { length: 8 }).notNull(),
  size: int("size").notNull(),
  dataB64: mediumtext("dataB64").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DocForm = typeof docForms.$inferSelect;


// 회계 전용 예산: 사업과 무관하게 예산 → 세부항목 → 지출을 관리한다(분기 나눔은 예산마다 선택)
export const acctBudgets = mysqlTable("acct_budgets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  year: int("year").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  splitQuarter: boolean("splitQuarter").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const acctItems = mysqlTable("acct_items", {
  id: int("id").autoincrement().primaryKey(),
  budgetId: int("budgetId").notNull(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  amount: decimal("amount", { precision: 15, scale: 0 }).notNull().default("0"),
  q1: decimal("q1", { precision: 15, scale: 0 }).notNull().default("0"),
  q2: decimal("q2", { precision: 15, scale: 0 }).notNull().default("0"),
  q3: decimal("q3", { precision: 15, scale: 0 }).notNull().default("0"),
  q4: decimal("q4", { precision: 15, scale: 0 }).notNull().default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const acctExpenses = mysqlTable("acct_expenses", {
  id: int("id").autoincrement().primaryKey(),
  budgetId: int("budgetId").notNull(),
  itemId: int("itemId").notNull(),
  userId: int("userId").notNull(),
  expenseDate: varchar("expenseDate", { length: 10 }).notNull(), // YYYY-MM-DD
  amount: decimal("amount", { precision: 15, scale: 0 }).notNull(),
  description: varchar("description", { length: 300 }).notNull().default(""),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
