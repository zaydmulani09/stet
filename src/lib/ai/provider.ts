import { APICallError, generateText, NoObjectGeneratedError, Output, type LanguageModel } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { z } from 'zod';

// One function, generateStructured(), is the only way the app talks to a model.
// It walks an ordered list of models: on rate limits, oversize requests, timeouts, provider
// errors or schema-invalid output it moves to the next model; if every model fails it throws
// AIError with a reason the UI can show honestly.

export type Task = 'review' | 'voice' | 'assist' | 'check';

export interface ModelSpec {
  id: string; // shown to users, e.g. "groq/openai/gpt-oss-120b"
  /** Max prompt + completion tokens per request. Groq's free tier reserves both against 8,000 tokens/minute. */
  budget: number;
  model: () => LanguageModel;
  options: Record<string, Record<string, string | boolean>>;
  /** Omitted for models that reject non-default sampling (Claude Haiku 5.5 returns 400). */
  temperature?: number;
}

let groqProvider: ReturnType<typeof createGroq> | null = null;
const groq = (id: string) => () => (groqProvider ??= createGroq({ apiKey: process.env.GROQ_API_KEY }))(id);

const GROQ: Record<string, ModelSpec> = {
  'gpt-oss-120b': { id: 'groq/openai/gpt-oss-120b', budget: 7800, model: groq('openai/gpt-oss-120b'), options: { groq: { reasoningEffort: 'low', strictJsonSchema: true } }, temperature: 0.2 },
  'gpt-oss-20b': { id: 'groq/openai/gpt-oss-20b', budget: 7800, model: groq('openai/gpt-oss-20b'), options: { groq: { reasoningEffort: 'low', strictJsonSchema: true } }, temperature: 0.2 },
  'qwen3.8-27b': { id: 'groq/qwen/qwen3.8-27b', budget: 7800, model: groq('qwen/qwen3.8-27b'), options: { groq: { reasoningEffort: 'none', strictJsonSchema: true } }, temperature: 0.2 },
};

// Different tasks start on different models so parallel calls draw on separate per-model limits.
const ORDER: Record<Task, string[]> = {
  review: ['gpt-oss-120b', 'qwen3.8-27b', 'gpt-oss-20b'],
  voice: ['qwen3.8-27b', 'gpt-oss-120b', 'gpt-oss-20b'],
  assist: ['gpt-oss-20b', 'gpt-oss-120b', 'qwen3.8-27b'],
  check: ['gpt-oss-120b', 'qwen3.8-27b', 'gpt-oss-20b'],
};

let override: ((task: Task) => ModelSpec[]) | null = null;
/** Test seam: replace the model chain. */
export function setModelOverride(fn: typeof override) {
  override = fn;
}

export function modelsFor(task: Task): ModelSpec[] {
  if (override) return override(task);
  const chain: ModelSpec[] = [];
  // Optional: Vercel AI Gateway (e.g. anthropic/claude-haiku-5.5) first, when the team has enabled it.
  const gw = process.env.AI_GATEWAY_MODEL;
  if (gw) chain.push({ id: gw, budget: 60000, model: () => gw, options: { gateway: { disallowPromptTraining: true } } });
  if (process.env.GROQ_API_KEY) chain.push(...ORDER[task].map((k) => GROQ[k]));
  return chain;
}

export type AIErrorCode = 'busy' | 'unavailable' | 'invalid_output' | 'too_long' | 'cancelled' | 'not_configured';

