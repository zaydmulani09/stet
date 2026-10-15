import { z } from 'zod';
import { numberedEssay, sentences, type Sentence } from '../text';
import { DIMENSIONS_FOR, DIMENSION_KEYS, ESSAY_TYPES, RATINGS, rubricText, type EssayType } from '../rubric';
import type { ReviewResult } from '../types';
import { analysisBrief, analyze } from '../analysis';
import { generateStructured, type ModelSpec } from './provider';
import { groundAll, QUOTE_RULE, stableId } from './ground';
import { introducesNewMaterial } from './fabrication';

export interface EssayContext {
  text: string;
  essayType: EssayType;
  promptText: string | null;
  wordLimit: number | null;
  charLimit: number | null;
  words: number;
  college: string | null;
  intent: string | null;
}

const severity = z.enum(['high', 'medium', 'low']);

export const ReviewSchema = z.object({
  overall: z.string(),
  takeaway: z.string(),
  promptFit: z.object({ verdict: z.enum(['answers', 'partly', 'drifts', 'no_prompt']), explanation: z.string() }),
  strengths: z.array(z.object({ sentence: z.number().int(), quote: z.string(), why: z.string() })),
  dimensions: z.array(z.object({ key: z.enum(DIMENSION_KEYS), rating: z.enum(RATINGS), rationale: z.string() })),
  notes: z.array(
    z.object({
      dimension: z.enum(DIMENSION_KEYS),
      severity,
      sentence: z.number().int(),
      quote: z.string(),
      title: z.string(),
      why: z.string(),
      action: z.string(),
      example: z.string().nullable(),
      question: z.string().nullable(),
      confidence: z.enum(['high', 'medium', 'low']),
    }),
  ),
  plan: z.array(z.object({ step: z.string(), why: z.string(), noteIndexes: z.array(z.number().int()) })),
  questions: z.array(z.string()),
  caveats: z.array(z.string()),
});
export type RawReview = z.infer<typeof ReviewSchema>;

export function maxNotes(words: number): number {
  return words <= 120 ? 3 : words <= 300 ? 5 : words <= 500 ? 7 : 9;
}

export function reviewSystem(type: EssayType, words: number): string {
  return `You are Stet, an experienced college admissions essay editor. You review a student's draft so they can revise it themselves. You never write the essay for them.

Rules
- ${QUOTE_RULE}
- Judge the draft against its prompt and the rubric. Raise only problems that matter for this essay. A strong essay gets few notes; never invent a problem to fill space.
- Praise precisely: name what works and why, with a quote.
- Do not invent facts about the student, a college, or what admissions officers want. Do not predict admission outcomes. If something cannot be judged from the text (for example whether a fact about a college is accurate), put it in caveats.
- Respect the student's voice. Plain words, dialect, non-native English, and unusual but effective sentences are not problems. Sophisticated vocabulary is not a goal.
- "example" may only rearrange, cut or sharpen material already in the essay (one or two sentences). If the fix needs content the essay does not have, set example to null and ask a question instead. Never invent events, people, dialogue, feelings, numbers or accomplishments, not even inside brackets.
- Talk to the student as "you": direct, warm, specific. No filler, no flattery.
- The "Measured" lines are exact counts from code. Use them as evidence when they matter for the reader; do not repeat them as separate notes unless they hurt the essay.

Rubric: rate every dimension listed below as strong, developing, needs_work or not_assessable. Use the whole scale: pick the level whose description fits best. Do not default to developing. A dimension that mostly matches the strong description is strong even if small fixes exist; one that matches the needs_work description is needs_work.
${rubricText(type)}

Fields
- overall: 3-5 sentences: the main strength, the biggest opportunity, and the single most important next step.
- takeaway: one sentence on what a reader would learn about the applicant from this draft as written.
- promptFit: answers, partly or drifts, with one or two sentences of explanation (no_prompt when no prompt is given).
- strengths: 2-4 passages that work.
- dimensions: exactly one entry for each rubric dimension above, rationale 1-2 sentences that point at the essay.
- notes: at most ${maxNotes(words)}, most important first, spread across the essay. A paragraph made mostly of general statements or stock phrases deserves a note. severity: high = changes how a reader understands the essay or the applicant; medium = a noticeable weakness; low = polish. title: at most 8 words. why: why it matters to a reader. action: what to do. question: a question that helps the student find the missing detail, or null.
- plan: 2-4 revision steps in the order to do them; noteIndexes are 0-based positions in notes.
- questions: 2-4 questions that could help the student uncover details or insight the essay is missing.
- caveats: what you could not judge or are unsure about; may be empty.`;
}

