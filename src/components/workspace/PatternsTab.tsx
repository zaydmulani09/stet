'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Analysis } from '@/lib/analysis';
import { PATTERNS, type VoiceResult } from '@/lib/types';
import { Empty, QuoteButton, Section, type ItemState } from './shared';

interface Props {
  analysis: Analysis; // computed live from the current text
  voice: VoiceResult | null;
  stateOf: (id: string) => ItemState;
  onJump: (id: string) => void;
  activeId: string | null;
}

export const measureId = (kind: string, start: number) => `m:${kind}:${start}`;

export function PatternsTab({ analysis: a, voice, stateOf, onJump, activeId }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const flagged = a.groups.filter((g) => g.flagged);
  const other = a.groups.filter((g) => !g.flagged);
  return (
    <div>
      <div className="border-b border-rule bg-desk px-5 py-4 text-[13.5px] leading-relaxed text-ink-2">
        <p>
          <span className="font-semibold text-ink">A pattern check, not an AI detector.</span> These are observable features that can make writing
          read as formulaic. Human writers produce every one of them, and nothing here says who wrote this essay. No tool can determine that
          reliably from text alone.{' '}
          <Link href="/method#patterns" className="text-ink-2">Why Stet does not give an AI score</Link>
        </p>
      </div>

      <Section title="Measured in your draft" aside={<span className="text-[12.5px] text-ink-3">updates as you type</span>}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[14px] sm:grid-cols-3">
          <Stat label="Words" value={a.words} />
          <Stat label="Sentences" value={a.sentenceCount} />
          <Stat label="Avg. sentence" value={`${a.avgSentenceWords} words`} />
          <Stat label="Length variation" value={a.sentenceLengthCv.toFixed(2)} hint={a.rhythmFlagged ? 'very even' : undefined} />
          <Stat label="Longest sentence" value={a.longestSentence ? `${a.longestSentence.words} words` : '–'} />
          <Stat label='Sentences starting "I"' value={`${Math.round(a.iStartShare * 100)}%`} />
        </dl>
        {a.rhythmFlagged && (
          <p className="mt-3 text-[13.5px] text-ink-2">
            Sentence lengths are unusually even (variation {a.sentenceLengthCv.toFixed(2)}). Even rhythm can feel mechanical; mixing a short sentence
            into a run of long ones is the usual fix. This threshold is a rule of thumb, not a validated cut-off.
          </p>
        )}
        <div className="mt-5 grid gap-1">
          {flagged.length === 0 && <Empty>No stock phrases, formula openings, connector runs or repeated openings found.</Empty>}
          {[...flagged, ...other].map((g) => {
            const isOpen = open === g.kind;
            return (
              <div key={g.kind} className="-mx-2 rounded-lg px-2">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 py-2 text-left text-[14px]"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : g.kind)}
                >
                  <span className={`mark ${g.flagged ? 'mark-pattern' : 'mark-low'}`} aria-hidden />
                  <span className={`flex-1 ${g.flagged ? 'font-semibold' : 'text-ink-2'}`}>{g.label}</span>
                  <span className="text-[13px] text-ink-3">{g.count}</span>
                  <ChevronDown size={15} className={`text-ink-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
                </button>
                {isOpen && (
                  <div className="pb-3 pl-[17px] text-[13.5px]">
                    <p className="leading-relaxed text-ink-2">{g.explanation}</p>
                    <p className="mt-1 leading-relaxed"><span className="font-semibold">Try: </span>{g.suggestion}</p>
                    {!g.flagged && <p className="mt-1 text-ink-3">Below the level Stet flags; shown for completeness.</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {g.items.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => onJump(measureId(m.kind, m.start))}
                          className={`quote rounded border border-rule px-2 py-0.5 text-[13.5px] hover:border-rule-strong ${activeId === measureId(m.kind, m.start) ? 'bg-pencil-wash' : 'bg-paper'}`}
                        >
                          {m.text.length > 50 ? `${m.text.slice(0, 50)}…` : m.text}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Reader's observations" aside={<span className="text-[12.5px] text-ink-3">from your last review</span>}>
        {!voice && <Empty>Run a review to add an editor&rsquo;s read of patterns in context.</Empty>}
        {voice && voice.patterns.length === 0 && !voice.shift.detected && <Empty>No formulaic patterns stood out to the reader.</Empty>}
        <ul className="grid gap-5">
          {voice?.patterns.map((x) => (
            <li key={x.id} id={`item-${x.id}`} className={`-mx-2 rounded-lg px-2 py-1 text-[14px] ${activeId === x.id ? 'bg-pencil-wash/60' : ''}`}>
              <p className="text-[12.5px] font-semibold text-pattern">{PATTERNS[x.pattern]}</p>
              <QuoteButton anchor={x.anchor} state={stateOf(x.id)} onJump={() => onJump(x.id)} />
              <p className="mt-1.5 leading-relaxed">{x.observation}</p>
              <p className="mt-1 leading-relaxed text-ink-2">{x.why}</p>
              <p className="mt-1 leading-relaxed"><span className="font-semibold">Try: </span>{x.suggestion}</p>
            </li>
          ))}
          {voice?.shift.detected && voice.shift.anchor && (
            <li id="item-shift" className="text-[14px]">
              <p className="text-[12.5px] font-semibold text-pattern">Change in style</p>
              <QuoteButton anchor={voice.shift.anchor} state={stateOf('shift')} onJump={() => onJump('shift')} />
              <p className="mt-1.5 leading-relaxed text-ink-2">{voice.shift.explanation}</p>
              <p className="mt-1 leading-relaxed text-ink-2">
                A shift in style partway through can happen when parts were written at different times or edited heavily. Reading the draft aloud
                in one sitting is the quickest way to even it out.
              </p>
            </li>
          )}
        </ul>
      </Section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div>
      <dt className="text-[12.5px] text-ink-3">{label}</dt>
      <dd className="font-semibold">
        {value}
        {hint && <span className="ml-1.5 text-[12.5px] font-normal text-pattern">{hint}</span>}
      </dd>
    </div>
  );
}
