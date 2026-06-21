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
      account_id?: string;
      session_name?: string;
    };

    if (!body.email || !body.linkedin_url) {
      return Response.json({ error: 'email and linkedin_url are required' }, { status: 400 });
    }

    const sessionId = crypto.randomUUID();

    const founderId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO founders (id, email, linkedin_url, company_url, company_linkedin, account_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         linkedin_url = excluded.linkedin_url,
         company_url = excluded.company_url,
         company_linkedin = excluded.company_linkedin,
         account_id = COALESCE(founders.account_id, excluded.account_id)`
    ).bind(founderId, body.email, body.linkedin_url, body.company_url ?? null, body.company_linkedin ?? null, body.account_id ?? null).run();

    const founder = await env.DB.prepare(
      `SELECT id FROM founders WHERE email = ?`
    ).bind(body.email).first<{ id: string }>();

    const realFounderId = founder!.id;
    const sessionName = body.session_name?.trim() || 'Untitled session';

    await env.DB.prepare(
      `INSERT INTO sessions (id, founder_id, stage, name) VALUES (?, ?, 'intake', ?)`
    ).bind(sessionId, realFounderId, sessionName).run();

    let enrichment = { person: null as any, organization: null as any };

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
        `INSERT INTO enrichments (id, founder_id, source, data_json) VALUES (?, ?, 'intelligence', ?)`
      ).bind(crypto.randomUUID(), realFounderId, JSON.stringify(enrichment)).run();
    }

    await env.DB.prepare(
      `UPDATE sessions SET stage = 'enriched', updated_at = unixepoch() WHERE id = ?`
    ).bind(sessionId).run();

    return Response.json({ sessionId, founderId: realFounderId, enrichment });

  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  APOLLO_API_KEY: string;
  ANTHROPIC_API_KEY: string;
}
