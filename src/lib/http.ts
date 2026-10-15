import { z } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const notFound = () => new HttpError(404, 'not_found', 'Not found.');

export function json(data: unknown, init: ResponseInit = {}): Response {
  return Response.json(data, init);
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) {
    const headers: Record<string, string> = {};
    if (typeof e.extra.retryAfter === 'number') headers['Retry-After'] = String(e.extra.retryAfter);
    return json({ error: { code: e.code, message: e.message, ...e.extra } }, { status: e.status, headers });
  }
  // Never echo internals or essay content; log a short tag only.
  const tag = Math.random().toString(36).slice(2, 8);
  console.error(`[stet] unhandled ${tag}:`, e instanceof Error ? `${e.name}: ${e.message.slice(0, 200)}` : typeof e);
  return json({ error: { code: 'server_error', message: `Something went wrong on our side (ref ${tag}). Your text is safe; try again.` } }, { status: 500 });
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Rejects cross-site browser requests. SameSite=Lax cookies already block most CSRF; this closes the rest. */
export function assertSameOrigin(req: Request) {
  if (!MUTATING.has(req.method)) return;
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (origin && host && new URL(origin).host !== host) throw new HttpError(403, 'bad_origin', 'Cross-site request refused.');
  if (req.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError(403, 'bad_origin', 'Cross-site request refused.');
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler with origin checks and uniform error responses. */
export function route<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      assertSameOrigin(req);
      return await handler(req, ctx);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

const MAX_BODY = 256 * 1024;

export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  if (!(req.headers.get('content-type') ?? '').includes('application/json'))
    throw new HttpError(415, 'unsupported_media_type', 'Send JSON.');
  const raw = await req.text();
  if (raw.length > MAX_BODY) throw new HttpError(413, 'too_large', 'Request is too large.');
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'bad_json', 'Request body is not valid JSON.');
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new HttpError(400, 'invalid_request', `Invalid ${first?.path.join('.') || 'request'}: ${first?.message ?? 'bad value'}`);
  }
  return parsed.data;
}

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';
}

export const uuid = z.string().uuid();

export function parseId(id: string): string {
  if (!uuid.safeParse(id).success) throw notFound();
  return id;
}
