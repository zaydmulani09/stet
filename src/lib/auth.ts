import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { q, q1 } from './db';
import { HttpError } from './http';

// Accounts: everyone starts as a guest (a real user row tied to an httpOnly cookie), and can
// add an email + password later to sign in elsewhere. Sessions are random tokens; only their
// SHA-256 is stored, so a database leak does not leak live sessions.

export const COOKIE = 'stet_session';
const SESSION_DAYS = 180;
const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export interface User {
  id: string;
  email: string | null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize('NFKC'), salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const parts = stored?.split('$');
  if (!parts || parts.length !== 6 || parts[0] !== 'scrypt') {
    await hashPassword(password); // same cost on unknown accounts, so timing does not reveal them
    return false;
  }
  const [, N, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, 'base64');
  const key = await scryptAsync(password.normalize('NFKC'), Buffer.from(salt, 'base64'), expected.length, {
    N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem,
  });
  return timingSafeEqual(key, expected);
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export async function createSession(userId: string): Promise<{ token: string; expires: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await q`insert into stet.sessions (token_hash, user_id, expires_at) values (${sha256(token)}, ${userId}, ${expires})`;
  return { token, expires };
}

export function sessionCookie(token: string, expires: Date): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}${secure}`;
}

export function clearedCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return v.join('=') || null;
  }
  return null;
}

export async function userFromToken(token: string | null): Promise<User | null> {
  if (!token || token.length > 100) return null;
  return q1<User>`
    select u.id, u.email from stet.sessions s join stet.users u on u.id = s.user_id
    where s.token_hash = ${sha256(token)} and s.expires_at > now()`;
}

export async function getUser(req: Request): Promise<User | null> {
  return userFromToken(readToken(req.headers.get('cookie')));
}

export async function requireUser(req: Request): Promise<User> {
  const user = await getUser(req);
  if (!user) throw new HttpError(401, 'unauthenticated', 'Your session has ended. Reload the page to continue.');
  return user;
}

/** Returns the signed-in user, creating a guest account on first write. */
export async function ensureUser(req: Request): Promise<{ user: User; setCookie: string | null }> {
  const user = await getUser(req);
  if (user) return { user, setCookie: null };
  const created = (await q1<User>`insert into stet.users default values returning id, email`)!;
  const s = await createSession(created.id);
  return { user: created, setCookie: sessionCookie(s.token, s.expires) };
}

export async function endSession(req: Request) {
  const token = readToken(req.headers.get('cookie'));
  if (token) await q`delete from stet.sessions where token_hash = ${sha256(token)}`;
}

export const normalizeEmail = (e: string) => e.trim().toLowerCase();

/** Guest adds credentials to their existing account, keeping their essays. */
export async function claimAccount(userId: string, email: string, password: string): Promise<User> {
  const taken = await q1`select 1 from stet.users where email = ${email}`;
  if (taken) throw new HttpError(409, 'email_taken', 'An account with that email already exists. Sign in instead.');
  const hash = await hashPassword(password);
  const user = await q1<User>`
    update stet.users set email = ${email}, password_hash = ${hash}
    where id = ${userId} and email is null returning id, email`;
  if (!user) throw new HttpError(409, 'already_registered', 'This browser is already signed in to an account.');
  return user;
}

export async function registerUser(email: string, password: string): Promise<User> {
  const hash = await hashPassword(password);
  const user = await q1<User>`
    insert into stet.users (email, password_hash) values (${email}, ${hash})
    on conflict (email) do nothing returning id, email`;
  if (!user) throw new HttpError(409, 'email_taken', 'An account with that email already exists. Sign in instead.');
  return user;
}

export async function authenticate(email: string, password: string): Promise<User | null> {
  const row = await q1<User & { password_hash: string | null }>`
    select id, email, password_hash from stet.users where email = ${email}`;
  const ok = await verifyPassword(password, row?.password_hash ?? null);
  return ok && row ? { id: row.id, email: row.email } : null;
}

/** After signing in from a guest session, move the guest's essays into the account. */
export async function mergeGuest(guestId: string, intoId: string): Promise<number> {
  if (guestId === intoId) return 0;
  const moved = await q`
    with g as (select id from stet.users where id = ${guestId} and email is null),
    m as (update stet.essays set user_id = ${intoId} where user_id in (select id from g) returning 1)
    select count(*)::int as n from m`;
  await q`delete from stet.users where id = ${guestId} and email is null`;
  return Number(moved[0]?.n ?? 0);
}
