'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '@/lib/client';

export function OpenSampleButton({ className, label }: { className: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const { essay } = await api<{ essay: { id: string } }>('/api/essays', { body: { sample: true } });
            router.push(`/essays/${essay.id}`);
          } catch (e) {
            setError(e instanceof ApiError ? e.message : 'Could not open the sample.');
            setBusy(false);
          }
        }}
      >
        {busy ? 'Opening…' : label}
      </button>
      {error && <p role="alert" className="w-full text-[13px] text-high">{error}</p>}
    </>
  );
}
