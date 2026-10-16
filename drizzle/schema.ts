import {
  int,
  mysqlEnum,
  mysqlTable,
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
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
