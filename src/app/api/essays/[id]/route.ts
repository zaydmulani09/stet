import { requireUser } from '@/lib/auth';
import { deleteEssay, getEssay, saveContent, updateFields } from '@/lib/essays';
import { json, parseBody, parseId, route } from '@/lib/http';
import { enforce, limits } from '@/lib/ratelimit';
import { PatchEssaySchema } from '@/lib/validation';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: Ctx) => {
  const user = await requireUser(req);
  return json({ essay: await getEssay(user.id, parseId((await params).id)) });
});

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const user = await requireUser(req);
  const id = parseId((await params).id);
  const body = await parseBody(req, PatchEssaySchema);
  await enforce(...limits.write(user.id));
  let essay = body.fields ? await updateFields(user.id, id, body.fields) : null;
  let saved: { rev: number; updated_at: Date } | null = null;
  if (body.content !== undefined) saved = await saveContent(user.id, id, body.content, body.rev!);
  essay ??= await getEssay(user.id, id);
  return json({ essay: { ...essay, ...(saved ?? {}) } });
});

export const DELETE = route(async (req: Request, { params }: Ctx) => {
  const user = await requireUser(req);
  await deleteEssay(user.id, parseId((await params).id));
  return json({ ok: true });
});
