import { ensureUser, getUser } from '@/lib/auth';
import { createEssay, insertReview, listEssays, snapshot } from '@/lib/essays';
import SAMPLE_REVIEW from '@/lib/sample-review.json';
import { clientIp, json, parseBody, route } from '@/lib/http';
import { LIBRARY_BY_ID } from '@/lib/prompt-library';
import { enforce, limits } from '@/lib/ratelimit';
import { SAMPLE } from '@/lib/sample';
import { CreateEssaySchema } from '@/lib/validation';

export const GET = route(async (req: Request) => {
  const user = await getUser(req);
  return json({ essays: user ? await listEssays(user.id) : [] });
});

export const POST = route(async (req: Request) => {
  const body = await parseBody(req, CreateEssaySchema);
  await enforce(...limits.create(clientIp(req)));
  const { user, setCookie } = await ensureUser(req);
  const { sample, ...fields } = body;
  if (fields.prompt_id && !('word_limit' in fields)) {
    const p = LIBRARY_BY_ID.get(fields.prompt_id)!;
    Object.assign(fields, { word_limit: p.wordLimit, min_words: p.minWords, char_limit: p.charLimit, essay_type: fields.essay_type ?? p.type });
  }
  const essay = await createEssay(user.id, sample ? { ...SAMPLE, is_sample: true } : fields);
  if (sample) {
    // The sample opens with the review Stet's engine produced for it (see tests/live/sample-fixture).
    const v = await snapshot(user.id, essay.id, 'review');
    await insertReview(essay.id, v.id, SAMPLE_REVIEW);
  }
  return json({ essay }, { status: 201, headers: setCookie ? { 'Set-Cookie': setCookie } : {} });
});
