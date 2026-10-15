'use client';

import type { ReactNode } from 'react';
import type { Anchor } from '@/lib/anchor';

export type ItemState = 'ok' | 'edited' | 'stale';

/** The quoted passage an item refers to. Clicking jumps to it in the essay. */
export function QuoteButton({ anchor, state, onJump, tone = 'neutral' }: { anchor: Anchor; state: ItemState; onJump: () => void; tone?: 'neutral' | 'keep' }) {
  const text = anchor.quote.length > 240 ? `${anchor.quote.slice(0, 240)}…` : anchor.quote;
  if (state !== 'ok')
    return (
      <div className="mt-2 rounded-md border border-dashed border-rule-strong px-3 py-2">
        <p className="quote text-ink-3 line-through decoration-ink-3/50">{text}</p>
        <p className="mt-1 text-[12.5px] text-ink-3">
          {state === 'edited' ? 'You changed this passage since the review.' : 'This passage is no longer in the draft.'}
        </p>
      </div>
    );
  return (
    <button
      type="button"
      onClick={onJump}
      className={`quote mt-2 block w-full rounded-md border border-transparent px-3 py-2 text-left text-ink hover:border-rule-strong ${tone === 'keep' ? 'bg-keep-wash' : 'bg-desk'}`}
      title="Show in essay"
    >
      &ldquo;{text}&rdquo;
    </button>
  );
}

export function Section({ title, children, aside, id }: { title: string; children: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <section className="border-t border-rule px-5 py-5 first:border-t-0" aria-labelledby={id}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 id={id} className="text-[15px] font-semibold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-[14px] leading-relaxed text-ink-2">{children}</p>;
}

export const SEVERITY_LABEL = { high: 'High priority', medium: 'Medium', low: 'Polish' } as const;
export const SEVERITY_TEXT = { high: 'text-high', medium: 'text-medium', low: 'text-ink-2' } as const;
