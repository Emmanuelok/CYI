import { readFile } from "node:fs/promises";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  throw new Error("Set the server-only DATABASE_URL before running pnpm db:migrate.");
}
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 10 });
try {
  const migration = await readFile(new URL("../db/postgres.sql", import.meta.url), "utf8");
  await sql.begin(async transaction => { await transaction.unsafe(migration); });
  console.log("My CYI PostgreSQL schema is ready.");
} finally {
  await sql.end({ timeout: 5 });
}
