import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL || "mysql://2aWQncuQWr6uF2d.root:A8GC0XnnEzpUZtDk@gateway01.ap-northeast-1.prod.aws.tidbcloud.com:4000/test";

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

  // Drop and recreate projects with correct columns
  await conn.query("DROP TABLE IF EXISTS `projects`");
  await conn.query(`
    CREATE TABLE \`projects\` (
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
    )
  `);
  console.log("projects table recreated");

  // Ensure other essential tables exist with correct structure
  const others = [
    `CREATE TABLE IF NOT EXISTS \`participants\` (
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
    `CREATE TABLE IF NOT EXISTS \`performance_records\` (
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
    `CREATE TABLE IF NOT EXISTS \`budgets\` (
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
    `CREATE TABLE IF NOT EXISTS \`expenses\` (
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
  ];

  for (const sql of others) {
    try {
      await conn.query(sql);
      console.log("OK");
    } catch (e) {
      console.warn(e.message?.slice(0, 80));
    }
  }

  await conn.end();
  console.log("Done. Restart the server and try again.");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
