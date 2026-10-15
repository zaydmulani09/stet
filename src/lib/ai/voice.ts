import { z } from 'zod';
import { numberedEssay, sentences } from '../text';
import { analysisBrief, analyze } from '../analysis';
import { PATTERNS, VOICE_SIGNALS, type VoiceResult } from '../types';
import { generateStructured, type ModelSpec } from './provider';
import { ground, groundAll, QUOTE_RULE, stableId } from './ground';
import type { EssayContext } from './review';
import { ESSAY_TYPES } from '../rubric';

const signalKeys = Object.keys(VOICE_SIGNALS) as [keyof typeof VOICE_SIGNALS, ...Array<keyof typeof VOICE_SIGNALS>];
const patternKeys = Object.keys(PATTERNS) as [keyof typeof PATTERNS, ...Array<keyof typeof PATTERNS>];

export const VoiceSchema = z.object({
  summary: z.string(),
  keep: z.array(z.object({ sentence: z.number().int(), quote: z.string(), why: z.string() })),
  generic: z.array(
    z.object({ sentence: z.number().int(), quote: z.string(), signal: z.enum(signalKeys), why: z.string(), suggestion: z.string(), question: z.string().nullable() }),
  ),
  patterns: z.array(
    z.object({ sentence: z.number().int(), quote: z.string(), pattern: z.enum(patternKeys), observation: z.string(), why: z.string(), suggestion: z.string() }),
  ),
  shift: z.object({ detected: z.boolean(), sentence: z.number().int().nullable(), quote: z.string().nullable(), explanation: z.string() }),
});
export type RawVoice = z.infer<typeof VoiceSchema>;

export const VOICE_SYSTEM = `You are Stet's voice reader. You help a student see where their essay sounds like them and where it slips into generic or formulaic writing. You do not judge who wrote the essay and you never guess or imply whether AI was used.

Rules
- ${QUOTE_RULE}
- Distinctive is not the same as fancy. Plain, specific, odd or funny phrasing that only this student would write is valuable. Never treat dialect, non-native English, or unconventional but effective sentences as problems.
- A pattern is an observable feature of the text, described neutrally (for example: three consecutive sentences open with a formal connector). Human writers produce every one of these patterns; describe the effect on a reader, not the origin.
- Suggestions point the student back to their own specifics. Use [square brackets] for details only they know. Never supply invented experiences, feelings or dialogue.
- The "Measured" lines are exact counts from code; you may cite them, do not re-count.

Fields
- summary: 2-3 sentences: where the student's own perspective is most and least visible.
- keep: 2-5 phrases or sentences worth protecting in revision, with why each sounds like this writer.
- generic: up to 6 passages that read as vague, generic or formulaic. signal is one of: ${signalKeys.join(', ')}. why: what the reader loses. suggestion: how to make it the student's own. question: a question that would surface the specific detail, or null.
- patterns: up to 6 observable stylistic patterns. pattern is one of: ${patternKeys.join(', ')}. observation: what is in the text. why: why it may read as formulaic. suggestion: a practical fix.
- shift: whether the style changes noticeably partway through the draft (detected true/false; if true, the sentence and a quote where it starts; explanation either way).`;

export function voicePrompt(ctx: EssayContext): string {
  const sents = sentences(ctx.text);
  return `Essay type: ${ESSAY_TYPES[ctx.essayType]}
Prompt: ${ctx.promptText?.trim() || 'none given'}

Measured:
${analysisBrief(analyze(ctx.text))}

Essay, one numbered sentence per line, blank line between paragraphs:
${numberedEssay(sents)}`;
}

export function finalizeVoice(raw: RawVoice, text: string, model: string): VoiceResult {
  const sents = sentences(text);
  const keep = groundAll(text, sents, raw.keep);
  const generic = groundAll(text, sents, raw.generic);
  const patterns = groundAll(text, sents, raw.patterns);
  const shiftAnchor = raw.shift.detected && raw.shift.quote ? ground(text, sents, raw.shift.sentence, raw.shift.quote) : null;
  return {
    summary: raw.summary.trim(),
    keep: keep.kept.slice(0, 5).map(({ item, anchor }) => ({ id: stableId('k', anchor.quote, anchor.start), why: item.why.trim(), anchor })),
    generic: generic.kept.slice(0, 6).map(({ item, anchor }) => ({
      id: stableId('g', item.signal, anchor.quote, anchor.start), signal: item.signal, why: item.why.trim(),
      suggestion: item.suggestion.trim(), question: item.question?.trim() || null, anchor,
    })),
    patterns: patterns.kept.slice(0, 6).map(({ item, anchor }) => ({
      id: stableId('p', item.pattern, anchor.quote, anchor.start), pattern: item.pattern, observation: item.observation.trim(),
      why: item.why.trim(), suggestion: item.suggestion.trim(), anchor,
    })),
    // An unquotable shift claim is reported as not detected rather than shown without evidence.
    shift: { detected: Boolean(shiftAnchor), explanation: shiftAnchor || !raw.shift.detected ? raw.shift.explanation.trim() : '', anchor: shiftAnchor },
    dropped: keep.dropped + generic.dropped + patterns.dropped + (raw.shift.detected && !shiftAnchor ? 1 : 0),
    model,
  };
}

export async function runVoice(ctx: EssayContext, opts: { signal?: AbortSignal; models?: ModelSpec[] } = {}): Promise<VoiceResult> {
  const r = await generateStructured({
    task: 'voice',
    system: VOICE_SYSTEM,
    prompt: voicePrompt(ctx),
    schema: VoiceSchema,
    maxOutput: 4500,
    minOutput: 2000,
    signal: opts.signal,
    models: opts.models,
  });
  return finalizeVoice(r.output, ctx.text, r.model);
}
