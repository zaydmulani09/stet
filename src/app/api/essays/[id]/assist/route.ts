import { requireUser } from '@/lib/auth';
import { getEssay, getReview } from '@/lib/essays';
import { HttpError, json, parseBody, parseId, route } from '@/lib/http';
import { enforce, limits } from '@/lib/ratelimit';
import { aiToHttp, contextOf } from '@/lib/service';
import { ASSIST_ACTIONS, runAssist } from '@/lib/ai/assist';
import type { StoredReview } from '@/lib/types';
import { AssistRequestSchema } from '@/lib/validation';

type Ctx = { params: Promise<{ id: string }> };

export const maxDuration = 60;

export const POST = route(async (req: Request, { params }: Ctx) => {
  const user = await requireUser(req);
  const id = parseId((await params).id);
  const body = await parseBody(req, AssistRequestSchema);
  const essay = await getEssay(user.id, id);
  if (essay.rev !== body.rev) throw new HttpError(409, 'stale', 'Your latest edits are still saving. Try again in a moment.');
  if (essay.content.slice(body.start, body.end) !== body.text)
    throw new HttpError(409, 'selection_changed', 'The selected text changed. Select it again.');

  let note = null;
  if (body.noteId && body.reviewId) {
    const review = await getReview(user.id, id, body.reviewId);
    const n = (review.result as StoredReview).review?.notes.find((x) => x.id === body.noteId);
    if (!n) throw new HttpError(404, 'note_not_found', 'That feedback item no longer exists.');
    note = { title: n.title, why: n.why, action: n.action, quote: n.anchor.quote };
  }
  if (ASSIST_ACTIONS[body.action].needsNote && !note) throw new HttpError(400, 'note_required', 'Pick a feedback item first.');

  await enforce(...limits.assist(user.id));
  const result = await runAssist(
    contextOf(essay),
    {
      action: body.action,
      selection: body.text,
      before: essay.content.slice(Math.max(0, body.start - 300), body.start),
      after: essay.content.slice(body.end, body.end + 300),
      note,
      message: body.message,
    },
    { signal: req.signal },
  ).catch(aiToHttp);
  return json({ result });
});
