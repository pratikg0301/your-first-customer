import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, locals }) => {
  const env = locals.runtime.env as Env;
  const sessionId = params.id!;

  const raw = await env.CACHE.get(`session:${sessionId}`);
  if (!raw) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(raw, { headers: { 'Content-Type': 'application/json' } });
};

interface Env {
  CACHE: KVNamespace;
}
