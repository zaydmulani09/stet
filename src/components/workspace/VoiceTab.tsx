'use client';

import type { VoiceResult } from '@/lib/types';
import { VOICE_SIGNALS } from '@/lib/types';
import { Empty, QuoteButton, Section, type ItemState } from './shared';

export function VoiceTab({ voice, error, stateOf, onJump, activeId }: { voice: VoiceResult | null; error?: string; stateOf: (id: string) => ItemState; onJump: (id: string) => void; activeId: string | null }) {
  if (!voice) return <div className="p-5"><Empty>The voice read did not complete{error ? `: ${error}` : ''}. Run the review again.</Empty></div>;
  return (
    <div>
      <Section title="Your voice">
        <p className="text-[15px] leading-relaxed">{voice.summary}</p>
      </Section>
      <Section title="Sounds like you" aside={<span className="flex items-center gap-1.5 text-[12.5px] text-keep"><span className="mark mark-keep" aria-hidden />keep these</span>}>
        {voice.keep.length === 0 && <Empty>No passages singled out.</Empty>}
        <ul className="grid gap-4">
          {voice.keep.map((k) => (
            <li key={k.id} id={`item-${k.id}`} className={`-mx-2 rounded-lg px-2 py-1 text-[14px] ${activeId === k.id ? 'bg-pencil-wash/60' : ''}`}>
              <QuoteButton anchor={k.anchor} state={stateOf(k.id)} onJump={() => onJump(k.id)} tone="keep" />
              <p className="mt-1.5 leading-relaxed text-ink-2">{k.why}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12.5px] text-ink-3">Protect these when you revise. Distinctive does not mean fancy; plain, specific words often carry a voice best.</p>
      </Section>
      <Section title="Reads as generic" aside={<span className="flex items-center gap-1.5 text-[12.5px] text-pattern"><span className="mark mark-pattern" aria-hidden />could be anyone&rsquo;s</span>}>
        {voice.generic.length === 0 && <Empty>Nothing here: the draft stays specific throughout.</Empty>}
        <ul className="grid gap-5">
          {voice.generic.map((g) => (
            <li key={g.id} id={`item-${g.id}`} className={`-mx-2 rounded-lg px-2 py-1 text-[14px] ${activeId === g.id ? 'bg-pencil-wash/60' : ''}`}>
              <p className="text-[12.5px] font-semibold text-pattern">{VOICE_SIGNALS[g.signal]}</p>
              <QuoteButton anchor={g.anchor} state={stateOf(g.id)} onJump={() => onJump(g.id)} />
              <p className="mt-1.5 leading-relaxed text-ink-2">{g.why}</p>
              <p className="mt-1 leading-relaxed"><span className="font-semibold">Try: </span>{g.suggestion}</p>
              {g.question && <p className="mt-1 italic leading-relaxed text-ink-2">{g.question}</p>}
            </li>
          ))}
        </ul>
      </Section>
      <p className="border-t border-rule px-5 py-4 text-[12.5px] text-ink-3">
        Read by {voice.model}. This judges how the writing reads, not who wrote it. Dialect, non-native English and unusual sentences are not treated as problems.
      </p>
    </div>
  );
}
