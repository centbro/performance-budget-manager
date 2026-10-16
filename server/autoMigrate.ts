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
    await conn.end();
    console.log("[DB] Essential tables ready");
  } catch (err: any) {
    console.error("[DB] Auto-create failed:", err.message || err);
  }
}
