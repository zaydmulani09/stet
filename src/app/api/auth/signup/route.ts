import { claimAccount, createSession, getUser, normalizeEmail, registerUser, sessionCookie } from '@/lib/auth';
import { clientIp, json, parseBody, route } from '@/lib/http';
import { enforce, limits } from '@/lib/ratelimit';
import { CredentialsSchema } from '@/lib/validation';

// Guests keep their essays: signing up adds credentials to the same account.
export const POST = route(async (req: Request) => {
  await enforce(...limits.auth(clientIp(req)));
  const { email, password } = await parseBody(req, CredentialsSchema);
  const current = await getUser(req);
  if (current && !current.email) {
    const user = await claimAccount(current.id, normalizeEmail(email), password);
    return json({ user });
  }
  const user = await registerUser(normalizeEmail(email), password);
  const s = await createSession(user.id);
  return json({ user }, { headers: { 'Set-Cookie': sessionCookie(s.token, s.expires) } });
});
