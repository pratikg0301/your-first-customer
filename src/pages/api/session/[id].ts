import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const env = (locals as any).runtime?.env as Env;
    const sessionId = params.id!;

    const session = await env.DB.prepare(
      `SELECT s.*,
        f.linkedin_url, f.company_url, f.company_linkedin, f.email as founder_email,
        (SELECT data_json FROM enrichments WHERE founder_id = s.founder_id ORDER BY cached_at DESC LIMIT 1) as enrichment_json
       FROM sessions s
       LEFT JOIN founders f ON f.id = s.founder_id
       WHERE s.id = ?`
    ).bind(sessionId).first<any>();

    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    const targets = await env.DB.prepare(
      `SELECT * FROM targets WHERE session_id = ? ORDER BY created_at DESC`
    ).bind(sessionId).all();

    return Response.json({
      name: session.name ?? 'Untitled session',
      stage: session.stage,
      score: session.score,
      score_details: session.score_json ? JSON.parse(session.score_json as string) : null,
      founder_context: session.founder_context ?? null,
      linkedin_url: session.linkedin_url ?? null,
      company_url: session.company_url ?? null,
      company_linkedin: session.company_linkedin ?? null,
      founder_email: session.founder_email ?? null,
      icp: session.icp_json ? JSON.parse(session.icp_json as string) : null,
      playbook: session.playbook_json ? JSON.parse(session.playbook_json as string) : null,
      enrichment: session.enrichment_json ? JSON.parse(session.enrichment_json as string) : null,
      targets: targets.results ?? [],
    });

  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

// PATCH: update session name / founder_context (edit & re-run flow)
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  try {
    const env = (locals as any).runtime?.env as Env;
    const sessionId = params.id!;
    const body = await request.json() as { session_name?: string; founder_context?: string };

    await env.DB.prepare(
      `UPDATE sessions SET
        name = COALESCE(?, name),
        founder_context = COALESCE(?, founder_context),
        updated_at = unixepoch()
       WHERE id = ?`
    ).bind(body.session_name ?? null, body.founder_context ?? null, sessionId).run();

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

interface Env { DB: D1Database; }
