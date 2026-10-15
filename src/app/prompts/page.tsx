import type { Metadata } from 'next';
import { TopBar } from '@/components/TopBar';
import { PromptLibrary } from '@/components/PromptLibrary';
import { currentUser } from '@/lib/session';

export const metadata: Metadata = {
  title: '2026–27 essay prompts',
  description: 'The 2026–27 Common App prompts, UC Personal Insight Questions and college supplements, copied from official pages with source links.',
};

export default async function PromptsPage() {
  const user = await currentUser();
  return (
    <>
      <TopBar active="/prompts" signedIn={Boolean(user?.email)} />
      <main className="mx-auto w-full max-w-[980px] px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
        <h1 className="font-serif text-[30px] font-semibold leading-tight">Prompts for the 2026–27 cycle</h1>
        <p className="mt-2 max-w-[66ch] text-ink-2">
          Every prompt here was copied from the institution&rsquo;s own page and checked on the date shown. Colleges change supplements between cycles,
          so confirm the wording in your application portal. For any prompt not listed, paste it when you create an essay.
        </p>
        <PromptLibrary />
      </main>
    </>
  );
}
