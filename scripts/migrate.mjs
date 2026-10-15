// Applies src/lib/schema.sql (idempotent). Usage: node scripts/migrate.mjs  (reads DATABASE_URL, or .env.local)
import { readFileSync, existsSync } from 'node:fs';
import postgres from 'postgres';

if (!process.env.DATABASE_URL && existsSync('.env.local')) process.loadEnvFile('.env.local');
const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require', max: 1 });
await sql.unsafe(readFileSync('src/lib/schema.sql', 'utf8'));
const tables = await sql`select table_name from information_schema.tables where table_schema = 'stet' order by 1`;
console.log('stet tables:', tables.map((t) => t.table_name).join(', '));
await sql.end();
