import { requireUser } from '@/lib/auth';
import { getVersion } from '@/lib/essays';
import { json, parseId, route } from '@/lib/http';

type Ctx = { params: Promise<{ id: string; vid: string }> };

export const GET = route(async (req: Request, { params }: Ctx) => {
  const user = await requireUser(req);
  const p = await params;
  return json({ version: await getVersion(user.id, parseId(p.id), parseId(p.vid)) });
});