export class AIError extends Error {
  constructor(
    public code: AIErrorCode,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

/** Conservative token estimate (English prose runs ~4 chars/token; JSON schemas denser). */
export const estimateTokens = (s: string) => Math.ceil(s.length / 3.2);

export interface GenerateArgs<S extends z.ZodType> {
  task: Task;
  system: string;
  prompt: string;
  schema: S;
  maxOutput: number;
  minOutput?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  models?: ModelSpec[];
}

export interface Generated<T> {
  output: T;
  model: string;
  usage: { input: number | undefined; output: number | undefined };
  attempts: string[];
}

function retryAfterSeconds(e: APICallError): number | undefined {
  const h = e.responseHeaders?.['retry-after'];
  const n = h ? Number(h) : NaN;
  return Number.isFinite(n) ? Math.ceil(n) : undefined;
}

export async function generateStructured<S extends z.ZodType>(args: GenerateArgs<S>): Promise<Generated<z.infer<S>>> {
  const models = args.models ?? modelsFor(args.task);
  if (!models.length) throw new AIError('not_configured', 'No AI provider is configured on this deployment (GROQ_API_KEY is missing).');
  const schemaSize = estimateTokens(JSON.stringify(z.toJSONSchema(args.schema)));
  const promptTokens = estimateTokens(args.system) + estimateTokens(args.prompt) + schemaSize + 50;
  const minOutput = args.minOutput ?? Math.min(1500, args.maxOutput);

  const attempts: string[] = [];
  let busy = 0;
  let tooLong = 0;
  let minRetry: number | undefined;

  for (const spec of models) {
    const room = spec.budget - promptTokens;
    if (room < minOutput) {
      attempts.push(`${spec.id}: too long`);
      tooLong++;
      continue;
    }
    if (args.signal?.aborted) throw new AIError('cancelled', 'Request cancelled.');
    const timeout = AbortSignal.timeout(args.timeoutMs ?? 50_000);
    try {
      const r = await generateText({
        model: spec.model(),
        system: args.system,
        prompt: args.prompt,
        output: Output.object({ schema: args.schema }),
        maxOutputTokens: Math.min(args.maxOutput, room),
        maxRetries: 0,
        temperature: spec.temperature,
        abortSignal: args.signal ? AbortSignal.any([args.signal, timeout]) : timeout,
        providerOptions: spec.options,
      });
      if (process.env.STET_DEBUG_AI) console.info(`[stet] ai ${args.task} ${spec.id} est_in=${promptTokens} in=${r.usage?.inputTokens} out=${r.usage?.outputTokens} reasoning=${r.usage?.outputTokenDetails?.reasoningTokens ?? '?'}`);
      return {
        output: r.output as z.infer<S>,
        model: spec.id,
        usage: { input: r.usage?.inputTokens, output: r.usage?.outputTokens },
        attempts: [...attempts, `${spec.id}: ok`],
      };
    } catch (e) {
      if (args.signal?.aborted) throw new AIError('cancelled', 'Request cancelled.');
      if (APICallError.isInstance(e)) {
        const s = e.statusCode ?? 0;
        if (s === 429) {
          busy++;
          const ra = retryAfterSeconds(e);
          if (ra !== undefined) minRetry = Math.min(minRetry ?? ra, ra);
        }
        if (s === 413) tooLong++;
        attempts.push(`${spec.id}: http ${s}`);
      } else if (NoObjectGeneratedError.isInstance(e)) {
        attempts.push(`${spec.id}: invalid output (${e.finishReason ?? 'unknown'})`);
      } else if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
        attempts.push(`${spec.id}: timeout`);
      } else {
        attempts.push(`${spec.id}: ${e instanceof Error ? e.name : 'error'}`);
      }
      console.warn(`[stet] ai ${args.task} attempt failed`, attempts.at(-1));
    }
  }

  if (tooLong === models.length) throw new AIError('too_long', 'This text is too long for the free model limits. Shorten it or review a section at a time.');
  if (busy > 0 && busy + tooLong === models.length)
    throw new AIError('busy', 'The free AI models are at capacity right now. Wait a minute and try again.', minRetry ?? 60);
  if (attempts.every((a) => a.includes('invalid output')))
    throw new AIError('invalid_output', 'The model returned output that did not match the review format. Try again.');
  throw new AIError('unavailable', 'The AI service did not respond. Your draft is saved; try again in a moment.', minRetry);
}
