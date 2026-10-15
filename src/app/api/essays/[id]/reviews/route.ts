import { requireUser } from '@/lib/auth';
import { listReviews } from '@/lib/essays';
import { json, parseId, route } from '@/lib/http';
import { performReview } from '@/lib/service';

type Ctx = { params: Promise<{ id: string }> };

export const maxDuration = 120;

export const GET = route(async (req: Request, { params }: Ctx) => {
  const user = await requireUser(req);
  return json({ reviews: await listReviews(user.id, parseId((await params).id)) });
});

/** Reviews the saved draft. The client flushes autosave first. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const user = await requireUser(req);
  return json({ review: await performReview(user.id, parseId((await params).id), req.signal) }, { status: 201 });
});
