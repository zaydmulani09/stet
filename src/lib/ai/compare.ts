import { z } from 'zod';
import { numberedEssay, sentences } from '../text';
import { ESSAY_TYPES } from '../rubric';
import type { Note } from '../types';
import { generateStructured, type ModelSpec } from './provider';
import { ground, groundAll, QUOTE_RULE, stableId } from './ground';
import type { Anchor } from '../anchor';
import type { EssayContext } from './review';

// AI judgement of whether a revision addressed earlier feedback. Measurable changes (diff,
// counts, whether a quoted passage still exists) are computed in code elsewhere; this module
// only produces the subjective part, and labels it as such in the UI.

export const CheckSchema = z.object({
  summary: z.string(),
  items: z.array(
    z.object({
      noteIndex: z.number().int(),
      status: z.enum(['addressed', 'partly', 'not_addressed', 'removed']),
      sentence: z.number().int().nullable(),
      quote: z.string().nullable(),
      explanation: z.string(),
    }),
  ),
  newIssues: z.array(z.object({ sentence: z.number().int(), quote: z.string(), title: z.string(), why: z.string(), severity: z.enum(['high', 'medium', 'low']) })),
  promptFit: z.object({ verdict: z.enum(['answers', 'partly', 'drifts', 'no_prompt']), explanation: z.string() }),
  reflection: z.object({ change: z.enum(['deeper', 'similar', 'thinner']), explanation: z.string() }),
  specificity: z.object({ change: z.enum(['more', 'similar', 'less']), explanation: z.string() }),
});

export interface CheckResult {
  summary: string;
  items: Array<{ noteId: string; status: 'addressed' | 'partly' | 'not_addressed' | 'removed'; explanation: string; evidence: Anchor | null }>;
  newIssues: Array<{ id: string; title: string; why: string; severity: 'high' | 'medium' | 'low'; anchor: Anchor }>;
  promptFit: z.infer<typeof CheckSchema>['promptFit'];
  reflection: z.infer<typeof CheckSchema>['reflection'];
  specificity: z.infer<typeof CheckSchema>['specificity'];
  dropped: number;
  model: string;
}

const SYSTEM = `You compare two drafts of a student's college essay for Stet. You get the feedback given on the earlier draft and the full revised draft. For each feedback item decide whether the revision addressed it.

Rules
- ${QUOTE_RULE} Quotes must come from the REVISED draft.
- addressed: the problem described is fixed. partly: improved but the core issue remains. not_addressed: no meaningful change. removed: the passage is gone and the issue no longer applies.
- More formal or more advanced vocabulary is not improvement. Judge only whether the specific problem was fixed.
- For each item give evidence from the revised draft (sentence and quote) when one exists; otherwise null.
- newIssues: only significant problems introduced by the revision (at most 4).
- reflection and specificity compare the two drafts overall.`;

export function checkPrompt(ctx: EssayContext, notes: Note[], originalText: string): string {
  return `Essay type: ${ESSAY_TYPES[ctx.essayType]}
Prompt: ${ctx.promptText?.trim() || 'none given (use no_prompt)'}

Feedback on the earlier draft:
${notes.map((n, i) => `${i}. [${n.severity}] ${n.title}. Passage: "${n.anchor.quote}". Why: ${n.why}`).join('\n')}

Earlier draft (for reference, do not quote it):
${originalText}

REVISED draft, one numbered sentence per line:
${numberedEssay(sentences(ctx.text))}`;
}

export async function runCheck(ctx: EssayContext, notes: Note[], originalText: string, opts: { signal?: AbortSignal; models?: ModelSpec[] } = {}): Promise<CheckResult> {
  const r = await generateStructured({
    task: 'check',
    system: SYSTEM,
    prompt: checkPrompt(ctx, notes, originalText),
    schema: CheckSchema,
    maxOutput: 3000,
    minOutput: 1200,
    signal: opts.signal,
    models: opts.models,
  });
  const sents = sentences(ctx.text);
  let dropped = 0;
  const items = r.output.items
    .filter((it) => notes[it.noteIndex])
    .map((it) => {
      const evidence = it.quote ? ground(ctx.text, sents, it.sentence, it.quote) : null;
      if (it.quote && !evidence) dropped++;
      return { noteId: notes[it.noteIndex].id, status: it.status, explanation: it.explanation.trim(), evidence };
    });
  const fresh = groundAll(ctx.text, sents, r.output.newIssues);
  return {
    summary: r.output.summary.trim(),
    items,
    newIssues: fresh.kept.slice(0, 4).map(({ item, anchor }) => ({ id: stableId('x', item.title, anchor.start), title: item.title.trim(), why: item.why.trim(), severity: item.severity, anchor })),
    promptFit: r.output.promptFit,
    reflection: r.output.reflection,
    specificity: r.output.specificity,
    dropped: dropped + fresh.dropped,
    model: r.model,
  };
}
