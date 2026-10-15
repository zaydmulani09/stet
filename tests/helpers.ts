import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { APICallError } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { setDb } from '@/lib/db';
import type { ModelSpec } from '@/lib/ai/provider';

let pg: PGlite | null = null;

/** In-process Postgres with the real schema; emptied between tests (booting one takes seconds). */
export async function freshDb() {
  if (!pg) {
    pg = new PGlite();
    await pg.exec(readFileSync('src/lib/schema.sql', 'utf8'));
  } else {
    await pg.exec('truncate stet.users, stet.rate_limits cascade');
  }
  const db = pg;
  setDb({ query: async (text, params) => (await db.query(text, params as unknown[])).rows as Record<string, unknown>[] });
  return db;
}

export const BASE = 'http://localhost:3000';

export function req(method: string, path: string, opts: { body?: unknown; cookie?: string; origin?: string; contentType?: string; raw?: string } = {}) {
  const headers: Record<string, string> = { host: 'localhost:3000' };
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.origin !== undefined) headers.origin = opts.origin;
  else if (method !== 'GET') headers.origin = BASE;
  if (opts.body !== undefined || opts.raw !== undefined) headers['content-type'] = opts.contentType ?? 'application/json';
  return new Request(BASE + path, { method, headers, body: opts.raw ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined) });
}

export const ctx = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

export function cookieFrom(res: Response): string {
  const c = res.headers.get('set-cookie');
  if (!c) throw new Error('no cookie set');
  return c.split(';')[0];
}

const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 20, text: 20, reasoning: undefined } };

export function textModel(text: string | (() => string), delayMs = 0) {
  return new MockLanguageModelV4({
    doGenerate: async (opts) => {
      if (delayMs)
        await new Promise((resolve, reject) => {
          const t = setTimeout(resolve, delayMs);
          opts.abortSignal?.addEventListener('abort', () => {
            clearTimeout(t);
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        });
      return { content: [{ type: 'text', text: typeof text === 'function' ? text() : text }], finishReason: { unified: 'stop', raw: undefined }, usage, warnings: [] };
    },
  });
}

export function failingModel(status: number, headers: Record<string, string> = {}) {
  return new MockLanguageModelV4({
    doGenerate: async () => {
      throw new APICallError({ message: `http ${status}`, url: 'https://mock', requestBodyValues: {}, statusCode: status, responseHeaders: headers, isRetryable: false });
    },
  });
}

export function spec(id: string, model: MockLanguageModelV4, budget = 100_000): ModelSpec {
  return { id, budget, model: () => model, options: {} };
}
