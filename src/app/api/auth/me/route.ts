import { getUser } from '@/lib/auth';
import { json, route } from '@/lib/http';

export const GET = route(async (req: Request) => json({ user: await getUser(req) }));
