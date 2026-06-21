import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const env = (locals as any).runtime?.env as Env;
    const sessionId = params.id!;

    const session = await env.DB.prepare(
      `SELECT s.*, e.data_json as enrichment_json
       FROM sessions s
       LEFT JOIN enrichments e ON e.founder_id = s.founder_id
       WHERE s.id = ?
       ORDER BY e.cached_at DESC
       LIMIT 1`
    ).bind(sessionId).first();

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
      icp: session.icp_json ? JSON.parse(session.icp_json as string) : null,
      playbook: session.playbook_json ? JSON.parse(session.playbook_json as string) : null,
      enrichment: session.enrichment_json ? JSON.parse(session.enrichment_json as string) : null,
      targets: targets.results ?? [],
    });

  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

interface Env {
  DB: D1Database;
}
