import { describe, expect, it } from 'vitest';
import { finalizeReview, ReviewSchema, type RawReview } from '@/lib/ai/review';
import { finalizeVoice } from '@/lib/ai/voice';
import { introducesNewMaterial, newSpecifics } from '@/lib/ai/fabrication';
import { sentences } from '@/lib/text';

const essay = 'I fixed dryer 9 with a $11 belt. I learned a lot. I learned a lot about patience.\n\nIn the end, hard work pays off.';
const sents = sentences(essay);

function raw(over: Partial<RawReview> = {}): RawReview {
  return {
    overall: ' Good. ',
    takeaway: 'You fix things.',
    promptFit: { verdict: 'answers', explanation: 'ok' },
    strengths: [{ sentence: 1, quote: 'I fixed dryer 9', why: 'concrete' }],
    dimensions: [
      { key: 'specificity', rating: 'strong', rationale: 'r' },
      { key: 'school_specificity', rating: 'needs_work', rationale: 'not for this type' },
      { key: 'clarity', rating: 'developing', rationale: 'r' },
    ],
    notes: [
      { dimension: 'reflection', severity: 'high', sentence: 3, quote: 'I learned a lot', title: 'Vague lesson', why: 'w', action: 'a', example: null, question: 'What changed?', confidence: 'high' },
      { dimension: 'cliche', severity: 'medium', sentence: 4, quote: 'the moon was bright', title: 'Invented', why: 'w', action: 'a', example: null, question: null, confidence: 'low' },
      { dimension: 'reflection', severity: 'high', sentence: 3, quote: 'I learned a lot', title: 'Duplicate', why: 'w', action: 'a', example: null, question: null, confidence: 'high' },
      { dimension: 'ending', severity: 'medium', sentence: 4, quote: 'hard work pays off', title: 'Stock ending', why: 'w', action: 'a', example: 'Mrs. Lopez hugged me at the state finals in 2024.', question: null, confidence: 'medium' },
    ],
    plan: [{ step: 'Fix reflection', why: 'core', noteIndexes: [0, 1, 3] }],
    questions: ['  What did you do next?  ', ''],
    caveats: [],
    ...over,
  };
}

describe('finalizeReview', () => {
  const r = finalizeReview(raw(), essay, sents, 'personal_statement', 30, 'mock');

  it('drops notes whose quote is not in the essay and counts them', () => {
    expect(r.notes.map((n) => n.title)).toEqual(['Vague lesson', 'Stock ending']);
    expect(r.dropped).toBe(1);
  });

  it('anchors repeated phrases to the cited sentence', () => {
    const n = r.notes[0];
    expect(n.anchor.start).toBe(sents[2].start); // sentence 3, not the identical phrase in sentence 2
    expect(essay.slice(n.anchor.start, n.anchor.end)).toBe('I learned a lot');
  });

  it('removes examples that introduce new names, numbers or events', () => {
    expect(r.notes[1].example).toBeNull();
  });

  it('keeps only dimensions that apply to the essay type, in rubric order', () => {
    expect(r.dimensions.map((d) => d.key)).toEqual(['specificity', 'clarity']);
  });

  it('maps plan steps to surviving note ids only', () => {
    expect(r.plan[0].noteIds).toEqual([r.notes[0].id, r.notes[1].id]);
  });

  it('gives notes stable ids', () => {
    const again = finalizeReview(raw(), essay, sents, 'personal_statement', 30, 'mock');
    expect(again.notes.map((n) => n.id)).toEqual(r.notes.map((n) => n.id));
    expect(r.notes[0].id).toMatch(/^n_[0-9a-f]{10}$/);
  });

  it('cleans questions', () => {
    expect(r.questions).toEqual(['What did you do next?']);
  });

  it('rejects malformed model output at the schema', () => {
    expect(ReviewSchema.safeParse({ overall: 'x' }).success).toBe(false);
    const bad = raw();
    (bad.notes[0] as { severity: string }).severity = 'critical';
    expect(ReviewSchema.safeParse(bad).success).toBe(false);
    expect(ReviewSchema.safeParse(raw()).success).toBe(true);
  });
});

describe('fabrication guard', () => {
  it('flags new names and numbers but allows placeholders', () => {
    expect(newSpecifics('I told Mrs. Lopez it cost $40.', essay)).toEqual(['Mrs', 'Lopez', '$40']);
    expect(newSpecifics('I told [her name] it cost $11.', essay)).toEqual([]);
  });
  it('flags examples that are mostly new content', () => {
    expect(introducesNewMaterial('The customer thanked me, saying it saved her whole weekend.', essay)).toBe(true);
    expect(introducesNewMaterial('I fixed dryer 9 with an $11 belt, and [what you noticed].', essay)).toBe(false);
  });
});

describe('finalizeVoice', () => {
  it('drops unquotable items, including an unsupported style-shift claim', () => {
    const v = finalizeVoice(
      {
        summary: 's',
        keep: [{ sentence: 1, quote: 'dryer 9 with a $11 belt', why: 'specific' }],
        generic: [{ sentence: 4, quote: 'hard work pays off', signal: 'generic_motivation', why: 'w', suggestion: 's', question: null }],
        patterns: [{ sentence: 2, quote: 'nothing like this', pattern: 'stock_phrase', observation: 'o', why: 'w', suggestion: 's' }],
        shift: { detected: true, sentence: 9, quote: 'not in essay', explanation: 'changes' },
      },
      essay,
      'mock',
    );
    expect(v.keep).toHaveLength(1);
    expect(v.generic).toHaveLength(1);
    expect(v.patterns).toHaveLength(0);
    expect(v.shift.detected).toBe(false);
    expect(v.dropped).toBe(2);
  });
});
