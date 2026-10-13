import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL || "mysql://2aWQncuQWr6uF2d.root:A8GC0XnnEzpUZtDk@gateway01.ap-northeast-1.prod.aws.tidbcloud.com:4000/test";

async function main() {
  const url = new URL(DATABASE_URL);
  // Force use of 'test' database
  const database = "test";

  console.log("Connecting to", url.hostname, "database:", database);

  const conn = await mysql.createConnection({
    host: url.hostname,
    port: Number(url.port) || 4000,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
  });

  const tables = [
    `CREATE TABLE IF NOT EXISTS \`local_users\` (
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
    `CREATE TABLE IF NOT EXISTS \`local_sessions\` (
      \`id\` varchar(64) NOT NULL,
      \`userId\` int NOT NULL,
      \`expiresAt\` timestamp NOT NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT (now()),
      PRIMARY KEY (\`id\`)
    )`,
    `CREATE TABLE IF NOT EXISTS \`users\` (
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
    `CREATE TABLE IF NOT EXISTS \`projects\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`userId\` int NOT NULL,
      \`parentId\` int,
      \`year\` int NOT NULL,
      \`name\` varchar(200) NOT NULL,
      \`description\` text,
      \`createdAt\` timestamp NOT NULL DEFAULT (now()),
      \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`)
    )`,
  ];

  for (const sql of tables) {
    try {
      await conn.query(sql);
      console.log("OK:", sql.slice(0, 50).replace(/\s+/g, " "));
    } catch (e) {
      console.error("FAIL:", e.message);
    }
  }

  const [rows] = await conn.query("SHOW TABLES");
  console.log("Tables now:", rows);
  await conn.end();
  console.log("Done. Update .env DATABASE_URL to end with /test");
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
