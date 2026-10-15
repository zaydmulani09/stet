import { q, q1 } from './db';
import { HttpError, notFound } from './http';
import { countWords } from './text';

// Every read and write is scoped by user_id in SQL. There is no code path that loads an
// essay, version or review by id alone.

export interface Essay {
  id: string;
  user_id: string;
  title: string;
  essay_type: string;
  prompt_id: string | null;
  prompt_text: string | null;
  word_limit: number | null;
  min_words: number | null;
  char_limit: number | null;
  college: string | null;
  cycle: string | null;
  intent: string | null;
  content: string;
  rev: number;
  is_sample: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Version {
  id: string;
  essay_id: string;
  content: string;
  word_count: number;
  kind: 'manual' | 'review' | 'auto' | 'restore';
  label: string | null;
  created_at: Date;
}

export interface ReviewRow {
  id: string;
  essay_id: string;
  version_id: string;
  result: unknown;
  item_status: Record<string, string>;
  created_at: Date;
}

type FieldKey = 'title' | 'essay_type' | 'prompt_id' | 'prompt_text' | 'word_limit' | 'min_words' | 'char_limit' | 'college' | 'cycle' | 'intent';
export type EssayFields = { [K in FieldKey]?: Essay[K] | null };

export async function listEssays(userId: string) {
  return q<Pick<Essay, 'id' | 'title' | 'essay_type' | 'prompt_id' | 'prompt_text' | 'word_limit' | 'char_limit' | 'is_sample' | 'updated_at' | 'created_at'> & {
    words: number; review_at: Date | null; review_result: unknown; item_status: Record<string, string> | null; reviewed_rev_match: boolean;
  }>`
    select e.id, e.title, e.essay_type, e.prompt_id, e.prompt_text, e.word_limit, e.char_limit, e.is_sample,
           e.updated_at, e.created_at,
           (select count(*) from regexp_split_to_table(e.content, '\\s+') t where t ~ '[[:alnum:]]')::int as words,
           r.created_at as review_at, r.result as review_result, r.item_status,
           coalesce(v.content = e.content, false) as reviewed_rev_match
    from stet.essays e
    left join lateral (
      select * from stet.reviews r where r.essay_id = e.id order by r.created_at desc limit 1
    ) r on true
    left join stet.versions v on v.id = r.version_id
    where e.user_id = ${userId}
    order by e.updated_at desc
    limit 200`;
}

export async function createEssay(userId: string, f: EssayFields & { content?: string; is_sample?: boolean }): Promise<Essay> {
  return (await q1<Essay>`
    insert into stet.essays (user_id, title, essay_type, prompt_id, prompt_text, word_limit, min_words, char_limit, college, cycle, intent, content, is_sample)
    values (${userId}, ${f.title?.trim() || 'Untitled essay'}, ${f.essay_type ?? 'personal_statement'}, ${f.prompt_id ?? null},
            ${f.prompt_text ?? null}, ${f.word_limit ?? null}, ${f.min_words ?? null}, ${f.char_limit ?? null}, ${f.college ?? null},
            ${f.cycle ?? null}, ${f.intent ?? null}, ${f.content ?? ''}, ${f.is_sample ?? false})
    returning *`)!;
}

export async function getEssay(userId: string, id: string): Promise<Essay> {
  const e = await q1<Essay>`select * from stet.essays where id = ${id} and user_id = ${userId}`;
  if (!e) throw notFound();
  return e;
}

/** Partial metadata update: a column changes only when its key is present in `f`. */
export async function updateFields(userId: string, id: string, f: EssayFields): Promise<Essay> {
  const has = (k: keyof EssayFields) => k in f;
  const e = await q1<Essay>`
    update stet.essays set
      title       = case when ${has('title')}::boolean then coalesce(nullif(trim(${f.title ?? null}::text), ''), 'Untitled essay') else title end,
      essay_type  = case when ${has('essay_type')}::boolean then coalesce(${f.essay_type ?? null}::text, essay_type) else essay_type end,
      prompt_id   = case when ${has('prompt_id')}::boolean then ${f.prompt_id ?? null}::text else prompt_id end,
      prompt_text = case when ${has('prompt_text')}::boolean then ${f.prompt_text ?? null}::text else prompt_text end,
      word_limit  = case when ${has('word_limit')}::boolean then ${f.word_limit ?? null}::int else word_limit end,
      min_words   = case when ${has('min_words')}::boolean then ${f.min_words ?? null}::int else min_words end,
      char_limit  = case when ${has('char_limit')}::boolean then ${f.char_limit ?? null}::int else char_limit end,
      college     = case when ${has('college')}::boolean then ${f.college ?? null}::text else college end,
      cycle       = case when ${has('cycle')}::boolean then ${f.cycle ?? null}::text else cycle end,
      intent      = case when ${has('intent')}::boolean then ${f.intent ?? null}::text else intent end,
      updated_at  = now()
    where id = ${id} and user_id = ${userId}
    returning *`;
  if (!e) throw notFound();
  return e;
}

const AUTO_VERSION_MINUTES = 20;
const MAX_AUTO_VERSIONS = 40;

/**
 * Save essay text with optimistic concurrency: the write applies only if the caller saw the
 * current revision. A stale tab gets a 409 with the server copy instead of silently overwriting.
 */
export async function saveContent(userId: string, id: string, content: string, baseRev: number): Promise<{ rev: number; updated_at: Date }> {
  const row = await q1<{ rev: number; updated_at: Date }>`
    update stet.essays set content = ${content}, rev = rev + 1, updated_at = now()
    where id = ${id} and user_id = ${userId} and rev = ${baseRev}
    returning rev, updated_at`;
  if (!row) {
    const cur = await q1<Pick<Essay, 'rev' | 'content'>>`select rev, content from stet.essays where id = ${id} and user_id = ${userId}`;
    if (!cur) throw notFound();
    throw new HttpError(409, 'conflict', 'This essay was changed in another tab or device.', { rev: cur.rev, content: cur.content });
  }
  await autoVersion(id, content);
  return row;
}

/** Checkpoint history: one automatic version per 20 minutes of editing, newest 40 kept. */
async function autoVersion(essayId: string, content: string) {
  if (!content.trim()) return;
  const last = await q1<{ content: string; created_at: Date }>`
    select content, created_at from stet.versions where essay_id = ${essayId} order by created_at desc limit 1`;
  if (last && (last.content === content || Date.now() - new Date(last.created_at).getTime() < AUTO_VERSION_MINUTES * 60_000)) return;
  await q`insert into stet.versions (essay_id, content, word_count, kind) values (${essayId}, ${content}, ${countWords(content)}, 'auto')`;
  await q`
    delete from stet.versions where id in (
      select id from stet.versions where essay_id = ${essayId} and kind = 'auto'
      order by created_at desc offset ${MAX_AUTO_VERSIONS})
      and not exists (select 1 from stet.reviews r where r.version_id = stet.versions.id)`;
}

export async function deleteEssay(userId: string, id: string) {
  const rows = await q`delete from stet.essays where id = ${id} and user_id = ${userId} returning id`;
  if (!rows.length) throw notFound();
}

export async function listVersions(userId: string, essayId: string) {
  await getEssay(userId, essayId);
  return q<Omit<Version, 'content'> & { has_review: boolean }>`
    select v.id, v.essay_id, v.word_count, v.kind, v.label, v.created_at,
           exists (select 1 from stet.reviews r where r.version_id = v.id) as has_review
    from stet.versions v where v.essay_id = ${essayId} order by v.created_at desc limit 200`;
}

export async function getVersion(userId: string, essayId: string, versionId: string): Promise<Version> {
  const v = await q1<Version>`
    select v.* from stet.versions v join stet.essays e on e.id = v.essay_id
    where v.id = ${versionId} and v.essay_id = ${essayId} and e.user_id = ${userId}`;
  if (!v) throw notFound();
  return v;
}

/** Snapshot the current text. Reuses the newest version when the text is identical. */
export async function snapshot(userId: string, essayId: string, kind: Version['kind'], label: string | null = null): Promise<Version> {
  const e = await getEssay(userId, essayId);
  const last = await q1<Version>`select * from stet.versions where essay_id = ${essayId} order by created_at desc limit 1`;
  if (last && last.content === e.content && (kind === 'review' || kind === last.kind) && !label) return last;
  return (await q1<Version>`
    insert into stet.versions (essay_id, content, word_count, kind, label)
    values (${essayId}, ${e.content}, ${countWords(e.content)}, ${kind}, ${label}) returning *`)!;
}

/** Restoring keeps the current text as a labelled version first, so a restore can itself be undone. */
export async function restoreVersion(userId: string, essayId: string, versionId: string, baseRev: number) {
  const v = await getVersion(userId, essayId, versionId);
  await snapshot(userId, essayId, 'manual', 'Before restoring an earlier version');
  const saved = await saveContent(userId, essayId, v.content, baseRev);
  return { ...saved, content: v.content };
}

export async function labelVersion(userId: string, essayId: string, versionId: string, label: string | null) {
  await getVersion(userId, essayId, versionId);
  await q`update stet.versions set label = ${label} where id = ${versionId}`;
}

export async function insertReview(essayId: string, versionId: string, result: unknown): Promise<ReviewRow> {
  return (await q1<ReviewRow>`
    insert into stet.reviews (essay_id, version_id, result) values (${essayId}, ${versionId}, ${JSON.stringify(result)}::text::jsonb)
    returning *`)!;
}

export async function latestReview(userId: string, essayId: string): Promise<ReviewRow | null> {
  return q1<ReviewRow>`
    select r.* from stet.reviews r join stet.essays e on e.id = r.essay_id
    where r.essay_id = ${essayId} and e.user_id = ${userId} order by r.created_at desc limit 1`;
}

export async function getReview(userId: string, essayId: string, reviewId: string): Promise<ReviewRow> {
  const r = await q1<ReviewRow>`
    select r.* from stet.reviews r join stet.essays e on e.id = r.essay_id
    where r.id = ${reviewId} and r.essay_id = ${essayId} and e.user_id = ${userId}`;
  if (!r) throw notFound();
  return r;
}

export async function reviewForVersion(userId: string, essayId: string, versionId: string): Promise<ReviewRow | null> {
  return q1<ReviewRow>`
    select r.* from stet.reviews r join stet.essays e on e.id = r.essay_id
    where r.version_id = ${versionId} and r.essay_id = ${essayId} and e.user_id = ${userId}
    order by r.created_at desc limit 1`;
}

export async function listReviews(userId: string, essayId: string) {
  await getEssay(userId, essayId);
  return q<{ id: string; version_id: string; created_at: Date }>`
    select id, version_id, created_at from stet.reviews where essay_id = ${essayId} order by created_at desc limit 50`;
}

export type ItemStatus = 'open' | 'dismissed' | 'resolved';

export async function setItemStatus(userId: string, essayId: string, reviewId: string, itemId: string, status: ItemStatus) {
  await getReview(userId, essayId, reviewId);
  const row = await q1<{ item_status: Record<string, string> }>`
    update stet.reviews
    set item_status = case when ${status} = 'open' then item_status - ${itemId}
                           else item_status || jsonb_build_object(${itemId}::text, ${status}::text) end
    where id = ${reviewId} returning item_status`;
  return row!.item_status;
}

export async function exportAll(userId: string) {
  const essays = await q<Essay>`select * from stet.essays where user_id = ${userId} order by created_at`;
  const versions = await q<Version>`
    select v.* from stet.versions v join stet.essays e on e.id = v.essay_id where e.user_id = ${userId} order by v.created_at`;
  const reviews = await q<ReviewRow>`
    select r.* from stet.reviews r join stet.essays e on e.id = r.essay_id where e.user_id = ${userId} order by r.created_at`;
  return { exportedAt: new Date().toISOString(), essays, versions, reviews };
}

export async function deleteAccount(userId: string) {
  await q`delete from stet.users where id = ${userId}`;
}
