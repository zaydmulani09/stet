// Regenerates src/lib/sample-review.json by running the real engine on the sample essay.
// Run: LIVE=1 FIXTURE=1 npx vitest run tests/live/sample-fixture
import { describe, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { runReview } from '@/lib/ai/review';
import { runVoice } from '@/lib/ai/voice';
import { analyze } from '@/lib/analysis';
import { SAMPLE } from '@/lib/sample';
import { LIBRARY_BY_ID } from '@/lib/prompt-library';
import { countWords, limitStatus } from '@/lib/text';
import type { StoredReview } from '@/lib/types';

describe.skipIf(!process.env.FIXTURE)('sample fixture', () => {
  it('generates the stored sample review', async () => {
    const ctx = {
      text: SAMPLE.content, essayType: SAMPLE.essay_type, promptText: LIBRARY_BY_ID.get(SAMPLE.prompt_id)!.text,
      wordLimit: SAMPLE.word_limit, charLimit: null, words: countWords(SAMPLE.content), college: null, intent: SAMPLE.intent,
    };
    const t = Date.now();
    const [review, voice] = await Promise.all([runReview(ctx), runVoice(ctx)]);
    const stored: StoredReview & { generatedAt: string } = {
      review, voice, errors: {}, analysis: analyze(SAMPLE.content),
      limits: limitStatus(SAMPLE.content, { wordLimit: SAMPLE.word_limit, minWords: SAMPLE.min_words }),
      promptText: ctx.promptText, essayType: ctx.essayType, durationMs: Date.now() - t, generatedAt: new Date().toISOString(),
    };
    writeFileSync('src/lib/sample-review.json', JSON.stringify(stored, null, 1) + '\n');
  }, 180_000);
});
