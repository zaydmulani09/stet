import { describe, expect, it } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { runVoice } from '@/lib/ai/voice';
import { SAMPLE } from '@/lib/sample';
import { LIBRARY_BY_ID } from '@/lib/prompt-library';
import { countWords } from '@/lib/text';

describe.skipIf(!process.env.LIVE)('live voice', () => {
  it('finds voice and pattern evidence in the sample', async () => {
    const r = await runVoice({
      text: SAMPLE.content, essayType: 'personal_statement', promptText: LIBRARY_BY_ID.get('ca-2')!.text,
      wordLimit: 650, charLimit: null, words: countWords(SAMPLE.content), college: null, intent: null,
    });
    mkdirSync('.live', { recursive: true });
    writeFileSync('.live/voice.json', JSON.stringify(r, null, 2));
    expect(r.keep.length + r.generic.length + r.patterns.length).toBeGreaterThan(0);
    for (const x of [...r.keep, ...r.generic, ...r.patterns]) expect(SAMPLE.content.slice(x.anchor.start, x.anchor.end)).toBe(x.anchor.quote);
  }, 120_000);
});
