import postgres from 'postgres';

// Every query goes through q`...` so values are always bound parameters, and so tests can
// swap in an in-process Postgres (PGlite) with setDb().

export interface Db {
  query(text: string, params: unknown[]): Promise<Record<string, unknown>[]>;
}

let db: Db | null = null;

export function setDb(next: Db | null) {
  db = next;
}

function getDb(): Db {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  // Supabase transaction pooler: prepared statements are not supported there.
  const sql = postgres(url, { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 10, ssl: 'require' });
  db = { query: (text, params) => sql.unsafe(text, params as postgres.ParameterOrJSON<never>[]) };
  return db;
}

export async function q<T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  let text = strings[0];
  for (let i = 0; i < values.length; i++) text += `$${i + 1}${strings[i + 1]}`;
  return (await getDb().query(text, values)) as T[];
}

export async function q1<T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T | null> {
  return (await q<T>(strings, ...values))[0] ?? null;
}
