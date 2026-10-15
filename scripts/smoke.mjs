// End-to-end smoke test against a running deployment. Creates a guest, runs one real review,
// exercises the main APIs, then deletes the guest and all its data.
// Usage: node scripts/smoke.mjs https://stet-essay.vercel.app
const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
let cookie = '';
const results = [];

async function call(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { origin: base, ...(cookie ? { cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  const type = res.headers.get('content-type') ?? '';
  return { status: res.status, data: type.includes('json') ? await res.json() : await res.text(), headers: res.headers };
}

function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
}

const t0 = Date.now();
const health = await call('GET', '/api/health');
check('health', health.status === 200 && health.data.db === 'up' && health.data.ai === true, JSON.stringify(health.data));

for (const p of ['/', '/prompts', '/method', '/new', '/account']) {
  const r = await call('GET', p);
  check(`page ${p}`, r.status === 200 && String(r.data).includes('stet'));
}

const created = await call('POST', '/api/essays', { sample: true });
const essay = created.data.essay;
check('create sample essay (guest session)', created.status === 201 && Boolean(cookie) && essay?.is_sample === true);

const page = await call('GET', `/essays/${essay.id}`);
check('workspace page renders', page.status === 200 && String(page.data).includes('Tuesday'));

const stranger = await fetch(`${base}/api/essays/${essay.id}`);
check('no session cannot read the essay', stranger.status === 401);

const crossSite = await fetch(`${base}/api/essays/${essay.id}`, { method: 'PATCH', headers: { cookie, origin: 'https://evil.example', 'content-type': 'application/json' }, body: JSON.stringify({ fields: { title: 'x' } }) });
check('cross-site write refused', crossSite.status === 403);

const reviews0 = await call('GET', `/api/essays/${essay.id}/reviews`);
check('sample review attached', reviews0.data.reviews?.length === 1);

const edited = essay.content.replace('I felt so overwhelmed.', 'My hands were shaking.');
const saved = await call('PATCH', `/api/essays/${essay.id}`, { content: edited, rev: essay.rev });
check('autosave', saved.status === 200 && saved.data.essay.rev === essay.rev + 1);
const stale = await call('PATCH', `/api/essays/${essay.id}`, { content: 'stale', rev: essay.rev });
check('stale save gets 409 with server copy', stale.status === 409 && stale.data.error.content === edited);

const tr = Date.now();
const review = await call('POST', `/api/essays/${essay.id}/reviews`);
const r = review.data.review;
const notes = r?.result?.review?.notes ?? [];
const grounded = notes.every((n) => edited.slice(n.anchor.start, n.anchor.end) === n.anchor.quote);
check('live review', review.status === 201 && typeof r.result === 'object' && notes.length > 0 && grounded, `${Date.now() - tr} ms, ${notes.length} notes, model ${r?.result?.review?.model}, voice ${r?.result?.voice?.model ?? r?.result?.errors?.voice}`);

if (notes[0]) {
  const st = await call('PATCH', `/api/essays/${essay.id}/reviews/${r.id}`, { itemId: notes[0].id, status: 'resolved' });
  check('resolve a note', st.status === 200 && st.data.itemStatus[notes[0].id] === 'resolved');
  const a = notes[0].anchor;
  const assist = await call('POST', `/api/essays/${essay.id}/assist`, { action: 'questions', start: a.start, end: a.end, text: a.quote, rev: essay.rev + 1, reviewId: r.id, noteId: notes[0].id, message: null });
  check('assistant', assist.status === 200 && assist.data.result.questions.length > 0, assist.data.result?.model ?? JSON.stringify(assist.data).slice(0, 160));
}

const revised = edited.replace('Moreover, ', '').replace('Furthermore, ', '');
const s2 = await call('PATCH', `/api/essays/${essay.id}`, { content: revised, rev: essay.rev + 1 });
const checkRes = await call('POST', `/api/essays/${essay.id}/check`, { reviewId: r.id, rev: s2.data.essay.rev });
check('revision check', checkRes.status === 200 && checkRes.data.result.items.length > 0, checkRes.data.result?.model ?? JSON.stringify(checkRes.data).slice(0, 160));

const versions = await call('GET', `/api/essays/${essay.id}/versions`);
check('versions', versions.status === 200 && versions.data.versions.length >= 2);

const compare = await call('GET', `/essays/${essay.id}/compare?a=${r.versionId}`);
check('compare page', compare.status === 200 && String(compare.data).includes('Compare drafts'));

const ex = await call('GET', '/api/export');
check('export', ex.status === 200 && ex.data.essays.length === 1 && ex.data.reviews.length >= 2);

const del = await call('DELETE', '/api/account');
check('delete account', del.status === 200);
const gone = await fetch(`${base}/api/essays/${essay.id}`, { headers: { cookie } });
check('data gone after delete', gone.status === 401);

const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed in ${Math.round((Date.now() - t0) / 1000)} s against ${base}`);
process.exit(failed ? 1 : 0);
