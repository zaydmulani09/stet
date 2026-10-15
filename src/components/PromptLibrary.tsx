'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { LIBRARY, SOURCES } from '@/lib/prompt-library';
import { ESSAY_TYPES } from '@/lib/rubric';

export function PromptLibrary() {
  const [q, setQ] = useState('');
  const [source, setSource] = useState<string>('all');
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return LIBRARY.filter((p) => (source === 'all' || p.source === source) && (!needle || `${p.title} ${p.text} ${p.source}`.toLowerCase().includes(needle)));
  }, [q, source]);
  const groups = SOURCES.filter((s) => list.some((p) => p.source === s));

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
          <label htmlFor="pq" className="sr-only">Search prompts</label>
          <input id="pq" className="field pl-9" placeholder="Search prompts, e.g. community or engineering" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label htmlFor="ps" className="sr-only">Source</label>
        <select id="ps" className="field w-auto" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="all">All sources ({LIBRARY.length})</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {groups.length === 0 && <p className="mt-8 text-ink-2">No prompts match. You can still paste any prompt when you create an essay.</p>}

      {groups.map((s) => {
        const items = list.filter((p) => p.source === s);
        const first = items[0];
        return (
          <section key={s} className="mt-10" aria-labelledby={`src-${first.id}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule pb-2">
              <h2 id={`src-${first.id}`} className="text-[18px] font-semibold">{s}</h2>
              <p className="text-[12.5px] text-ink-3">
                {first.cycle ? `Labelled ${first.cycle}` : 'No cycle label on the page'} ·{' '}
                <a href={first.url} target="_blank" rel="noreferrer" className="text-ink-3">official source</a> · checked {first.checked}
              </p>
            </div>
            <ul>
              {items.map((p) => (
                <li key={p.id} className="grid gap-2 border-b border-rule py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6">
                  <div>
                    <h3 className="text-[15px] font-semibold">{p.title}</h3>
                    <p className="quote mt-1 max-w-[72ch] text-ink-2">{p.text}</p>
                    <p className="mt-1.5 text-[12.5px] text-ink-3">
                      {ESSAY_TYPES[p.type]}
                      {p.wordLimit ? ` · ${p.minWords ? `${p.minWords}–` : 'up to '}${p.wordLimit} words` : ''}
                      {p.charLimit ? ` · up to ${p.charLimit} characters` : ''}
                      {!p.wordLimit && !p.charLimit ? ' · no fixed limit' : ''}
                      {p.note ? ` · ${p.note}` : ''}
                    </p>
                  </div>
                  <div className="self-start">
                    <Link href={`/new?prompt=${p.id}`} className="btn btn-sm no-underline">Write this essay</Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
