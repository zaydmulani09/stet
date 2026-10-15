import { q } from '@/lib/db';
import { json, route } from '@/lib/http';

// Daily cron target: keeps the free Supabase project active and prunes expired rows.
export const GET = route(async () => {
  await q`delete from stet.sessions where expires_at < now()`;
  await q`delete from stet.rate_limits where window_start < now() - interval '2 days'`;
  return json({ ok: true, db: 'up', ai: Boolean(process.env.GROQ_API_KEY || process.env.AI_GATEWAY_MODEL) });
});
