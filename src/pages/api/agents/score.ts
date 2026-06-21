import type { APIRoute } from 'astro';
import { getClaudeClient, runAgentJSON } from '@/lib/claude';

const SYSTEM_PROMPT = `You are a ruthlessly honest startup advisor who scores early-stage B2B ideas on their likelihood of landing a first paying customer within 30 days.

Score the founder's idea across four dimensions (0-100 each):
- market_demand: Is there a real, urgent, quantifiable pain?
- icp_clarity: How precisely can we identify and reach the buyer?
- differentiator_strength: Is there a clear reason to choose this over alternatives?
- sales_readiness: Can the founder actually sell this now (pricing, demo, credibility)?

Also provide:
- overall_score (weighted average: market 30%, icp 30%, differentiator 20%, sales 20%)
- 2-3 specific insights (each with type: "strength" | "warning" | "recommendation" and text)
- recommended_icp: one specific, narrow first customer segment to target

Return valid JSON only.`;

interface ScoreOutput {
  dimensions: {
    market_demand: number;
    icp_clarity: number;
    differentiator_strength: number;
    sales_readiness: number;
  };
  overall_score: number;
  insights: Array<{ type: 'strength' | 'warning' | 'recommendation'; text: string }>;
  recommended_icp: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env as Env;
  const body = await request.json() as {
    sessionId: string;
    founderContext: string;
    enrichment: Record<string, unknown>;
  };

  const client = getClaudeClient(env.ANTHROPIC_API_KEY);

  const result = await runAgentJSON<ScoreOutput>(
    client,
    SYSTEM_PROMPT,
    `Founder context: ${body.founderContext}\n\nCompany enrichment: ${JSON.stringify(body.enrichment, null, 2)}`,
  );

  const doId = env.FOUNDER_SESSION.idFromName(body.sessionId);
  const stub = env.FOUNDER_SESSION.get(doId);
  await stub.fetch(new Request('https://do/update', {
    method: 'POST',
    body: JSON.stringify({ score: result.overall_score }),
  }));

  await env.DB.prepare(
    `UPDATE sessions SET score = ?, updated_at = unixepoch() WHERE id = ?`
  ).bind(result.overall_score, body.sessionId).run();

  return Response.json(result);
};

interface Env {
  DB: D1Database;
  FOUNDER_SESSION: DurableObjectNamespace;
  ANTHROPIC_API_KEY: string;
}
