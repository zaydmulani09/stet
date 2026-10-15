import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Workspace, type EssayDTO } from '@/components/workspace/Workspace';
import { getEssay, getVersion, latestReview } from '@/lib/essays';
import { HttpError, uuid } from '@/lib/http';
import { currentUser } from '@/lib/session';
import { toPayload } from '@/lib/service';
import type { EssayType } from '@/lib/rubric';

export const metadata: Metadata = { title: 'Essay', robots: { index: false } };

export default async function EssayPage({ params }: PageProps<'/essays/[id]'>) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const user = await currentUser();
  if (!user) redirect('/');
  let essay;
  try {
    essay = await getEssay(user.id, id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
  const row = await latestReview(user.id, id);
  const review = row ? toPayload(row, await getVersion(user.id, id, row.version_id)) : null;
  const dto: EssayDTO = {
    id: essay.id,
    title: essay.title,
    essay_type: essay.essay_type as EssayType,
    prompt_id: essay.prompt_id,
    prompt_text: essay.prompt_text,
    word_limit: essay.word_limit,
    min_words: essay.min_words,
    char_limit: essay.char_limit,
    college: essay.college,
    cycle: essay.cycle,
    intent: essay.intent,
    content: essay.content,
    rev: essay.rev,
    is_sample: essay.is_sample,
    updated_at: new Date(essay.updated_at).toISOString(),
  };
  return <Workspace essay={dto} initialReview={review} signedIn={Boolean(user.email)} />;
}
