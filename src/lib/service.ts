import { AIError } from './ai/provider';
import { runReview, type EssayContext } from './ai/review';
import { runVoice } from './ai/voice';
import { analyze } from './analysis';
import { getEssay, insertReview, snapshot, type Essay, type ReviewRow, type Version } from './essays';
import { HttpError } from './http';
import { LIBRARY_BY_ID } from './prompt-library';
import { enforce, limits } from './ratelimit';
import { ESSAY_TYPE_KEYS, type EssayType } from './rubric';
import { countWords, limitStatus } from './text';
import type { ReviewPayload, StoredReview } from './types';

export const MIN_REVIEW_WORDS = 25;
export const MAX_REVIEW_WORDS = 1300;

export function promptTextOf(e: Pick<Essay, 'prompt_id' | 'prompt_text'>): string | null {
  return (e.prompt_id && LIBRARY_BY_ID.get(e.prompt_id)?.text) || e.prompt_text || null;
}

export function contextOf(e: Essay, text = e.content): EssayContext {
  return {
    text,
    essayType: (ESSAY_TYPE_KEYS as string[]).includes(e.essay_type) ? (e.essay_type as EssayType) : 'personal_statement',
    promptText: promptTextOf(e),
    wordLimit: e.word_limit,
    charLimit: e.char_limit,
    words: countWords(text),
    college: e.college,
    intent: e.intent,
  };
}

export function aiToHttp(e: unknown): never {
  if (e instanceof AIError) {
    const map: Record<AIError['code'], [number, string]> = {
      busy: [503, 'ai_busy'],
      unavailable: [502, 'ai_unavailable'],
      invalid_output: [502, 'ai_invalid_output'],
      too_long: [413, 'too_long'],
      cancelled: [499, 'cancelled'],
      not_configured: [503, 'ai_not_configured'],
    };
    const [status, code] = map[e.code];
    throw new HttpError(status, code, e.message, e.retryAfter ? { retryAfter: e.retryAfter } : {});
  }
  throw e;
}

export function checkReviewable(text: string) {
  const words = countWords(text);
  if (words < MIN_REVIEW_WORDS) throw new HttpError(400, 'too_short', `Write at least ${MIN_REVIEW_WORDS} words before asking for a review.`);
  if (words > MAX_REVIEW_WORDS) throw new HttpError(413, 'too_long', `Reviews handle up to ${MAX_REVIEW_WORDS} words. Shorten the draft or review it in parts.`);
}

export function toPayload(row: ReviewRow, version: Pick<Version, 'content'>): ReviewPayload {
  return {
    id: row.id,
    versionId: row.version_id,
    createdAt: new Date(row.created_at).toISOString(),
    reviewedText: version.content,
    result: row.result as StoredReview,
    itemStatus: row.item_status ?? {},
  };
}

/** Runs the editorial review and the voice/pattern read in parallel on the saved draft. */
export async function performReview(userId: string, essayId: string, signal?: AbortSignal): Promise<ReviewPayload> {
  const essay = await getEssay(userId, essayId);
  checkReviewable(essay.content);
  await enforce(...limits.review(userId));
  const version = await snapshot(userId, essayId, 'review');
  const ctx = contextOf(essay, version.content);
  const started = Date.now();
  const [review, voice] = await Promise.allSettled([runReview(ctx, { signal }), runVoice(ctx, { signal })]);
  if (review.status === 'rejected' && voice.status === 'rejected') aiToHttp(review.reason);
  const reason = (r: PromiseSettledResult<unknown>) =>
    r.status === 'rejected' ? (r.reason instanceof AIError ? r.reason.message : 'This part of the review failed. Run the review again.') : undefined;
  const result: StoredReview = {
    review: review.status === 'fulfilled' ? review.value : null,
    voice: voice.status === 'fulfilled' ? voice.value : null,
    errors: { review: reason(review), voice: reason(voice) },
    analysis: analyze(version.content),
    limits: limitStatus(version.content, { wordLimit: essay.word_limit, charLimit: essay.char_limit, minWords: essay.min_words }),
    promptText: ctx.promptText,
    essayType: ctx.essayType,
    durationMs: Date.now() - started,
  };
  const row = await insertReview(essayId, version.id, result);
  return toPayload(row, version);
}
