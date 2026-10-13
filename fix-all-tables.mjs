import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL || "mysql://2aWQncuQWr6uF2d.root:A8GC0XnnEzpUZtDk@gateway01.ap-northeast-1.prod.aws.tidbcloud.com:4000/test";

const SQLS = [
  `CREATE TABLE IF NOT EXISTS \`schedules\` (
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
  `CREATE TABLE IF NOT EXISTS \`evaluations\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`projectId\` int NOT NULL,
    \`userId\` int NOT NULL,
    \`content\` text NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`project_plans\` (
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
  `CREATE TABLE IF NOT EXISTS \`business_plans\` (
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
  `CREATE TABLE IF NOT EXISTS \`record_participants\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`recordId\` int NOT NULL,
    \`participantId\` int NOT NULL,
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

  for (const sql of SQLS) {
    try {
      await conn.query(sql);
      console.log("OK:", sql.slice(0, 40).replace(/\s+/g, " "));
    } catch (e) {
      console.warn("WARN:", e.message?.slice(0, 100));
    }
  }

  const [rows] = await conn.query("SHOW TABLES");
  console.log("All tables:", rows);
  await conn.end();
  console.log("Done.");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
