import mysql from "mysql2/promise";
import fs from "fs";

const url = new URL(process.env.DATABASE_URL || "");
const conn = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port) || 4000,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, "") || "test",
  ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
  multipleStatements: true,
});

const sql = fs.readFileSync("./create_tables.sql", "utf8");
const statements = sql
  .split(/--> statement-breakpoint/)
  .map((s) => s.trim())
  .filter(Boolean);

for (const stmt of statements) {
  try {
    await conn.query(stmt);
    console.log("OK:", stmt.slice(0, 60).replace(/\n/g, " "));
  } catch (e) {
    console.warn("Skip/Error:", e.message?.slice(0, 80));
  }
}

await conn.end();
console.log("Done.");
