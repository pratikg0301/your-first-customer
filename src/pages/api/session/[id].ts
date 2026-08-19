import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, locals }) => {
  const env = locals.runtime.env as Env;
  const sessionId = params.id!;

  const doId = env.FOUNDER_SESSION.idFromName(sessionId);
  const stub = env.FOUNDER_SESSION.get(doId);
  const res = await stub.fetch(new Request('https://do/state'));

  return new Response(res.body, {
    headers: { 'Content-Type': 'application/json' },
  });
};

interface Env {
  FOUNDER_SESSION: DurableObjectNamespace;
}
