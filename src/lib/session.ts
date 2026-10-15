import { cookies } from 'next/headers';
import { COOKIE, userFromToken, type User } from './auth';

/** The signed-in user for server components, or null. */
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value ?? null;
  return userFromToken(token);
}
