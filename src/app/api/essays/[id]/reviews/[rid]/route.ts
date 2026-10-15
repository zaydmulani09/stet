import { requireUser } from '@/lib/auth';
import { getReview, getVersion, setItemStatus } from '@/lib/essays';
import { json, parseBody, parseId, route } from '@/lib/http';
import { toPayload } from '@/lib/service';
import { ItemStatusSchema } from '@/lib/validation';

type Ctx = { params: Promise<{ id: string; rid: string }> };

export const GET = route(async (req: Request, { params }: Ctx) => {
  const user = await requireUser(req);
  const p = await params;
  const row = await getReview(user.id, parseId(p.id), parseId(p.rid));
  return json({ review: toPayload(row, await getVersion(user.id, p.id, row.version_id)) });
});

/** Dismiss, resolve or reopen one feedback item. */
export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const user = await requireUser(req);
  const p = await params;
  const { itemId, status } = await parseBody(req, ItemStatusSchema);
  return json({ itemStatus: await setItemStatus(user.id, parseId(p.id), parseId(p.rid), itemId, status) });
});
