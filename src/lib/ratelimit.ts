import { q } from './db';
import { HttpError } from './http';

// Fixed-window counters in Postgres. One row per key per window.
// ponytail: fixed windows allow up to 2x burst at a boundary; fine for these limits.

export interface Limit {
  key: string;
  max: number;
  windowSec: number;
  message: string;
}

export async function hit(limit: Limit): Promise<{ count: number; retryAfter: number }> {
  const [row] = await q<{ count: number; window_start: Date }>`
    insert into stet.rate_limits (key, window_start, count)
    values (${limit.key}, to_timestamp(floor(extract(epoch from now()) / ${limit.windowSec}) * ${limit.windowSec}), 1)
    on conflict (key, window_start) do update set count = stet.rate_limits.count + 1
    returning count, window_start`;
  const ends = new Date(row.window_start).getTime() + limit.windowSec * 1000;
  return { count: Number(row.count), retryAfter: Math.max(1, Math.ceil((ends - Date.now()) / 1000)) };
}

export async function enforce(...limits: Limit[]) {
  for (const l of limits) {
    const { count, retryAfter } = await hit(l);
    if (count > l.max) throw new HttpError(429, 'rate_limited', l.message, { retryAfter });
  }
}

const n = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);

export const limits = {
  review: (userId: string): Limit[] => [
    { key: `review:u:${userId}`, max: n(process.env.LIMIT_REVIEWS_PER_HOUR, 8), windowSec: 3600, message: 'You have run several reviews this hour. Revise with the notes you have, then try again later.' },
    { key: `review:u:${userId}:day`, max: n(process.env.LIMIT_REVIEWS_PER_DAY, 25), windowSec: 86400, message: 'Daily review limit reached. It resets within 24 hours.' },
    { key: 'review:global:day', max: n(process.env.LIMIT_REVIEWS_GLOBAL_DAY, 60), windowSec: 86400, message: 'Stet has reached its free daily review capacity. Your drafts are saved; try again tomorrow.' },
  ],
  assist: (userId: string): Limit[] => [
    { key: `assist:u:${userId}`, max: n(process.env.LIMIT_ASSIST_PER_HOUR, 40), windowSec: 3600, message: 'Too many assistant requests this hour. Try again shortly.' },
    { key: 'assist:global:day', max: n(process.env.LIMIT_ASSIST_GLOBAL_DAY, 1500), windowSec: 86400, message: 'The assistant has reached its free daily capacity. Try again tomorrow.' },
  ],
  check: (userId: string): Limit[] => [
    { key: `check:u:${userId}`, max: 12, windowSec: 3600, message: 'Too many revision checks this hour. Try again shortly.' },
  ],
  auth: (ip: string): Limit[] => [
    { key: `auth:ip:${ip}`, max: 20, windowSec: 900, message: 'Too many sign-in attempts. Wait a few minutes and try again.' },
  ],
  write: (userId: string): Limit[] => [
    { key: `write:u:${userId}`, max: 900, windowSec: 600, message: 'Saving too often. Your text is kept in this browser; saving resumes shortly.' },
  ],
  create: (ip: string): Limit[] => [
    { key: `create:ip:${ip}`, max: 60, windowSec: 3600, message: 'Too many new essays from this network. Try again later.' },
  ],
};