export function reviewPrompt(ctx: EssayContext, sents: Sentence[]): string {
  const limit = ctx.wordLimit ? `${ctx.wordLimit}-word limit` : ctx.charLimit ? `${ctx.charLimit}-character limit` : 'no stated limit';
  return `Essay type: ${ESSAY_TYPES[ctx.essayType]}
Prompt: ${ctx.promptText?.trim() || 'None given. Judge the essay on its own terms; use no_prompt and rate prompt_alignment not_assessable.'}
Length: ${ctx.words} words (${limit}).
College: ${ctx.college?.trim() || 'not specified'}
What the student wants a reader to understand: ${ctx.intent?.trim() || 'not stated'}

Measured:
${analysisBrief(analyze(ctx.text))}

Essay, one numbered sentence per line, blank line between paragraphs:
${numberedEssay(sents)}`;
}

/** Verifies quotes, assigns stable ids, filters to applicable dimensions and caps list sizes. */
export function finalizeReview(raw: RawReview, text: string, sents: Sentence[], type: EssayType, words: number, model: string): ReviewResult {
  const allowed = new Set(DIMENSIONS_FOR[type]);
  const strengths = groundAll(text, sents, raw.strengths);
  const notes = groundAll(text, sents, raw.notes.filter((n) => allowed.has(n.dimension) || n.dimension === 'prompt_alignment'));

  const seen = new Set<string>();
  const idByIndex = new Map<number, string>();
  const keptNotes = notes.kept
    .filter(({ item, anchor }) => {
      const k = `${item.dimension}:${anchor.start}:${anchor.end}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, maxNotes(words) + 1)
    .map(({ item, anchor, index }) => {
      const id = stableId('n', item.dimension, anchor.quote, anchor.start);
      idByIndex.set(index, id);
      return {
        id,
        dimension: item.dimension,
        severity: item.severity,
        title: item.title.trim(),
        why: item.why.trim(),
        action: item.action.trim(),
        example: item.example?.trim() && !introducesNewMaterial(item.example, text) ? item.example.trim() : null,
        question: item.question?.trim() || null,
        confidence: item.confidence,
        anchor,
      };
    });

  const dimOrder = DIMENSIONS_FOR[type];
  const dims = new Map(raw.dimensions.filter((d) => allowed.has(d.key)).map((d) => [d.key, d]));

  return {
    overall: raw.overall.trim(),
    takeaway: raw.takeaway.trim(),
    promptFit: raw.promptFit,
    strengths: strengths.kept.slice(0, 4).map(({ item, anchor }) => ({ id: stableId('s', anchor.quote, anchor.start), why: item.why.trim(), anchor })),
    dimensions: dimOrder.filter((k) => dims.has(k)).map((k) => ({ key: k, rating: dims.get(k)!.rating, rationale: dims.get(k)!.rationale.trim() })),
    notes: keptNotes,
    plan: raw.plan.slice(0, 5).map((p) => ({ step: p.step.trim(), why: p.why.trim(), noteIds: p.noteIndexes.map((i) => idByIndex.get(i)).filter((x): x is string => Boolean(x)) })),
    questions: raw.questions.slice(0, 5).map((q) => q.trim()).filter(Boolean),
    caveats: raw.caveats.map((c) => c.trim()).filter(Boolean),
    dropped: strengths.dropped + notes.dropped,
    model,
  };
}

export async function runReview(ctx: EssayContext, opts: { signal?: AbortSignal; models?: ModelSpec[] } = {}): Promise<ReviewResult> {
  const sents = sentences(ctx.text);
  const r = await generateStructured({
    task: 'review',
    system: reviewSystem(ctx.essayType, ctx.words),
    prompt: reviewPrompt(ctx, sents),
    schema: ReviewSchema,
    maxOutput: 6000,
    minOutput: 2600,
    signal: opts.signal,
    models: opts.models,
  });
  return finalizeReview(r.output, ctx.text, sents, ctx.essayType, ctx.words, r.model);
}
