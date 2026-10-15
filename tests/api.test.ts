import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cookieFrom, ctx, freshDb, req, spec, textModel, failingModel } from './helpers';
import { setModelOverride } from '@/lib/ai/provider';
import { setDb } from '@/lib/db';
import * as essays from '@/app/api/essays/route';
import * as essay from '@/app/api/essays/[id]/route';
import * as versions from '@/app/api/essays/[id]/versions/route';
import * as version from '@/app/api/essays/[id]/versions/[vid]/route';
import * as reviews from '@/app/api/essays/[id]/reviews/route';
import * as review from '@/app/api/essays/[id]/reviews/[rid]/route';
import * as assist from '@/app/api/essays/[id]/assist/route';
import * as check from '@/app/api/essays/[id]/check/route';
import * as signup from '@/app/api/auth/signup/route';
import * as login from '@/app/api/auth/login/route';
import * as logout from '@/app/api/auth/logout/route';
import * as account from '@/app/api/account/route';
import * as exportRoute from '@/app/api/export/route';
import { SAMPLE } from '@/lib/sample';

const ESSAY = 'My grandmother kept a jar of buttons on the kitchen windowsill. Every Sunday I sorted them by color while she cooked. I learned a lot from those afternoons. ' +
  'Later I started sorting other things: my notes, my brother’s Lego, the recycling at school. Sorting taught me that order is a way of paying attention. I learned a lot about patience too.';

const reviewJson = JSON.stringify({
  overall: 'Strong concrete opening; the middle states lessons instead of showing them.',
  takeaway: 'You notice small things.',
  promptFit: { verdict: 'answers', explanation: 'It answers.' },
  strengths: [{ sentence: 1, quote: 'a jar of buttons on the kitchen windowsill', why: 'Concrete image.' }],
  dimensions: [{ key: 'specificity', rating: 'strong', rationale: 'Buttons, Lego, recycling.' }],
  notes: [
    { dimension: 'reflection', severity: 'high', sentence: 3, quote: 'I learned a lot from those afternoons', title: 'Lesson without content', why: 'Says nothing specific.', action: 'Name what you learned.', example: null, question: 'What did sorting teach you?', confidence: 'high' },
    { dimension: 'cliche', severity: 'low', sentence: 7, quote: 'I learned a lot about patience too', title: 'Repeated lesson', why: 'Repeats.', action: 'Cut or show.', example: null, question: null, confidence: 'medium' },
  ],
  plan: [{ step: 'Show the lesson', why: 'core', noteIndexes: [0] }],
  questions: ['What did your grandmother say while you sorted?'],
  caveats: [],
});
const voiceJson = JSON.stringify({
  summary: 'Your voice is clearest in the buttons.',
  keep: [{ sentence: 1, quote: 'a jar of buttons', why: 'Specific.' }],
  generic: [{ sentence: 3, quote: 'I learned a lot from those afternoons', signal: 'repeated_growth_claim', why: 'Vague.', suggestion: 'Show it.', question: null }],
  patterns: [],
  shift: { detected: false, sentence: null, quote: null, explanation: 'Consistent.' },
});
const assistJson = JSON.stringify({ reply: 'Try naming what you noticed.', options: [{ text: 'Those afternoons taught me [what sorting taught you].', note: 'Placeholder for your detail.' }, { text: 'I learned from Coach Rivera in 1999.', note: 'invented' }], questions: ['What did you notice?'], verdict: 'not_applicable' });
const checkJson = JSON.stringify({
  summary: 'The reflection is more specific now.',
  items: [{ noteIndex: 0, status: 'addressed', sentence: 3, quote: 'sorting showed me how she organized her week', explanation: 'Now specific.' }, { noteIndex: 1, status: 'not_addressed', sentence: null, quote: null, explanation: 'Still there.' }],
  newIssues: [],
  promptFit: { verdict: 'answers', explanation: 'Still answers.' },
  reflection: { change: 'deeper', explanation: 'More specific.' },
  specificity: { change: 'similar', explanation: 'Same.' },
});

function mockModels(over: Partial<Record<string, ReturnType<typeof textModel>>> = {}) {
  setModelOverride((task) => [spec(`mock-${task}`, over[task] ?? textModel({ review: reviewJson, voice: voiceJson, assist: assistJson, check: checkJson }[task]))]);
}

