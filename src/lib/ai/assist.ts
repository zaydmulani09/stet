import { z } from 'zod';
import { countWords, numberedEssay, sentences } from '../text';
import { ESSAY_TYPES } from '../rubric';
import { generateStructured, type ModelSpec } from './provider';
import { newSpecifics } from './fabrication';
import type { EssayContext } from './review';
import { ASSIST_ACTIONS, type AssistAction } from '../assist-actions';

export { ASSIST_ACTIONS, ASSIST_ACTION_KEYS, type AssistAction } from '../assist-actions';

export const AssistSchema = z.object({
  reply: z.string(),
  options: z.array(z.object({ text: z.string(), note: z.string() })),
  questions: z.array(z.string()),
  verdict: z.enum(['addresses', 'partly', 'does_not', 'not_applicable']),
});

export interface AssistInput {
  action: AssistAction;
  selection: string;
  before: string; // ~300 chars of context on each side
  after: string;
  note: { title: string; why: string; action: string; quote: string } | null;
  message: string | null;
}

export interface AssistResult {
  reply: string;
  options: Array<{ text: string; note: string; newDetails: string[] }>;
  questions: string[];
  verdict: z.infer<typeof AssistSchema>['verdict'];
  model: string;
}

const SYSTEM = `You are Stet's revision coach for a student's college application essay. The student stays in control: you explain, ask, and offer optional small rewrites of only the passage they selected. You never rewrite the whole essay.

Hard rules
- Never invent experiences, people, dialogue, feelings, motives, numbers or accomplishments. If a better version needs a detail only the student knows, put a short placeholder in [square brackets] (e.g. [what you said to her]) or ask a question instead.
- Keep the student's voice. Preserve distinctive phrases that work. Do not make the writing fancier or more formal; plain is fine.
- Rewrite options replace only the selected passage, so each must read correctly between the text before and after it. Keep each option close to the selection's length unless the task is to cut.
- When the request does not call for rewrites, return an empty options list.
- reply: at most 150 words, plain sentences addressed to the student as "you".
- verdict: only for the "Does my revision fix this?" task; otherwise not_applicable.`;

export function assistPrompt(ctx: EssayContext, input: AssistInput): string {
  const a = ASSIST_ACTIONS[input.action];
  const essay = numberedEssay(sentences(ctx.text));
  return `Task: ${a.label}. ${a.ask}
${a.rewrites ? '' : 'This task does not call for rewrites: options must be empty.\n'}
Essay type: ${ESSAY_TYPES[ctx.essayType]}
Prompt: ${ctx.promptText?.trim() || 'none given'}
${input.note ? `Feedback being discussed: "${input.note.title}". Why: ${input.note.why} Suggested action: ${input.note.action} Original passage: "${input.note.quote}"\n` : ''}${input.message ? `Student's note: ${input.message}\n` : ''}
Text before the selection: "...${input.before}"
SELECTED PASSAGE: "${input.selection}"
Text after the selection: "${input.after}..."

Full essay for context:
${essay}`;
}

export async function runAssist(ctx: EssayContext, input: AssistInput, opts: { signal?: AbortSignal; models?: ModelSpec[] } = {}): Promise<AssistResult> {
  const r = await generateStructured({
    task: 'assist',
    system: SYSTEM,
    prompt: assistPrompt(ctx, input),
    schema: AssistSchema,
    maxOutput: 1800,
    minOutput: 700,
    signal: opts.signal,
    timeoutMs: 40_000,
    models: opts.models,
  });
  const selWords = Math.max(1, countWords(input.selection));
  const maxWords = input.action === 'tighten' ? selWords : Math.max(selWords * 2, selWords + 40);
  const options = ASSIST_ACTIONS[input.action].rewrites
    ? r.output.options
        .map((o) => ({ text: o.text.trim().replace(/^["“]|["”]$/g, ''), note: o.note.trim() }))
        .filter((o) => o.text && o.text !== input.selection.trim() && countWords(o.text) <= maxWords)
        .slice(0, 3)
        // Flag names or numbers the essay never mentions so the student can check them.
        .map((o) => ({ ...o, newDetails: newSpecifics(o.text, ctx.text) }))
    : [];
  return {
    reply: r.output.reply.trim(),
    options,
    questions: r.output.questions.map((q) => q.trim()).filter(Boolean).slice(0, 6),
    verdict: input.action === 'check' ? r.output.verdict : 'not_applicable',
    model: r.model,
  };
}
