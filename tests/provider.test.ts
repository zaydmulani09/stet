import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AIError, generateStructured } from '@/lib/ai/provider';
import { failingModel, spec, textModel } from './helpers';

const schema = z.object({ answer: z.string() });
const base = { task: 'assist' as const, system: 'sys', prompt: 'p', schema, maxOutput: 500, minOutput: 100 };

describe('generateStructured', () => {
  it('returns validated output and the model id', async () => {
    const r = await generateStructured({ ...base, models: [spec('m1', textModel('{"answer":"yes"}'))] });
    expect(r.output).toEqual({ answer: 'yes' });
    expect(r.model).toBe('m1');
  });

  it('falls back to the next model on a rate limit', async () => {
    const r = await generateStructured({ ...base, models: [spec('busy', failingModel(429)), spec('ok', textModel('{"answer":"fallback"}'))] });
    expect(r.output.answer).toBe('fallback');
    expect(r.attempts[0]).toContain('http 429');
  });

  it('falls back on malformed JSON and on schema-invalid JSON', async () => {
    const r = await generateStructured({
      ...base,
      models: [spec('broken', textModel('{"answer": ')), spec('wrong', textModel('{"other":1}')), spec('ok', textModel('{"answer":"third"}'))],
    });
    expect(r.output.answer).toBe('third');
    expect(r.attempts.slice(0, 2).every((a) => a.includes('invalid output'))).toBe(true);
  });

  it('reports invalid output when every model returns garbage', async () => {
    const err = await generateStructured({ ...base, models: [spec('a', textModel('not json')), spec('b', textModel('[]'))] }).catch((e) => e);
    expect(err).toBeInstanceOf(AIError);
    expect(err.code).toBe('invalid_output');
  });

  it('reports busy with retry-after when all models are rate limited', async () => {
    const err = await generateStructured({ ...base, models: [spec('a', failingModel(429, { 'retry-after': '12' })), spec('b', failingModel(429, { 'retry-after': '30' }))] }).catch((e) => e);
    expect(err.code).toBe('busy');
    expect(err.retryAfter).toBe(12);
  });

  it('times out a hung provider and moves on', async () => {
    const r = await generateStructured({ ...base, timeoutMs: 50, models: [spec('slow', textModel('{"answer":"late"}', 2000)), spec('fast', textModel('{"answer":"fast"}'))] });
    expect(r.output.answer).toBe('fast');
    expect(r.attempts[0]).toContain('timeout');
  });

  it('reports unavailable on provider errors and timeouts', async () => {
    const err = await generateStructured({ ...base, timeoutMs: 30, models: [spec('down', failingModel(500)), spec('slow', textModel('{}', 1000))] }).catch((e) => e);
    expect(err.code).toBe('unavailable');
  });

  it('stops immediately when the caller cancels', async () => {
    const ac = new AbortController();
    const p = generateStructured({ ...base, signal: ac.signal, models: [spec('slow', textModel('{"answer":"x"}', 2000)), spec('never', textModel('{"answer":"y"}'))] });
    setTimeout(() => ac.abort(), 20);
    const err = await p.catch((e) => e);
    expect(err.code).toBe('cancelled');
  });

  it('skips models whose token budget cannot fit the request', async () => {
    const big = 'word '.repeat(20_000);
    const err = await generateStructured({ ...base, prompt: big, models: [spec('small', textModel('{"answer":"x"}'), 7800)] }).catch((e) => e);
    expect(err.code).toBe('too_long');
  });

  it('reports not_configured without any model', async () => {
    const err = await generateStructured({ ...base, models: [] }).catch((e) => e);
    expect(err.code).toBe('not_configured');
  });
});
