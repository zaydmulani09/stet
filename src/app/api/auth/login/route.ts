import { authenticate, createSession, endSession, getUser, mergeGuest, normalizeEmail, sessionCookie } from '@/lib/auth';
import { clientIp, HttpError, json, parseBody, route } from '@/lib/http';
import { enforce, limits } from '@/lib/ratelimit';
import { CredentialsSchema } from '@/lib/validation';

export const POST = route(async (req: Request) => {
  await enforce(...limits.auth(clientIp(req)));
  const { email, password } = await parseBody(req, CredentialsSchema);
  const user = await authenticate(normalizeEmail(email), password);
  if (!user) throw new HttpError(401, 'bad_credentials', 'That email and password do not match an account.');
  const current = await getUser(req);
  let moved = 0;
  if (current && current.id !== user.id) {
    // A guest who signs in brings the essays they wrote in this browser along.
    if (!current.email) moved = await mergeGuest(current.id, user.id);
    await endSession(req);
  }
  const s = await createSession(user.id);
  return json({ user, moved }, { headers: { 'Set-Cookie': sessionCookie(s.token, s.expires) } });
});
