import mysql from "mysql2/promise";

const ESSENTIAL_TABLES = `
CREATE TABLE IF NOT EXISTS \`local_users\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`email\` varchar(320) NOT NULL,
  \`passwordHash\` varchar(255) NOT NULL,
  \`name\` varchar(100) NOT NULL,
  \`role\` enum('admin','user') NOT NULL DEFAULT 'user',
  \`status\` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  \`approvedAt\` timestamp NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`local_users_email_unique\` (\`email\`)
);

CREATE TABLE IF NOT EXISTS \`local_sessions\` (
  \`id\` varchar(64) NOT NULL,
  \`userId\` int NOT NULL,
  \`expiresAt\` timestamp NOT NULL,
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (\`id\`)
);

CREATE TABLE IF NOT EXISTS \`users\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`openId\` varchar(64) NOT NULL,
  \`name\` text,
  \`email\` varchar(320),
  \`loginMethod\` varchar(64),
  \`role\` enum('user','admin') NOT NULL DEFAULT 'user',
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  \`lastSignedIn\` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`users_openId_unique\` (\`openId\`)
);

CREATE TABLE IF NOT EXISTS \`projects\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`userId\` int NOT NULL,
  \`parentId\` int,
  \`year\` int NOT NULL,
  \`name\` varchar(200) NOT NULL,
  \`description\` text,
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
);

CREATE TABLE IF NOT EXISTS \`participants\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`projectId\` int NOT NULL,
  \`userId\` int NOT NULL,
  \`name\` varchar(100) NOT NULL,
  \`gender\` enum('male','female') NOT NULL,
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (\`id\`)
);

CREATE TABLE IF NOT EXISTS \`performance_records\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`projectId\` int NOT NULL,
  \`userId\` int NOT NULL,
  \`recordDate\` date NOT NULL,
  \`content\` text NOT NULL,
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
);

CREATE TABLE IF NOT EXISTS \`record_participants\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`recordId\` int NOT NULL,
  \`participantId\` int NOT NULL,
  PRIMARY KEY (\`id\`)
);

CREATE TABLE IF NOT EXISTS \`budgets\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`projectId\` int NOT NULL,
  \`userId\` int NOT NULL,
  \`year\` int NOT NULL,
  \`totalBudget\` decimal(15,0) NOT NULL DEFAULT '0',
  \`q1Budget\` decimal(15,0) NOT NULL DEFAULT '0',
  \`q2Budget\` decimal(15,0) NOT NULL DEFAULT '0',
  \`q3Budget\` decimal(15,0) NOT NULL DEFAULT '0',
  \`q4Budget\` decimal(15,0) NOT NULL DEFAULT '0',
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
);

CREATE TABLE IF NOT EXISTS \`expenses\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`budgetId\` int NOT NULL,
  \`userId\` int NOT NULL,
  \`expenseDate\` date NOT NULL,
  \`amount\` decimal(15,0) NOT NULL,
  \`category\` enum('labor','operation','project') NOT NULL,
  \`description\` text NOT NULL,
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
);

CREATE TABLE IF NOT EXISTS \`project_plans\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`projectId\` int NOT NULL,
  \`userId\` int NOT NULL,
  \`fileName\` varchar(255) NOT NULL,
  \`fileKey\` varchar(255) NOT NULL,
  \`fileUrl\` text NOT NULL,
  \`fileSize\` int,
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (\`id\`)
);

CREATE TABLE IF NOT EXISTS \`evaluations\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`projectId\` int NOT NULL,
  \`userId\` int NOT NULL,
  \`content\` text NOT NULL,
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
);

CREATE TABLE IF NOT EXISTS \`schedules\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`projectId\` int NOT NULL,
  \`userId\` int NOT NULL,
  \`title\` varchar(200) NOT NULL,
  \`startDate\` date NOT NULL,
  \`endDate\` date,
  \`description\` text,
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (\`id\`)
);

CREATE TABLE IF NOT EXISTS \`business_plans\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`projectId\` int NOT NULL,
  \`userId\` int NOT NULL,
  \`content\` text NOT NULL,
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
);

CREATE TABLE IF NOT EXISTS \`doc_templates\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`userId\` int NOT NULL,
  \`name\` varchar(120) NOT NULL,
  \`analysis\` text NOT NULL,
  \`sampleText\` text,
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (\`id\`)
);

CREATE TABLE IF NOT EXISTS \`case_records\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`userId\` int NOT NULL,
  \`templateId\` int NOT NULL,
  \`templateName\` varchar(120) NOT NULL,
  \`recordDate\` varchar(10) NOT NULL,
  \`subject\` varchar(100) NOT NULL,
  \`category\` varchar(60) NOT NULL,
  \`summary\` varchar(300) NOT NULL,
  \`fields\` text NOT NULL,
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (\`id\`)
);

CREATE TABLE IF NOT EXISTS \`promo_samples\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`userId\` int NOT NULL,
  \`name\` varchar(120) NOT NULL,
  \`channel\` varchar(30) NOT NULL,
  \`body\` text NOT NULL,
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (\`id\`)
);

CREATE TABLE IF NOT EXISTS \`org_styles\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`userId\` int NOT NULL,
  \`orgName\` varchar(100) NOT NULL DEFAULT '',
  \`tone\` varchar(300) NOT NULL DEFAULT '',
  \`sampleText\` text NOT NULL,
  \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`org_styles_userId_unique\` (\`userId\`)
);

CREATE TABLE IF NOT EXISTS \`telegram_links\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`userId\` int NOT NULL,
  \`chatId\` varchar(32) NOT NULL,
  \`username\` varchar(64),
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`telegram_links_userId_unique\` (\`userId\`),
  UNIQUE KEY \`telegram_links_chatId_unique\` (\`chatId\`)
);

CREATE TABLE IF NOT EXISTS \`telegram_link_codes\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`userId\` int NOT NULL,
  \`code\` varchar(12) NOT NULL,
  \`expiresAt\` timestamp NOT NULL,
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`telegram_link_codes_code_unique\` (\`code\`)
);

CREATE TABLE IF NOT EXISTS \`board_posts\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`userId\` int NOT NULL,
  \`authorName\` varchar(100) NOT NULL,
  \`authorEmail\` varchar(320) NOT NULL,
  \`category\` varchar(20) NOT NULL,
  \`title\` varchar(200) NOT NULL,
  \`content\` text NOT NULL,
  \`status\` varchar(20) NOT NULL DEFAULT '접수',
  \`adminReply\` text,
  \`repliedAt\` timestamp NULL,
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (\`id\`)
);

CREATE TABLE IF NOT EXISTS \`ai_usage\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`userId\` int NOT NULL,
  \`feature\` varchar(40) NOT NULL,
  \`model\` varchar(80) NOT NULL,
  \`promptTokens\` int NOT NULL DEFAULT 0,
  \`completionTokens\` int NOT NULL DEFAULT 0,
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (id),
  KEY \`ai_usage_user_month\` (userId, createdAt)
);

CREATE TABLE IF NOT EXISTS \`program_classes\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`projectId\` int NOT NULL,
  \`userId\` int NOT NULL,
  \`name\` varchar(100) NOT NULL,
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (\`id\`)
);

CREATE TABLE IF NOT EXISTS \`class_members\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`classId\` int NOT NULL,
  \`participantId\` int NOT NULL,
  \`userId\` int NOT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`class_member\` (\`classId\`,\`participantId\`)
);

CREATE TABLE IF NOT EXISTS \`attendance_records\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`classId\` int NOT NULL,
  \`participantId\` int NOT NULL,
  \`userId\` int NOT NULL,
  \`attendDate\` varchar(10) NOT NULL,
  \`status\` varchar(10) NOT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`att_unique\` (\`classId\`,\`participantId\`,\`attendDate\`)
);

CREATE TABLE IF NOT EXISTS \`reference_docs\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`userId\` int NOT NULL,
  \`name\` varchar(200) NOT NULL,
  \`pageCount\` int NOT NULL,
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (\`id\`)
);

CREATE TABLE IF NOT EXISTS \`reference_chunks\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`docId\` int NOT NULL,
  \`userId\` int NOT NULL,
  \`page\` int NOT NULL,
  \`text\` text NOT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`reference_chunks_user_idx\` (\`userId\`, \`docId\`)
);
`;

