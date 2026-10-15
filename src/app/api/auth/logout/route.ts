import { clearedCookie, endSession, getUser } from '@/lib/auth';
import { HttpError, json, route } from '@/lib/http';

export const POST = route(async (req: Request) => {
  const user = await getUser(req);
  // A guest has no way back in after signing out, so refuse rather than strand their essays.
  if (user && !user.email) throw new HttpError(409, 'guest_signout', 'Add an email and password first, or your essays in this browser would be lost.');
  await endSession(req);
  return json({ ok: true }, { headers: { 'Set-Cookie': clearedCookie() } });
});
