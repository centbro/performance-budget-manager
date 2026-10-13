import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL || "mysql://2aWQncuQWr6uF2d.root:A8GC0XnnEzpUZtDk@gateway01.ap-northeast-1.prod.aws.tidbcloud.com:4000/test";

const TABLES = [
  // Drop in reverse dependency order
  "DROP TABLE IF EXISTS `record_participants`",
  "DROP TABLE IF EXISTS `performance_records`",
  "DROP TABLE IF EXISTS `expenses`",
  "DROP TABLE IF EXISTS `budgets`",
  "DROP TABLE IF EXISTS `participants`",
  "DROP TABLE IF EXISTS `project_plans`",
  "DROP TABLE IF EXISTS `evaluations`",
  "DROP TABLE IF EXISTS `schedules`",
  "DROP TABLE IF EXISTS `business_plans`",
  "DROP TABLE IF EXISTS `projects`",
  "DROP TABLE IF EXISTS `local_sessions`",
  "DROP TABLE IF EXISTS `local_users`",
  "DROP TABLE IF EXISTS `users`",

  // Recreate with exact schema
  `CREATE TABLE \`users\` (
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
  )`,

  `CREATE TABLE \`local_users\` (
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
  )`,

  `CREATE TABLE \`local_sessions\` (
    \`id\` varchar(64) NOT NULL,
    \`userId\` int NOT NULL,
    \`expiresAt\` timestamp NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    PRIMARY KEY (\`id\`)
  )`,

  `CREATE TABLE \`projects\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`userId\` int NOT NULL,
    \`parentId\` int,
    \`projectName\` varchar(200) NOT NULL,
    \`subProjectName\` varchar(200),
    \`plannedPeople\` int,
    \`plannedExtended\` int,
    \`plannedCount\` int,
    \`isAdHoc\` boolean NOT NULL DEFAULT false,
    \`year\` int NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  )`,

  `CREATE TABLE \`participants\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`projectId\` int NOT NULL,
    \`userId\` int NOT NULL,
    \`name\` varchar(100) NOT NULL,
    \`gender\` enum('male','female') NOT NULL,
    \`nationality\` varchar(100),
    \`phone\` varchar(30),
    \`visaType\` varchar(50),
    \`region\` varchar(100),
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    PRIMARY KEY (\`id\`)
  )`,

  `CREATE TABLE \`performance_records\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`projectId\` int NOT NULL,
    \`userId\` int NOT NULL,
    \`recordDate\` date NOT NULL,
    \`count\` int NOT NULL DEFAULT 1,
    \`note\` text,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  )`,

  `CREATE TABLE \`record_participants\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`recordId\` int NOT NULL,
    \`participantId\` int NOT NULL,
    PRIMARY KEY (\`id\`)
  )`,

  `CREATE TABLE \`budgets\` (
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
  )`,

  `CREATE TABLE \`expenses\` (
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
  )`,

  `CREATE TABLE \`project_plans\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`projectId\` int NOT NULL,
    \`userId\` int NOT NULL,
    \`fileName\` varchar(255) NOT NULL,
    \`fileKey\` varchar(500) NOT NULL,
    \`fileUrl\` varchar(500) NOT NULL,
    \`fileSize\` int,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    PRIMARY KEY (\`id\`)
  )`,

  `CREATE TABLE \`evaluations\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`projectId\` int NOT NULL,
    \`userId\` int NOT NULL,
    \`period\` varchar(50),
    \`content\` text,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  )`,

  `CREATE TABLE \`schedules\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`projectId\` int NOT NULL,
    \`userId\` int NOT NULL,
    \`title\` varchar(200) NOT NULL,
    \`description\` text,
    \`startDate\` date NOT NULL,
    \`endDate\` date NOT NULL,
    \`allDay\` boolean NOT NULL DEFAULT true,
    \`color\` varchar(20) NOT NULL DEFAULT 'blue',
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  )`,

  `CREATE TABLE \`business_plans\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`userId\` int NOT NULL,
    \`projectId\` int,
    \`year\` int NOT NULL,
    \`title\` varchar(200) NOT NULL,
    \`status\` enum('draft','in_progress','completed') NOT NULL DEFAULT 'draft',
    \`inputData\` text,
    \`chatHistory\` text,
    \`generatedContent\` text,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  )`,
];

async function main() {
  const url = new URL(DATABASE_URL);
  const conn = await mysql.createConnection({
    host: url.hostname,
    port: Number(url.port) || 4000,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: "test",
    ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
  });

  console.log("Resetting all tables...");
  for (const sql of TABLES) {
    try {
      await conn.query(sql);
      const preview = sql.slice(0, 50).replace(/\s+/g, " ");
      console.log("OK:", preview);
    } catch (e) {
      console.warn("WARN:", e.message?.slice(0, 120));
    }
  }

  const [rows] = await conn.query("SHOW TABLES");
  console.log("\nFinal tables:");
  console.log(rows);
  await conn.end();
  console.log("\nDone. Restart server, then log in again.");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
