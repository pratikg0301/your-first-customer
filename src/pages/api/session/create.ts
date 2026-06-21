import type { APIRoute } from 'astro';
import { enrichPersonByLinkedIn, enrichOrganizationByDomain } from '@/lib/apollo';

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env as Env;

  const body = await request.json() as {
    email: string;
    linkedin_url: string;
    company_url?: string;
    company_linkedin?: string;
  };

  if (!body.email || !body.linkedin_url) {
    return new Response(JSON.stringify({ error: 'email and linkedin_url are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const founderId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT OR IGNORE INTO founders (id, email, linkedin_url, company_url, company_linkedin)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(founderId, body.email, body.linkedin_url, body.company_url ?? null, body.company_linkedin ?? null).run();

  await env.DB.prepare(
    `INSERT INTO sessions (id, founder_id, stage) VALUES (?, ?, 'intake')`
  ).bind(sessionId, founderId).run();

  const doId = env.FOUNDER_SESSION.idFromName(sessionId);
  const stub = env.FOUNDER_SESSION.get(doId);

  await stub.fetch(new Request('https://do/init', {
    method: 'POST',
    body: JSON.stringify({
      founderId,
      intake: body,
    }),
  }));

  const [personData, orgData] = await Promise.allSettled([
    enrichPersonByLinkedIn(body.linkedin_url, env.APOLLO_API_KEY),
    body.company_url
      ? enrichOrganizationByDomain(new URL(body.company_url).hostname, env.APOLLO_API_KEY)
      : Promise.resolve(null),
  ]);

  const enrichment = {
    person: personData.status === 'fulfilled' ? personData.value : null,
    organization: orgData.status === 'fulfilled' ? orgData.value : null,
  };

  await stub.fetch(new Request('https://do/update', {
    method: 'POST',
    body: JSON.stringify({ enrichment, stage: 'enriched' }),
  }));

  await env.DB.prepare(
    `INSERT INTO enrichments (id, founder_id, source, data_json) VALUES (?, ?, 'apollo', ?)`
  ).bind(crypto.randomUUID(), founderId, JSON.stringify(enrichment)).run();

  return Response.json({ sessionId, founderId, enrichment });
};

interface Env {
  DB: D1Database;
  FOUNDER_SESSION: DurableObjectNamespace;
  CACHE: KVNamespace;
  APOLLO_API_KEY: string;
  ANTHROPIC_API_KEY: string;
}
