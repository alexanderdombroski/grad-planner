import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

// node --env-file=".env" scripts/init-db.ts
const sqlPath = path.join(import.meta.dirname, "init-db.sql");
const sql = readFileSync(sqlPath, "utf8");

if (!process.env.POSTGRES_URI) {
  throw new Error("Set POSTGRES_URI before running init-db.");
}

const pool = new Pool({
  connectionString: process.env.POSTGRES_URI,
});

try {
  await pool.query(sql);
} finally {
  await pool.end();
}
