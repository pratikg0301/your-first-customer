import type { APIRoute } from 'astro';
import { getClaudeClient, runAgentJSON } from '@/lib/claude';

export const prerender = false;

const SYSTEM_PROMPT = `You are a ruthlessly honest startup advisor who scores early-stage B2B ideas on their likelihood of landing a first paying customer within 30 days.

Return a JSON object with exactly this structure:
{
  "dimensions": {
    "market_demand": <0-100>,
    "icp_clarity": <0-100>,
    "differentiator_strength": <0-100>,
    "sales_readiness": <0-100>
  },
  "overall_score": <weighted average: market 30%, icp 30%, differentiator 20%, sales 20%>,
  "insights": [
    { "type": "strength" | "warning" | "recommendation", "text": "<specific insight>" }
  ],
  "recommended_icp": "<one specific, narrow first customer segment>",
  "team_analysis": {
    "credibility_score": <0-100>,
    "strengths": ["<strength>"],
    "gaps": ["<gap>"],
    "signal": "<one sentence summary of what the team signals to a buyer>"
  }
}

Be ruthlessly honest. Do not hedge. Return valid JSON only.`;

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
  team_analysis: {
    credibility_score: number;
    strengths: string[];
    gaps: string[];
    signal: string;
  };
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = (locals as any).runtime?.env as Env;
    const body = await request.json() as {
      sessionId: string;
      founderContext: string;
      enrichment: Record<string, unknown>;
      deckContext?: string;
      teamData?: unknown[];
    };

    const client = getClaudeClient(env.ANTHROPIC_API_KEY);

    const userContent = [
      `Founder context: ${body.founderContext}`,
      `Company enrichment: ${JSON.stringify(body.enrichment, null, 2)}`,
      body.teamData?.length ? `Leadership team: ${JSON.stringify(body.teamData, null, 2)}` : null,
      body.deckContext ? `Business deck summary: ${body.deckContext}` : null,
    ].filter(Boolean).join('\n\n');

    const result = await runAgentJSON<ScoreOutput>(client, SYSTEM_PROMPT, userContent);

    await env.DB.prepare(
      `UPDATE sessions SET score = ?, score_json = ?, updated_at = unixepoch() WHERE id = ?`
    ).bind(result.overall_score, JSON.stringify(result), body.sessionId).run();

    return Response.json(result);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

interface Env {
  DB: D1Database;
  ANTHROPIC_API_KEY: string;
}
