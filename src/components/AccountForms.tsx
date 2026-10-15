'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '@/lib/client';

type State = 'anonymous' | 'guest' | 'member';

export function AccountForms({ state }: { state: State }) {
  const router = useRouter();
  const [mode, setMode] = useState<'signup' | 'login'>(state === 'guest' ? 'signup' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ moved?: number }>(`/api/auth/${mode}`, { body: { email, password } });
      setMsg({ tone: 'ok', text: mode === 'signup' ? 'Account saved. Your essays are now tied to this email.' : r.moved ? `Signed in. ${r.moved} essay${r.moved === 1 ? '' : 's'} from this browser moved into your account.` : 'Signed in.' });
      setPassword('');
      router.refresh();
    } catch (err) {
      setMsg({ tone: 'err', text: err instanceof ApiError ? err.message : 'Something went wrong.' });
    }
    setBusy(false);
  };

  return (
    <div className="mt-8 grid gap-8">
      {state !== 'member' && (
        <section className="rounded-[10px] border border-rule bg-paper p-5">
          <div className="mb-4 flex gap-1.5" role="tablist">
            {(['signup', 'login'] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} className={`btn btn-sm ${mode === m ? 'border-pencil bg-pencil-wash' : ''}`} onClick={() => setMode(m)}>
                {m === 'signup' ? (state === 'guest' ? 'Save my essays' : 'Create account') : 'Sign in'}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="grid gap-4">
            <div>
              <label className="label" htmlFor="a-email">Email</label>
              <input id="a-email" className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="a-pw">Password <span className="font-normal text-ink-3">(at least 10 characters)</span></label>
              <input id="a-pw" className="field" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={10} required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {msg && <p role={msg.tone === 'err' ? 'alert' : 'status'} className={`text-[14px] ${msg.tone === 'err' ? 'text-high' : 'text-keep'}`}>{msg.text}</p>}
            <div>
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Working…' : mode === 'signup' ? 'Save account' : 'Sign in'}</button>
            </div>
            {mode === 'login' && state === 'guest' && <p className="text-[13px] text-ink-3">Essays you wrote as a guest in this browser will move into the account you sign in to.</p>}
          </form>
        </section>
      )}

      {state !== 'anonymous' && (
        <section className="grid gap-5">
          <div>
            <h2 className="text-[16px] font-semibold">Your data</h2>
            <p className="mt-1 text-[14px] text-ink-2">Download every essay, version and review as JSON.</p>
            <a href="/api/export" className="btn mt-3 no-underline">Export everything</a>
          </div>
          {state === 'member' && (
            <div>
              <h2 className="text-[16px] font-semibold">Sign out</h2>
              <button
                type="button"
                className="btn mt-2"
                onClick={async () => {
                  await api('/api/auth/logout', { body: {} }).catch(() => undefined);
                  router.push('/');
                  router.refresh();
                }}
              >
                Sign out
              </button>
            </div>
          )}
          <div className="rounded-[10px] border border-high/40 p-4">
            <h2 className="text-[16px] font-semibold text-high">Delete account</h2>
            <p className="mt-1 text-[14px] text-ink-2">Permanently deletes your account and every essay, version and review. This cannot be undone.</p>
            <label className="label mt-3" htmlFor="del">Type DELETE to confirm</label>
            <div className="flex gap-2">
              <input id="del" className="field max-w-[200px]" value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} />
              <button
                type="button"
                className="btn btn-danger"
                disabled={confirmDelete !== 'DELETE'}
                onClick={async () => {
                  try {
                    await api('/api/account', { method: 'DELETE' });
                    router.push('/');
                    router.refresh();
                  } catch (err) {
                    setMsg({ tone: 'err', text: err instanceof ApiError ? err.message : 'Could not delete.' });
                  }
                }}
              >
                Delete everything
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
