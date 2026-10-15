import type { Metadata } from 'next';
import { TopBar } from '@/components/TopBar';
import { NewEssayForm } from '@/components/NewEssayForm';
import { currentUser } from '@/lib/session';
import { LIBRARY_BY_ID } from '@/lib/prompt-library';

export const metadata: Metadata = { title: 'New essay' };

export default async function NewEssay({ searchParams }: PageProps<'/new'>) {
  const user = await currentUser();
  const sp = await searchParams;
  const promptId = typeof sp.prompt === 'string' && LIBRARY_BY_ID.has(sp.prompt) ? sp.prompt : null;
  return (
    <>
      <TopBar signedIn={Boolean(user?.email)} />
      <main className="mx-auto w-full max-w-[760px] px-4 pb-24 pt-8 sm:px-6 sm:pt-10">
        <h1 className="font-serif text-[28px] font-semibold">New essay</h1>
        <p className="mt-1.5 text-ink-2">Choose the prompt so the review can check that you answer it. You can change everything later.</p>
        <NewEssayForm promptId={promptId} />
      </main>
    </>
  );
}
