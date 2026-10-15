import { clearedCookie, requireUser } from '@/lib/auth';
import { deleteAccount } from '@/lib/essays';
import { json, route } from '@/lib/http';

/** Deletes the account and, by cascade, every essay, version, review and session. */
export const DELETE = route(async (req: Request) => {
  const user = await requireUser(req);
  await deleteAccount(user.id);
  return json({ ok: true }, { headers: { 'Set-Cookie': clearedCookie() } });
});