async function body(res: Response) {
  return res.json() as Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

async function newGuest(fields: Record<string, unknown> = {}) {
  const res = await essays.POST(req('POST', '/api/essays', { body: { title: 'Buttons', content: ESSAY, ...fields } }), undefined as never);
  expect(res.status).toBe(201);
  return { cookie: cookieFrom(res), essay: (await body(res)).essay };
}

beforeAll(() => {
  process.env.LIMIT_REVIEWS_PER_HOUR = '3';
});
beforeEach(async () => {
  await freshDb();
  mockModels();
});
afterAll(() => {
  setModelOverride(null);
  setDb(null);
});

describe('essays and ownership', () => {
  it('creates a guest account on first write and lists only own essays', async () => {
    const a = await newGuest();
    const b = await newGuest({ title: 'Other' });
    const list = await body(await essays.GET(req('GET', '/api/essays', { cookie: a.cookie }), undefined as never));
    expect(list.essays.map((e: { title: string }) => e.title)).toEqual(['Buttons']);
    expect(list.essays[0].words).toBeGreaterThan(40);
    expect(a.essay.id).not.toBe(b.essay.id);
  });

  it('never lets one user read, edit, delete or review another user\'s essay', async () => {
    const a = await newGuest();
    const b = await newGuest();
    const p = ctx({ id: a.essay.id });
    expect((await essay.GET(req('GET', `/api/essays/${a.essay.id}`, { cookie: b.cookie }), p)).status).toBe(404);
    expect((await essay.PATCH(req('PATCH', '/x', { cookie: b.cookie, body: { content: 'hacked', rev: 0 } }), p)).status).toBe(404);
    expect((await essay.PATCH(req('PATCH', '/x', { cookie: b.cookie, body: { fields: { title: 'hacked' } } }), p)).status).toBe(404);
    expect((await essay.DELETE(req('DELETE', '/x', { cookie: b.cookie }), p)).status).toBe(404);
    expect((await versions.GET(req('GET', '/x', { cookie: b.cookie }), p)).status).toBe(404);
    expect((await reviews.POST(req('POST', '/x', { cookie: b.cookie }), p)).status).toBe(404);
    // a's own review is also unreachable through b's session
    const r = await body(await reviews.POST(req('POST', '/x', { cookie: a.cookie }), p));
    expect((await review.GET(req('GET', '/x', { cookie: b.cookie }), ctx({ id: a.essay.id, rid: r.review.id }))).status).toBe(404);
    expect((await review.PATCH(req('PATCH', '/x', { cookie: b.cookie, body: { itemId: 'n_0123456789', status: 'dismissed' } }), ctx({ id: a.essay.id, rid: r.review.id }))).status).toBe(404);
    expect((await version.GET(req('GET', '/x', { cookie: b.cookie }), ctx({ id: a.essay.id, vid: r.review.versionId }))).status).toBe(404);
    // and the essay is untouched
    const still = await body(await essay.GET(req('GET', '/x', { cookie: a.cookie }), p));
    expect(still.essay.content).toBe(ESSAY);
  });

  it('rejects requests without a session', async () => {
    const a = await newGuest();
    const res = await essay.GET(req('GET', '/x'), ctx({ id: a.essay.id }));
    expect(res.status).toBe(401);
  });

  it('returns 404 for malformed ids instead of a database error', async () => {
    const a = await newGuest();
    expect((await essay.GET(req('GET', '/x', { cookie: a.cookie }), ctx({ id: 'not-a-uuid' }))).status).toBe(404);
    expect((await essay.GET(req('GET', '/x', { cookie: a.cookie }), ctx({ id: "1' or 1=1--" }))).status).toBe(404);
  });

  it('validates request bodies', async () => {
    const a = await newGuest();
    const p = ctx({ id: a.essay.id });
    const bad = async (opts: Parameters<typeof req>[2]) => (await essay.PATCH(req('PATCH', '/x', { cookie: a.cookie, ...opts }), p)).status;
    expect(await bad({ raw: '{nope' })).toBe(400);
    expect(await bad({ body: { content: 'x' } })).toBe(400); // rev missing
    expect(await bad({ body: { fields: { essay_type: 'poem' } } })).toBe(400);
    expect(await bad({ body: { fields: { prompt_id: 'made-up' } } })).toBe(400);
    expect(await bad({ body: { fields: { user_id: 'x' } } })).toBe(400); // unknown field
    expect(await bad({ body: { content: 'x'.repeat(50_000), rev: 0 } })).toBe(400);
    expect(await bad({ raw: '{}', contentType: 'text/plain' })).toBe(415);
  });

  it('refuses cross-site writes', async () => {
    const a = await newGuest();
    const res = await essay.PATCH(req('PATCH', '/x', { cookie: a.cookie, origin: 'https://evil.example', body: { fields: { title: 'x' } } }), ctx({ id: a.essay.id }));
    expect(res.status).toBe(403);
  });

  it('fills limits from the prompt library', async () => {
    const { essay: e } = await newGuest({ prompt_id: 'ca-2' });
    expect(e.word_limit).toBe(650);
    expect(e.min_words).toBe(250);
  });

  it('creates the sample essay on request and marks it', async () => {
    const res = await essays.POST(req('POST', '/api/essays', { body: { sample: true } }), undefined as never);
    const e = (await body(res)).essay;
    expect(e.is_sample).toBe(true);
    expect(e.content).toBe(SAMPLE.content);
  });
});

describe('autosave and history', () => {
  it('saves with revision checks and rejects stale writes with the server copy', async () => {
    const a = await newGuest();
    const p = ctx({ id: a.essay.id });
    const first = await body(await essay.PATCH(req('PATCH', '/x', { cookie: a.cookie, body: { content: 'v1 text', rev: 0 } }), p));
    expect(first.essay.rev).toBe(1);
    const stale = await essay.PATCH(req('PATCH', '/x', { cookie: a.cookie, body: { content: 'other tab', rev: 0 } }), p);
    expect(stale.status).toBe(409);
    const err = await body(stale);
    expect(err.error.code).toBe('conflict');
    expect(err.error.content).toBe('v1 text');
    expect(err.error.rev).toBe(1);
  });

  it('keeps automatic checkpoints, named versions and restores', async () => {
    const a = await newGuest();
    const p = ctx({ id: a.essay.id });
    await essay.PATCH(req('PATCH', '/x', { cookie: a.cookie, body: { content: 'draft one', rev: 0 } }), p);
    const named = await versions.POST(req('POST', '/x', { cookie: a.cookie, body: { label: 'Before cutting' } }), p);
    expect(named.status).toBe(201);
    await essay.PATCH(req('PATCH', '/x', { cookie: a.cookie, body: { content: 'draft two', rev: 1 } }), p);
    const list = (await body(await versions.GET(req('GET', '/x', { cookie: a.cookie }), p))).versions;
    expect(list.some((v: { kind: string }) => v.kind === 'auto')).toBe(true);
    const target = list.find((v: { label: string | null }) => v.label === 'Before cutting');
    const restored = await body(await versions.POST(req('POST', '/x', { cookie: a.cookie, body: { restore: target.id, rev: 2 } }), p));
    expect(restored.content).toBe('draft one');
    const now = (await body(await essay.GET(req('GET', '/x', { cookie: a.cookie }), p))).essay;
    expect(now.content).toBe('draft one');
    const after = (await body(await versions.GET(req('GET', '/x', { cookie: a.cookie }), p))).versions;
    expect(after.some((v: { label: string | null }) => v.label === 'Before restoring an earlier version')).toBe(true);
  });
});

describe('reviews', () => {
  it('runs a review, stores verified anchors and tracks item status', async () => {
    const a = await newGuest();
    const p = ctx({ id: a.essay.id });
    const res = await reviews.POST(req('POST', '/x', { cookie: a.cookie }), p);
    expect(res.status).toBe(201);
    const r = (await body(res)).review;
    expect(r.reviewedText).toBe(ESSAY);
    const notes = r.result.review.notes;
    expect(notes).toHaveLength(2);
    for (const n of notes) expect(ESSAY.slice(n.anchor.start, n.anchor.end)).toBe(n.anchor.quote);
    expect(notes[0].anchor.start).toBe(ESSAY.indexOf('I learned a lot from'));
    expect(r.result.voice.keep).toHaveLength(1);
    expect(r.result.analysis.words).toBeGreaterThan(40);

    const st = await review.PATCH(req('PATCH', '/x', { cookie: a.cookie, body: { itemId: notes[0].id, status: 'dismissed' } }), ctx({ id: a.essay.id, rid: r.id }));
    expect((await body(st)).itemStatus).toEqual({ [notes[0].id]: 'dismissed' });
    const reopened = await review.PATCH(req('PATCH', '/x', { cookie: a.cookie, body: { itemId: notes[0].id, status: 'open' } }), ctx({ id: a.essay.id, rid: r.id }));
    expect((await body(reopened)).itemStatus).toEqual({});
  });

  it('saves a partial review when one model call fails', async () => {
    mockModels({ voice: textModel('garbage') });
    const a = await newGuest();
    const r = (await body(await reviews.POST(req('POST', '/x', { cookie: a.cookie }), ctx({ id: a.essay.id })))).review;
    expect(r.result.review.notes.length).toBeGreaterThan(0);
    expect(r.result.voice).toBeNull();
    expect(r.result.errors.voice).toMatch(/format/);
  });

  it('maps provider failure to a clear error and stores nothing', async () => {
    setModelOverride(() => [spec('down', failingModel(429, { 'retry-after': '20' }))]);
    const a = await newGuest();
    const res = await reviews.POST(req('POST', '/x', { cookie: a.cookie }), ctx({ id: a.essay.id }));
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('20');
    expect((await body(res)).error.code).toBe('ai_busy');
    const list = (await body(await reviews.GET(req('GET', '/x', { cookie: a.cookie }), ctx({ id: a.essay.id })))).reviews;
    expect(list).toHaveLength(0);
  });

  it('refuses drafts that are too short', async () => {
    const a = await newGuest({ content: 'Too short to review.' });
    const res = await reviews.POST(req('POST', '/x', { cookie: a.cookie }), ctx({ id: a.essay.id }));
    expect(res.status).toBe(400);
    expect((await body(res)).error.code).toBe('too_short');
  });

  it('rate limits reviews per user', async () => {
    const a = await newGuest();
    const p = ctx({ id: a.essay.id });
    for (let i = 0; i < 3; i++) expect((await reviews.POST(req('POST', '/x', { cookie: a.cookie }), p)).status).toBe(201);
    const limited = await reviews.POST(req('POST', '/x', { cookie: a.cookie }), p);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
  });
});

describe('assistant and revision check', () => {
  it('requires the selection to match the saved text and flags invented specifics', async () => {
    const a = await newGuest();
    const p = ctx({ id: a.essay.id });
    const start = ESSAY.indexOf('I learned a lot from');
    const text = 'I learned a lot from those afternoons.';
    const mismatch = await assist.POST(req('POST', '/x', { cookie: a.cookie, body: { action: 'clarify', start, end: start + text.length, text: 'something else', rev: 0, reviewId: null, noteId: null, message: null } }), p);
    expect(mismatch.status).toBe(409);
    const ok = await body(await assist.POST(req('POST', '/x', { cookie: a.cookie, body: { action: 'clarify', start, end: start + text.length, text, rev: 0, reviewId: null, noteId: null, message: null } }), p));
    expect(ok.result.options).toHaveLength(2);
    expect(ok.result.options[0].newDetails).toEqual([]);
    expect(ok.result.options[1].newDetails).toEqual(['Coach', 'Rivera', '1999']);
  });

  it('drops rewrite options for actions that should not rewrite', async () => {
    const a = await newGuest();
    const start = ESSAY.indexOf('I learned a lot from');
    const text = 'I learned a lot from those afternoons.';
    const r = await body(await assist.POST(req('POST', '/x', { cookie: a.cookie, body: { action: 'questions', start, end: start + text.length, text, rev: 0, reviewId: null, noteId: null, message: null } }), ctx({ id: a.essay.id })));
    expect(r.result.options).toEqual([]);
    expect(r.result.questions.length).toBeGreaterThan(0);
  });

  it('checks a revision against the earlier review', async () => {
    const a = await newGuest();
    const p = ctx({ id: a.essay.id });
    const r = (await body(await reviews.POST(req('POST', '/x', { cookie: a.cookie }), p))).review;
    const unchanged = await check.POST(req('POST', '/x', { cookie: a.cookie, body: { reviewId: r.id, rev: 0 } }), p);
    expect((await body(unchanged)).error.code).toBe('unchanged');
    const revised = ESSAY.replace('I learned a lot from those afternoons.', 'Watching her, sorting showed me how she organized her week.');
    await essay.PATCH(req('PATCH', '/x', { cookie: a.cookie, body: { content: revised, rev: 0 } }), p);
    const res = await body(await check.POST(req('POST', '/x', { cookie: a.cookie, body: { reviewId: r.id, rev: 1 } }), p));
    expect(res.result.items[0].status).toBe('addressed');
    expect(revised.slice(res.result.items[0].evidence.start, res.result.items[0].evidence.end)).toBe('sorting showed me how she organized her week');
  });
});

describe('accounts', () => {
  it('lets a guest add credentials, sign out, and sign back in to the same essays', async () => {
    const a = await newGuest();
    const s = await signup.POST(req('POST', '/x', { cookie: a.cookie, body: { email: 'Student@Example.com', password: 'correct horse battery' } }), undefined as never);
    expect(s.status).toBe(200);
    expect((await body(s)).user.email).toBe('student@example.com');
    expect((await logout.POST(req('POST', '/x', { cookie: a.cookie }), undefined as never)).status).toBe(200);
    expect((await essay.GET(req('GET', '/x', { cookie: a.cookie }), ctx({ id: a.essay.id }))).status).toBe(401);

    const bad = await login.POST(req('POST', '/x', { body: { email: 'student@example.com', password: 'wrong password!' } }), undefined as never);
    expect(bad.status).toBe(401);
    const good = await login.POST(req('POST', '/x', { body: { email: 'student@example.com', password: 'correct horse battery' } }), undefined as never);
    const cookie = cookieFrom(good);
    expect((await essay.GET(req('GET', '/x', { cookie }), ctx({ id: a.essay.id }))).status).toBe(200);
  });

  it('moves guest essays into the account on sign-in', async () => {
    const owner = await newGuest();
    await signup.POST(req('POST', '/x', { cookie: owner.cookie, body: { email: 'a@b.co', password: 'longenough1' } }), undefined as never);
    const guest = await newGuest({ title: 'Written while signed out' });
    const res = await login.POST(req('POST', '/x', { cookie: guest.cookie, body: { email: 'a@b.co', password: 'longenough1' } }), undefined as never);
    expect((await body(res)).moved).toBe(1);
    const list = (await body(await essays.GET(req('GET', '/x', { cookie: cookieFrom(res) }), undefined as never))).essays;
    expect(list.map((e: { title: string }) => e.title).sort()).toEqual(['Buttons', 'Written while signed out']);
  });

  it('rejects duplicate emails, weak passwords and guest sign-out', async () => {
    const a = await newGuest();
    expect((await logout.POST(req('POST', '/x', { cookie: a.cookie }), undefined as never)).status).toBe(409);
    expect((await signup.POST(req('POST', '/x', { body: { email: 'x@y.co', password: 'short' } }), undefined as never)).status).toBe(400);
    expect((await signup.POST(req('POST', '/x', { body: { email: 'x@y.co', password: 'long enough pw' } }), undefined as never)).status).toBe(200);
    expect((await signup.POST(req('POST', '/x', { body: { email: 'X@Y.co', password: 'long enough pw' } }), undefined as never)).status).toBe(409);
  });

  it('exports and deletes all data', async () => {
    const a = await newGuest();
    await reviews.POST(req('POST', '/x', { cookie: a.cookie }), ctx({ id: a.essay.id }));
    const ex = await exportRoute.GET(req('GET', '/x', { cookie: a.cookie }), undefined as never);
    expect(ex.headers.get('content-disposition')).toContain('attachment');
    const data = await body(ex);
    expect(data.essays).toHaveLength(1);
    expect(data.reviews).toHaveLength(1);
    expect((await account.DELETE(req('DELETE', '/x', { cookie: a.cookie }), undefined as never)).status).toBe(200);
    expect((await essay.GET(req('GET', '/x', { cookie: a.cookie }), ctx({ id: a.essay.id }))).status).toBe(401);
  });
});
