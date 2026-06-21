import type { APIRoute } from 'astro';
import { enrichPersonByLinkedIn, enrichOrganizationByDomain } from '@/lib/apollo';

export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = (locals as any).runtime?.env as Env;

    if (!env?.DB) {
      return Response.json({ error: 'Database not available' }, { status: 500 });
    }

    const body = await request.json() as {
      email: string;
      linkedin_url: string;
      company_url?: string;
      company_linkedin?: string;
    };

    if (!body.email || !body.linkedin_url) {
      return Response.json({ error: 'email and linkedin_url are required' }, { status: 400 });
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

    let enrichment = { person: null, organization: null };

    if (env.APOLLO_API_KEY) {
      const [personData, orgData] = await Promise.allSettled([
        enrichPersonByLinkedIn(body.linkedin_url, env.APOLLO_API_KEY),
        body.company_url
          ? enrichOrganizationByDomain(new URL(body.company_url).hostname, env.APOLLO_API_KEY)
          : Promise.resolve(null),
      ]);

      enrichment = {
        person: personData.status === 'fulfilled' ? personData.value : null,
        organization: orgData.status === 'fulfilled' ? orgData.value : null,
      };

      await env.DB.prepare(
        `INSERT INTO enrichments (id, founder_id, source, data_json) VALUES (?, ?, 'apollo', ?)`
      ).bind(crypto.randomUUID(), founderId, JSON.stringify(enrichment)).run();
    }

    await env.DB.prepare(
      `UPDATE sessions SET stage = 'enriched', updated_at = unixepoch() WHERE id = ?`
    ).bind(sessionId).run();

    return Response.json({ sessionId, founderId, enrichment });

  } catch (err) {
    console.error('Session create error:', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  APOLLO_API_KEY: string;
  ANTHROPIC_API_KEY: string;
}
