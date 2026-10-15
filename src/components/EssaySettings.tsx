'use client';

import { LIBRARY, LIBRARY_BY_ID, SOURCES, type LibraryPrompt } from '@/lib/prompt-library';
import { ESSAY_TYPES, ESSAY_TYPE_KEYS, type EssayType } from '@/lib/rubric';

export interface SettingsValue {
  title: string;
  essay_type: EssayType;
  prompt_id: string | null;
  prompt_text: string | null;
  word_limit: number | null;
  min_words: number | null;
  char_limit: number | null;
  college: string | null;
  cycle: string | null;
  intent: string | null;
}

export function settingsFromPrompt(p: LibraryPrompt, prev: SettingsValue): SettingsValue {
  return {
    ...prev,
    prompt_id: p.id,
    prompt_text: null,
    essay_type: p.type,
    word_limit: p.wordLimit,
    min_words: p.minWords,
    char_limit: p.charLimit,
    college: prev.college ?? (p.source === 'Common App' || p.source === 'University of California' ? prev.college : p.source),
    title: prev.title || `${p.source}: ${p.title}`,
  };
}

const num = (v: string) => (v.trim() === '' ? null : Math.max(1, Math.min(20000, Math.round(Number(v)))) || null);

/** Prompt, type, limits and context. Shared by the new-essay page and the workspace. */
export function EssaySettings({ value, onChange, showTitle = true }: { value: SettingsValue; onChange: (v: SettingsValue) => void; showTitle?: boolean }) {
  const mode = value.prompt_id ? 'library' : value.prompt_text !== null ? 'custom' : 'none';
  const lib = value.prompt_id ? LIBRARY_BY_ID.get(value.prompt_id) : null;
  const set = (patch: Partial<SettingsValue>) => onChange({ ...value, ...patch });

  return (
    <div className="grid gap-5">
      {showTitle && (
        <div>
          <label className="label" htmlFor="s-title">Title</label>
          <input id="s-title" className="field" value={value.title} maxLength={200} placeholder="e.g. Common App draft 2" onChange={(e) => set({ title: e.target.value })} />
        </div>
      )}

      <fieldset>
        <legend className="label">Prompt</legend>
        <div className="flex flex-wrap gap-1.5" role="radiogroup">
          {(
            [
              ['library', 'From the library'],
              ['custom', 'Paste a prompt'],
              ['none', 'No prompt'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              className={`btn btn-sm ${mode === m ? 'border-pencil bg-pencil-wash text-ink' : ''}`}
              onClick={() => {
                if (m === 'library') set(settingsFromPrompt(LIBRARY[0], value));
                if (m === 'custom') set({ prompt_id: null, prompt_text: value.prompt_text ?? '' });
                if (m === 'none') set({ prompt_id: null, prompt_text: null });
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'library' && (
          <div className="mt-3">
            <label className="sr-only" htmlFor="s-prompt">Library prompt</label>
            <select
              id="s-prompt"
              className="field"
              value={value.prompt_id ?? ''}
              onChange={(e) => {
                const p = LIBRARY_BY_ID.get(e.target.value);
                if (p) onChange(settingsFromPrompt(p, { ...value, title: value.title && !value.title.includes(': ') ? value.title : '' , college: null }));
              }}
            >
              {SOURCES.map((s) => (
                <optgroup key={s} label={s}>
                  {LIBRARY.filter((p) => p.source === s).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                      {p.wordLimit ? ` (${p.wordLimit} words)` : p.charLimit ? ` (${p.charLimit} characters)` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {lib && (
              <div className="mt-2 rounded-md border border-rule bg-desk/60 p-3">
                <p className="quote text-ink">{lib.text}</p>
                <p className="mt-2 text-[12.5px] text-ink-3">
                  {lib.source}
                  {lib.cycle ? `, ${lib.cycle} cycle` : ''}. Wording checked against{' '}
                  <a href={lib.url} target="_blank" rel="noreferrer" className="text-ink-3">the official page</a> on {lib.checked}.
                  {lib.note ? ` ${lib.note}` : ''}
                </p>
              </div>
            )}
          </div>
        )}

        {mode === 'custom' && (
          <div className="mt-3">
            <label className="sr-only" htmlFor="s-ptext">Prompt text</label>
            <textarea
              id="s-ptext"
              className="field"
              rows={3}
              maxLength={3000}
              placeholder="Paste the exact prompt from the application"
              value={value.prompt_text ?? ''}
              onChange={(e) => set({ prompt_text: e.target.value })}
            />
          </div>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <label className="label" htmlFor="s-type">Essay type</label>
          <select id="s-type" className="field" value={value.essay_type} onChange={(e) => set({ essay_type: e.target.value as EssayType })}>
            {ESSAY_TYPE_KEYS.map((k) => (
              <option key={k} value={k}>{ESSAY_TYPES[k]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="s-wl">Word limit</label>
          <input id="s-wl" className="field" inputMode="numeric" placeholder="none" value={value.word_limit ?? ''} onChange={(e) => set({ word_limit: num(e.target.value) })} />
        </div>
        <div>
          <label className="label" htmlFor="s-cl">Character limit</label>
          <input id="s-cl" className="field" inputMode="numeric" placeholder="none" value={value.char_limit ?? ''} onChange={(e) => set({ char_limit: num(e.target.value) })} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <label className="label" htmlFor="s-college">College or program <span className="font-normal text-ink-3">(optional)</span></label>
          <input id="s-college" className="field" maxLength={200} value={value.college ?? ''} onChange={(e) => set({ college: e.target.value || null })} />
        </div>
        <div>
          <label className="label" htmlFor="s-cycle">Cycle</label>
          <input id="s-cycle" className="field" maxLength={40} value={value.cycle ?? ''} onChange={(e) => set({ cycle: e.target.value || null })} />
        </div>
        <div>
          <label className="label" htmlFor="s-min">Minimum words</label>
          <input id="s-min" className="field" inputMode="numeric" placeholder="none" value={value.min_words ?? ''} onChange={(e) => set({ min_words: num(e.target.value) })} />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="s-intent">What should a reader understand about you? <span className="font-normal text-ink-3">(optional, helps the review)</span></label>
        <textarea id="s-intent" className="field" rows={2} maxLength={600} placeholder="e.g. That I teach myself things and people rely on me." value={value.intent ?? ''} onChange={(e) => set({ intent: e.target.value || null })} />
      </div>
    </div>
  );
}
