'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EssaySettings, settingsFromPrompt, type SettingsValue } from './EssaySettings';
import { api, ApiError } from '@/lib/client';
import { LIBRARY_BY_ID } from '@/lib/prompt-library';
import { countWords } from '@/lib/text';

const EMPTY: SettingsValue = {
  title: '', essay_type: 'personal_statement', prompt_id: null, prompt_text: null, word_limit: null, min_words: null, char_limit: null,
  college: null, cycle: '2026–27', intent: null,
};

export function NewEssayForm({ promptId }: { promptId: string | null }) {
  const router = useRouter();
  const [settings, setSettings] = useState<SettingsValue>(() =>
    settingsFromPrompt(LIBRARY_BY_ID.get(promptId ?? 'ca-7')!, { ...EMPTY }),
  );
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-8 grid gap-7"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const { essay } = await api<{ essay: { id: string } }>('/api/essays', {
            body: { ...settings, title: settings.title || 'Untitled essay', prompt_text: settings.prompt_id ? null : settings.prompt_text?.trim() || null, content },
          });
          router.push(`/essays/${essay.id}`);
        } catch (err) {
          setError(err instanceof ApiError ? err.message : 'Could not create the essay.');
          setBusy(false);
        }
      }}
    >
      <EssaySettings value={settings} onChange={setSettings} />
      <div>
        <label className="label" htmlFor="n-content">
          Your draft <span className="font-normal text-ink-3">(optional; paste now or write in the editor)</span>
        </label>
        <textarea
          id="n-content"
          className="field essay-text"
          style={{ fontSize: 16.5 }}
          rows={10}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste your essay here. Plain text is fine; formatting is not used by application portals."
        />
        <p className="mt-1.5 text-[13px] text-ink-3">{countWords(content)} words</p>
      </div>
      {error && <p role="alert" className="text-[14px] text-high">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create essay'}</button>
      </div>
    </form>
  );
}
