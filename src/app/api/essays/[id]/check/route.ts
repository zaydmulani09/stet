import { requireUser } from '@/lib/auth';
import { getEssay, getReview, getVersion } from '@/lib/essays';
import { HttpError, json, parseBody, parseId, route } from '@/lib/http';
import { enforce, limits } from '@/lib/ratelimit';
import { aiToHttp, checkReviewable, contextOf } from '@/lib/service';
import { runCheck } from '@/lib/ai/compare';
import type { StoredReview } from '@/lib/types';
import { CheckRequestSchema } from '@/lib/validation';

type Ctx = { params: Promise<{ id: string }> };

export const maxDuration = 60;

/** AI check of the current draft against the feedback from an earlier review. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const user = await requireUser(req);
  const id = parseId((await params).id);
  const { reviewId, rev } = await parseBody(req, CheckRequestSchema);
  const essay = await getEssay(user.id, id);
  if (essay.rev !== rev) throw new HttpError(409, 'stale', 'Your latest edits are still saving. Try again in a moment.');
  const review = await getReview(user.id, id, reviewId);
  const original = await getVersion(user.id, id, review.version_id);
  const notes = (review.result as StoredReview).review?.notes ?? [];
  if (!notes.length) throw new HttpError(400, 'no_notes', 'That review has no feedback items to check.');
  if (original.content === essay.content) throw new HttpError(400, 'unchanged', 'The draft has not changed since that review.');
  checkReviewable(essay.content);
  await enforce(...limits.check(user.id));
  const result = await runCheck(contextOf(essay), notes, original.content, { signal: req.signal }).catch(aiToHttp);
  return json({ result });
});