export async function autoCreateTables() {
  if (!process.env.DATABASE_URL) {
    console.warn("[DB] DATABASE_URL not set");
    return;
  }
  try {
    const url = new URL(process.env.DATABASE_URL);
    const conn = await mysql.createConnection({
      host: url.hostname,
      port: Number(url.port) || 4000,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, "") || "test",
      ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
      multipleStatements: true,
    });

    const statements = ESSENTIAL_TABLES.split(";").map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      try {
        await conn.query(stmt);
      } catch (e: any) {
        console.warn("[DB] stmt error:", e.message?.slice(0, 120));
      }
    }
    // 기존 DB에 컬럼 추가(이미 있으면 무시)
    try {
      await conn.query("ALTER TABLE local_users ADD COLUMN accessUntil timestamp NULL");
    } catch (e: any) {
      if (e?.code !== "ER_DUP_FIELDNAME" && e?.errno !== 1060) console.warn("[DB] alter error:", e.message?.slice(0, 120));
    }
    // 기존 DB에 컬럼 추가(이미 있으면 무시)
    for (const col of [
      "ALTER TABLE participants ADD COLUMN nationality varchar(100) NULL",
      "ALTER TABLE participants ADD COLUMN phone varchar(30) NULL",
      "ALTER TABLE participants ADD COLUMN visaType varchar(50) NULL",
      "ALTER TABLE participants ADD COLUMN region varchar(100) NULL",
      "ALTER TABLE participants ADD COLUMN kind varchar(10) NOT NULL DEFAULT 'foreigner'",
      "ALTER TABLE participants ADD COLUMN birthDate varchar(10) NULL",
      "ALTER TABLE participants ADD COLUMN note varchar(200) NULL",
    ]) {
      try {
        await conn.query(col);
      } catch (e: any) {
        if (e?.code !== "ER_DUP_FIELDNAME" && e?.errno !== 1060) console.warn("[DB] alter participants error:", e.message?.slice(0, 120));
      }
    }
    try {
      await conn.query("ALTER TABLE local_users ADD COLUMN plan varchar(20) NOT NULL DEFAULT 'pro'");
    } catch (e: any) {
      if (e?.code !== "ER_DUP_FIELDNAME" && e?.errno !== 1060) console.warn("[DB] alter plan error:", e.message?.slice(0, 120));
    }
    await conn.end();
    console.log("[DB] Essential tables ready");
  } catch (err: any) {
    console.error("[DB] Auto-create failed:", err.message || err);
  }
}
