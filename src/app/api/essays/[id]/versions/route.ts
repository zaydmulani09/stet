import { requireUser } from '@/lib/auth';
import { listVersions, restoreVersion, snapshot } from '@/lib/essays';
import { json, parseBody, parseId, route } from '@/lib/http';
import { VersionPostSchema } from '@/lib/validation';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: Ctx) => {
  const user = await requireUser(req);
  return json({ versions: await listVersions(user.id, parseId((await params).id)) });
});

/** { label } saves the current text as a named version; { restore, rev } brings an old version back. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const user = await requireUser(req);
  const id = parseId((await params).id);
  const body = await parseBody(req, VersionPostSchema);
  if ('restore' in body) return json(await restoreVersion(user.id, id, body.restore, body.rev));
  const v = await snapshot(user.id, id, 'manual', body.label);
  return json({ version: { ...v, content: undefined } }, { status: 201 });
});
