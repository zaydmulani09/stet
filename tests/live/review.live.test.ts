// Live calls to the real model provider. Skipped unless LIVE=1 (they use free-tier quota).
import { describe, expect, it } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { runReview } from '@/lib/ai/review';
import { SAMPLE } from '@/lib/sample';
import { LIBRARY_BY_ID } from '@/lib/prompt-library';
import { countWords } from '@/lib/text';

describe.skipIf(!process.env.LIVE)('live review', () => {
  it('reviews the sample essay with grounded quotes', async () => {
    const t = Date.now();
    const r = await runReview({
      text: SAMPLE.content,
      essayType: 'personal_statement',
      promptText: LIBRARY_BY_ID.get('ca-2')!.text,
      wordLimit: 650,
      charLimit: null,
      words: countWords(SAMPLE.content),
      college: null,
      intent: SAMPLE.intent,
    });
    mkdirSync('.live', { recursive: true });
    writeFileSync('.live/review.json', JSON.stringify(r, null, 2));
    console.log('model', r.model, 'ms', Date.now() - t, 'notes', r.notes.length, 'strengths', r.strengths.length, 'dropped', r.dropped, 'dims', r.dimensions.length);
    expect(r.notes.length).toBeGreaterThan(0);
    for (const n of r.notes) expect(SAMPLE.content.slice(n.anchor.start, n.anchor.end)).toBe(n.anchor.quote);
  }, 120_000);
});
