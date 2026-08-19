import type { APIRoute } from 'astro';
import { getClaudeClient, runAgentJSON } from '@/lib/claude';

const SYSTEM_PROMPT = `You are an expert B2B go-to-market strategist helping early-stage founders identify their ideal customer profile (ICP).

Given enrichment data about a founder and their company, produce a structured ICP with:
- Primary buyer persona (title, seniority, responsibilities, pain points, goals)
- Company profile (industry, size range, revenue range, geography, tech stack indicators)
- Problem-solution fit score (0-100) with reasoning
- Top 3 objections and how to handle them
- Recommended sales motion (self-serve, assisted, enterprise)
- Estimated deal size and sales cycle length

Be specific and opinionated. Do not hedge. Return valid JSON only.`;

interface ICPOutput {
  persona: {
    title: string;
    seniority: string;
    responsibilities: string[];
    pain_points: string[];
    goals: string[];
  };
  company_profile: {
    industries: string[];
    employee_range: { min: number; max: number };
    revenue_range: { min: number; max: number; currency: string };
    geographies: string[];
    tech_indicators: string[];
  };
  fit_score: number;
  fit_reasoning: string;
  objections: Array<{ objection: string; response: string }>;
  sales_motion: string;
  deal_size_usd: { min: number; max: number };
  sales_cycle_days: { min: number; max: number };
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env as Env;
  const body = await request.json() as {
    sessionId: string;
    enrichment: Record<string, unknown>;
    founderContext: string;
  };

  const client = getClaudeClient(env.ANTHROPIC_API_KEY);

  const icp = await runAgentJSON<ICPOutput>(
    client,
    SYSTEM_PROMPT,
    `Founder context: ${body.founderContext}\n\nEnrichment data: ${JSON.stringify(body.enrichment, null, 2)}`,
  );

  const doId = env.FOUNDER_SESSION.idFromName(body.sessionId);
  const stub = env.FOUNDER_SESSION.get(doId);
  await stub.fetch(new Request('https://do/update', {
    method: 'POST',
    body: JSON.stringify({ icp, stage: 'icp_ready' }),
  }));

  await env.DB.prepare(
    `UPDATE sessions SET icp_json = ?, stage = 'icp_ready', updated_at = unixepoch() WHERE id = ?`
  ).bind(JSON.stringify(icp), body.sessionId).run();

  return Response.json({ icp });
};

interface Env {
  DB: D1Database;
  FOUNDER_SESSION: DurableObjectNamespace;
  ANTHROPIC_API_KEY: string;
}
