import Link from 'next/link';
import { TopBar } from '@/components/TopBar';
import { OpenSampleButton } from '@/components/OpenSampleButton';
import { listEssays } from '@/lib/essays';
import { currentUser } from '@/lib/session';
import { LIBRARY_BY_ID, SOURCES } from '@/lib/prompt-library';
import { ESSAY_TYPES, type EssayType } from '@/lib/rubric';
import { timeAgo } from '@/lib/client';
import type { StoredReview } from '@/lib/types';
import SAMPLE_REVIEW from '@/lib/sample-review.json';
import { SAMPLE } from '@/lib/sample';
import { sentences } from '@/lib/text';

export const dynamic = 'force-dynamic';

type Row = Awaited<ReturnType<typeof listEssays>>[number];

function reviewState(r: Row) {
  const result = r.review_result as StoredReview | null;
  if (!result?.review) return { label: 'Not reviewed', open: 0 };
  const status = r.item_status ?? {};
  const open = result.review.notes.filter((n) => n.severity === 'high' && !status[n.id]).length;
  return { label: r.reviewed_rev_match ? 'Reviewed' : 'Edited since review', open };
}

function promptLabel(r: Row) {
  const p = r.prompt_id ? LIBRARY_BY_ID.get(r.prompt_id) : null;
  if (p) return `${p.source} · ${p.title}`;
  if (r.prompt_text) return r.prompt_text.length > 70 ? `${r.prompt_text.slice(0, 70)}…` : r.prompt_text;
  return ESSAY_TYPES[r.essay_type as EssayType] ?? 'Essay';
}

export default async function Home() {
  const user = await currentUser();
  const rows = user ? await listEssays(user.id) : [];
  return (
    <>
      <TopBar active="/" signedIn={Boolean(user?.email)} />
      <main className="mx-auto w-full max-w-[1080px] px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
        {rows.length ? <EssayTable rows={rows} hasSample={rows.some((r) => r.is_sample)} /> : <FirstVisit />}
      </main>
    </>
  );
}

