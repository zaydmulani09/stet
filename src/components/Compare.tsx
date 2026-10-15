'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { diffWordsWithSpace } from 'diff';
import { ArrowLeft } from 'lucide-react';
import { analyze, type Analysis } from '@/lib/analysis';
import { DIMENSIONS, RATING_LABEL } from '@/lib/rubric';
import type { StoredReview } from '@/lib/types';
import type { CheckResult } from '@/lib/ai/compare';
import { api, ApiError } from '@/lib/client';
import { localTime, useHydrated } from './LocalTime';

export interface Side {
  id: string;
  label: string;
  content: string;
  at: string;
  review: StoredReview | null;
  reviewId: string | null;
}

interface VersionOpt {
  id: string;
  label: string | null;
  kind: string;
  at: string;
  words: number;
}

const KIND: Record<string, string> = { manual: 'Saved', review: 'Reviewed', auto: 'Checkpoint', restore: 'Restored' };

function delta(a: number, b: number, unit = '') {
  const d = Math.round((b - a) * 100) / 100;
  if (d === 0) return <span className="text-ink-3">no change</span>;
  return <span className="font-semibold">{d > 0 ? '+' : ''}{d}{unit}</span>;
}

export function Compare({ essayId, title, rev, a, b, versions }: { essayId: string; title: string; rev: number; a: Side; b: Side; versions: VersionOpt[] }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [check, setCheck] = useState<{ running: boolean; result: CheckResult | null; error: string | null }>({ running: false, result: null, error: null });
  const parts = useMemo(() => diffWordsWithSpace(a.content, b.content), [a.content, b.content]);
  const ma = useMemo(() => analyze(a.content), [a.content]);
  const mb = useMemo(() => analyze(b.content), [b.content]);
  const changedWords = parts.filter((p) => p.added || p.removed).reduce((n, p) => n + (p.value.match(/[\p{L}\p{N}]+/gu)?.length ?? 0), 0);
  const notes = a.review?.review?.notes ?? [];
  const go = (key: 'a' | 'b', v: string) => router.push(`/essays/${essayId}/compare?a=${key === 'a' ? v : a.id}&b=${key === 'b' ? v : b.id}`);

  const select = (key: 'a' | 'b', value: string) => (
    <select className="field mt-1" value={value} onChange={(e) => go(key, e.target.value)} aria-label={key === 'a' ? 'Earlier draft' : 'Later draft'}>
      {key === 'b' && <option value="current">Current draft</option>}
      {versions.map((v) => (
        <option key={v.id} value={v.id}>
          {(v.label ?? KIND[v.kind] ?? v.kind) + ` · ${localTime(v.at, hydrated)} · ${v.words} words`}
        </option>
      ))}
    </select>
  );

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 pb-24 pt-6 sm:px-6">
      <Link href={`/essays/${essayId}`} className="inline-flex items-center gap-1.5 text-[14px] text-ink-2 no-underline hover:text-ink">
        <ArrowLeft size={15} aria-hidden /> Back to {title}
      </Link>
      <h1 className="mt-3 font-serif text-[28px] font-semibold">Compare drafts</h1>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block text-[13px] font-semibold text-ink-2">Earlier{select('a', a.id)}</label>
        <label className="block text-[13px] font-semibold text-ink-2">Later{select('b', b.id)}</label>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-labelledby="diff-h" className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="diff-h" className="text-[16px] font-semibold">What changed</h2>
            <p className="flex gap-3 text-[13px] text-ink-3">
              <span><span className="diff-del px-1">removed</span></span>
              <span><span className="diff-ins px-1">added</span></span>
              <span>{changedWords} words changed</span>
            </p>
          </div>
          <div className="essay-text whitespace-pre-wrap rounded-[10px] border border-rule bg-paper px-5 py-6 text-[17px] shadow-sheet sm:px-10 sm:py-8">
            {a.content === b.content ? (
              <p className="font-sans text-[15px] text-ink-2">These two drafts are identical.</p>
            ) : (
              parts.map((p, i) => (p.added ? <ins key={i} className="diff-ins no-underline">{p.value}</ins> : p.removed ? <del key={i} className="diff-del">{p.value}</del> : <span key={i}>{p.value}</span>))
            )}
          </div>
        </section>

        <aside className="grid content-start gap-6">
          <Panel title="Measured changes" note="Counted by code, not judged.">
            <table className="w-full text-[14px]">
              <thead className="text-[12px] text-ink-3">
                <tr><th className="pb-1 text-left font-semibold"><span className="sr-only">Measure</span></th><th className="pb-1 text-right font-semibold">Earlier</th><th className="pb-1 text-right font-semibold">Later</th><th className="pb-1 text-right font-semibold">Change</th></tr>
              </thead>
              <tbody>
                <Row label="Words" a={ma.words} b={mb.words} />
                <Row label="Sentences" a={ma.sentenceCount} b={mb.sentenceCount} />
                <Row label="Avg. sentence length" a={ma.avgSentenceWords} b={mb.avgSentenceWords} />
                <Row label="Length variation" a={ma.sentenceLengthCv} b={mb.sentenceLengthCv} />
                {patternRows(ma, mb)}
              </tbody>
            </table>
            <p className="mt-2 text-[12.5px] text-ink-3">Fewer flagged patterns is usually good, but a longer or more formal draft is not automatically better.</p>
          </Panel>

          {notes.length > 0 && (
            <Panel title="Feedback on the earlier draft" note="Whether the passage changed is measured. Whether the change fixes the problem needs judgement.">
              <ul className="grid gap-3 text-[14px]">
                {notes.map((n) => {
                  const still = b.content.includes(n.anchor.quote);
                  const c = check.result?.items.find((x) => x.noteId === n.id);
                  return (
                    <li key={n.id}>
                      <div className="flex items-center gap-2 font-semibold"><span className={`mark mark-${n.severity}`} aria-hidden />{n.title}</div>
                      <p className="quote mt-0.5 line-clamp-2 text-ink-3">&ldquo;{n.anchor.quote}&rdquo;</p>
                      <p className={`mt-0.5 text-[13px] ${still ? 'text-ink-2' : 'text-keep'}`}>{still ? 'Passage unchanged' : 'Passage revised or removed'}</p>
                      {c && (
                        <p className="mt-0.5 text-[13px]">
                          <span className={`font-semibold ${c.status === 'addressed' || c.status === 'removed' ? 'text-keep' : c.status === 'partly' ? 'text-medium' : 'text-high'}`}>
                            AI: {{ addressed: 'addressed', partly: 'partly addressed', not_addressed: 'not addressed', removed: 'passage removed' }[c.status]}.
                          </span>{' '}
                          <span className="text-ink-2">{c.explanation}</span>
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
              {b.id === 'current' && a.reviewId ? (
                <div className="mt-4">
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={check.running || a.content === b.content}
                    onClick={async () => {
                      setCheck({ running: true, result: null, error: null });
                      try {
                        const { result } = await api<{ result: CheckResult }>(`/api/essays/${essayId}/check`, { body: { reviewId: a.reviewId, rev } });
                        setCheck({ running: false, result, error: null });
                      } catch (e) {
                        setCheck({ running: false, result: null, error: e instanceof ApiError ? e.message : 'Check failed.' });
                      }
                    }}
                  >
                    {check.running ? 'Checking…' : 'Check revisions with AI'}
                  </button>
                  {check.error && <p role="alert" className="mt-2 text-[13px] text-high">{check.error}</p>}
                  {check.result && (
                    <div className="mt-3 grid gap-2 rounded-md bg-desk p-3 text-[13.5px]">
                      <p>{check.result.summary}</p>
                      <p><span className="font-semibold">Reflection:</span> {check.result.reflection.change}. {check.result.reflection.explanation}</p>
                      <p><span className="font-semibold">Specificity:</span> {check.result.specificity.change}. {check.result.specificity.explanation}</p>
                      <p><span className="font-semibold">Prompt:</span> {check.result.promptFit.explanation}</p>
                      <p className="text-[12.5px] text-ink-3">AI assessment by {check.result.model}; treat it as a second opinion.</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-[12.5px] text-ink-3">AI revision checks compare a reviewed draft with your current draft.</p>
              )}
            </Panel>
          )}

          {a.review?.review && b.review?.review && (
            <Panel title="Rubric, both reviews" note="Each column is a separate AI review; ratings can vary between runs.">
              <table className="w-full text-[13.5px]">
                <thead className="text-[12px] text-ink-3"><tr><th className="py-1 text-left font-semibold">Dimension</th><th className="font-semibold">Earlier</th><th className="font-semibold">Later</th></tr></thead>
                <tbody>
                  {a.review.review.dimensions.map((d) => {
                    const other = b.review!.review!.dimensions.find((x) => x.key === d.key);
                    return (
                      <tr key={d.key} className="border-t border-rule">
                        <td className="py-1.5 pr-2">{DIMENSIONS[d.key].name}</td>
                        <td className="text-center text-ink-2">{RATING_LABEL[d.rating]}</td>
                        <td className="text-center font-semibold">{other ? RATING_LABEL[other.rating] : '–'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Panel>
          )}
        </aside>
      </div>
    </main>
  );
}

function patternRows(a: Analysis, b: Analysis) {
  const kinds = new Set([...a.groups, ...b.groups].map((g) => g.kind));
  return [...kinds].map((k) => {
    const ga = a.groups.find((g) => g.kind === k);
    const gb = b.groups.find((g) => g.kind === k);
    return <Row key={k} label={(ga ?? gb)!.label} a={ga?.count ?? 0} b={gb?.count ?? 0} lowerIsBetter />;
  });
}

function Row({ label, a, b, lowerIsBetter }: { label: string; a: number; b: number; lowerIsBetter?: boolean }) {
  const better = lowerIsBetter && b < a;
  return (
    <tr className="border-t border-rule first:border-0">
      <td className="py-1.5 pr-2 text-ink-2">{label}</td>
      <td className="py-1.5 pl-2 text-right tabular-nums text-ink-3">{a}</td>
      <td className="py-1.5 pl-2 text-right tabular-nums">{b}</td>
      <td className={`py-1.5 pl-3 text-right text-[13px] ${better ? 'text-keep' : ''}`}>{delta(a, b)}</td>
    </tr>
  );
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[10px] border border-rule bg-paper p-4">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {note && <p className="mb-3 mt-0.5 text-[12.5px] text-ink-3">{note}</p>}
      {children}
    </section>
  );
}
