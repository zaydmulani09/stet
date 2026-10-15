import { requireUser } from '@/lib/auth';
import { exportAll } from '@/lib/essays';
import { route } from '@/lib/http';

export const GET = route(async (req: Request) => {
  const user = await requireUser(req);
  const data = await exportAll(user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="stet-export-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  });
});
