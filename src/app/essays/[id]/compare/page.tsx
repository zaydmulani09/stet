import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { TopBar } from '@/components/TopBar';
import { Compare, type Side } from '@/components/Compare';
import { getEssay, getVersion, listVersions, reviewForVersion } from '@/lib/essays';
import { HttpError, uuid } from '@/lib/http';
import { currentUser } from '@/lib/session';
import type { StoredReview } from '@/lib/types';

export const metadata: Metadata = { title: 'Compare drafts', robots: { index: false } };

async function load(userId: string, id: string, a: unknown, b: unknown) {
  const essay = await getEssay(userId, id);
  const versions = await listVersions(userId, id);
  const aId = typeof a === 'string' && uuid.safeParse(a).success ? a : versions.find((v) => v.has_review)?.id ?? versions[0]?.id;
  const bId = typeof b === 'string' && uuid.safeParse(b).success ? b : 'current';
  if (!aId) return { essay, versions, sides: null };
  const side = async (vid: string): Promise<Side> => {
    if (vid === 'current') return { id: 'current', label: 'Current draft', content: essay.content, at: new Date(essay.updated_at).toISOString(), review: null, reviewId: null };
    const v = await getVersion(userId, id, vid);
    const r = await reviewForVersion(userId, id, vid);
    return {
      id: v.id,
      label: v.label ?? (v.kind === 'review' ? 'Reviewed draft' : v.kind === 'auto' ? 'Autosave checkpoint' : 'Saved version'),
      content: v.content,
      at: new Date(v.created_at).toISOString(),
      review: (r?.result as StoredReview | undefined) ?? null,
      reviewId: r?.id ?? null,
    };
  };
  return { essay, versions, sides: await Promise.all([side(aId), side(bId)]) };
}

export default async function ComparePage({ params, searchParams }: PageProps<'/essays/[id]/compare'>) {
  const { id } = await params;
  const sp = await searchParams;
  if (!uuid.safeParse(id).success) notFound();
  const user = await currentUser();
  if (!user) redirect('/');
  let data: Awaited<ReturnType<typeof load>>;
  try {
    data = await load(user.id, id, sp.a, sp.b);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
  const { essay, versions, sides } = data;
  return (
    <>
      <TopBar signedIn={Boolean(user.email)} />
      {sides ? (
        <Compare
          essayId={id}
          title={essay.title}
          rev={essay.rev}
          a={sides[0]}
          b={sides[1]}
          versions={versions.map((v) => ({ id: v.id, label: v.label, kind: v.kind, at: new Date(v.created_at).toISOString(), words: v.word_count }))}
        />
      ) : (
        <main className="mx-auto max-w-[760px] px-4 py-12 text-ink-2">There are no earlier drafts of this essay to compare yet.</main>
      )}
    </>
  );
}