function EssayTable({ rows, hasSample }: { rows: Row[]; hasSample: boolean }) {
  return (
    <section aria-labelledby="essays-h">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h1 id="essays-h" className="font-serif text-[28px] font-semibold leading-tight">Your essays</h1>
        <div className="flex gap-2">
          {!hasSample && <OpenSampleButton className="btn" label="Open the sample" />}
          <Link href="/new" className="btn btn-primary no-underline">New essay</Link>
        </div>
      </div>
      <div className="overflow-hidden rounded-[10px] border border-rule bg-paper">
        <table className="w-full border-collapse text-left text-[14px]">
          <thead className="hidden text-[12.5px] text-ink-3 md:table-header-group">
            <tr className="border-b border-rule">
              <th className="px-4 py-2.5 font-semibold">Essay</th>
              <th className="px-3 py-2.5 font-semibold">Length</th>
              <th className="px-3 py-2.5 font-semibold">Review</th>
              <th className="px-4 py-2.5 text-right font-semibold">Edited</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const st = reviewState(r);
              const limit = r.word_limit ? `${r.words} / ${r.word_limit}` : `${r.words}`;
              const over = r.word_limit ? r.words > r.word_limit : false;
              return (
                <tr key={r.id} className="group border-b border-rule last:border-0 hover:bg-desk/60">
                  <td className="px-4 py-3 align-top">
                    <Link href={`/essays/${r.id}`} className="font-semibold text-ink no-underline group-hover:underline">
                      {r.title}
                    </Link>
                    {r.is_sample && <span className="ml-2 rounded border border-rule px-1.5 py-px text-[11.5px] text-ink-3">Sample</span>}
                    <div className="mt-0.5 line-clamp-1 text-[13px] text-ink-3">{promptLabel(r)}</div>
                    <div className="mt-1 flex gap-3 text-[12.5px] text-ink-3 md:hidden">
                      <span>{limit} words</span>
                      <span>{st.label}</span>
                      <span>{timeAgo(r.updated_at)}</span>
                    </div>
                  </td>
                  <td className={`hidden px-3 py-3 align-top md:table-cell ${over ? 'font-semibold text-high' : 'text-ink-2'}`}>
                    {limit} <span className="text-ink-3">words</span>
                  </td>
                  <td className="hidden px-3 py-3 align-top md:table-cell">
                    <div className="text-ink-2">{st.label}</div>
                    {st.open > 0 && (
                      <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-high">
                        <span className="mark mark-high" aria-hidden /> {st.open} high-priority {st.open === 1 ? 'note' : 'notes'} open
                      </div>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-right align-top text-ink-3 md:table-cell">{timeAgo(r.updated_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FirstVisit() {
  const review = (SAMPLE_REVIEW as unknown as StoredReview).review!;
  const voice = (SAMPLE_REVIEW as unknown as StoredReview).voice!;
  const keep = voice.keep.find((k) => k.anchor.quote.includes('shopping cart')) ?? voice.keep[0];
  const note = review.notes.find((n) => n.anchor.quote.startsWith('I learned')) ?? review.notes[0];
  // The sentence holding the quote plus the one before it: enough context, no wall of text.
  const sents = sentences(SAMPLE.content);
  const para = (q: string) => {
    const i = sents.findIndex((s) => s.text.includes(q));
    return i < 0 ? q : sents.slice(Math.max(0, i - 1), i + 1).map((s) => s.text).join(' ');
  };
  const mark = (text: string, quote: string, cls: string) => {
    const i = text.indexOf(quote);
    if (i < 0) return text;
    return (
      <>
        {text.slice(0, i)}
        <span className={`ann ${cls}`}>{quote}</span>
        {text.slice(i + quote.length)}
      </>
    );
  };
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14">
      <section className="pt-2">
        <h1 className="font-serif text-[34px] font-semibold leading-[1.15] tracking-[-0.015em] sm:text-[40px]">
          Feedback that points at the sentence.
        </h1>
        <p className="mt-5 max-w-[52ch] text-[16.5px] leading-relaxed text-ink-2">
          Paste a college essay and get an editor&rsquo;s read: what is working, what to fix first, and where your own voice is
          strongest. Every comment is tied to the exact words it is about. Stet never rewrites your essay.
        </p>
        <div className="mt-7 flex flex-wrap gap-2.5">
          <Link href="/new" className="btn btn-primary h-10 px-4 text-[15px] no-underline">Start an essay</Link>
          <OpenSampleButton className="btn h-10 px-4 text-[15px]" label="Open the sample review" />
        </div>
        <dl className="mt-10 grid max-w-[56ch] gap-4 border-t border-rule pt-6 text-[14.5px]">
          <div>
            <dt className="font-semibold">Prompts for the 2026–27 cycle</dt>
            <dd className="text-ink-2">All seven Common App prompts, the UC Personal Insight Questions, and supplements from {SOURCES.length - 2} colleges, copied from official pages. Or paste any prompt.</dd>
          </div>
          <div>
            <dt className="font-semibold">A pattern check, not a detector</dt>
            <dd className="text-ink-2">Shows formulaic patterns with the passage and the reason. It never scores &ldquo;AI probability&rdquo;, because no tool can tell who wrote an essay from the text alone.</dd>
          </div>
          <div>
            <dt className="font-semibold">Revisions you can check</dt>
            <dd className="text-ink-2">Compare drafts word by word and see which feedback a revision actually resolved.</dd>
          </div>
        </dl>
      </section>

      <figure className="self-start rounded-[10px] border border-rule bg-paper shadow-sheet" aria-label="Excerpt from the sample review">
        <figcaption className="flex items-center justify-between border-b border-rule px-5 py-3 text-[13px] text-ink-3">
          <span>From the sample review</span>
          <span>{SAMPLE.title.replace('Sample: ', '')}</span>
        </figcaption>
        <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_200px]">
          <div className="essay-text space-y-4 text-[16.5px]">
            <p>{mark(para(keep.anchor.quote), keep.anchor.quote, 'ann-keep')}</p>
            <p>{mark(para(note.anchor.quote), note.anchor.quote, `ann-${note.severity}`)}</p>
          </div>
          <div className="space-y-4 text-[13.5px] leading-snug sm:border-l sm:border-rule sm:pl-4">
            <div>
              <div className="flex items-center gap-2 font-semibold text-keep"><span className="mark mark-keep" aria-hidden />Keep this</div>
              <p className="mt-1 text-ink-2">{keep.why}</p>
            </div>
            <div>
              <div className={`flex items-center gap-2 font-semibold ${note.severity === 'high' ? 'text-high' : note.severity === 'medium' ? 'text-medium' : 'text-ink-2'}`}>
                <span className={`mark mark-${note.severity}`} aria-hidden />{note.title}
              </div>
              <p className="mt-1 text-ink-2">{note.why}</p>
            </div>
          </div>
        </div>
      </figure>
    </div>
  );
}
