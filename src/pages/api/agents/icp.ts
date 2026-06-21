import type { APIRoute } from 'astro';
import { getClaudeClient, runAgentJSON } from '@/lib/claude';

export const prerender = false;

const SYSTEM_PROMPT = `You are an expert B2B go-to-market strategist helping early-stage founders identify their ideal customer profile (ICP).

Given enrichment data about a founder and their company, and optional founder-provided hints, produce a structured ICP.

If the founder has provided hints (persona_title, industries, etc.), treat those as hard constraints — your output must match them exactly.
Fill in all other fields based on the enrichment data and your expertise.

Return valid JSON only with this exact structure:
{
  "persona": {
    "title": "<job title>",
    "seniority": "<C-Suite | VP | Director | Manager | IC>",
    "responsibilities": ["<responsibility>"],
    "pain_points": ["<pain point>"],
    "goals": ["<goal>"]
  },
  "company_profile": {
    "industries": ["<industry>"],
    "employee_range": { "min": <number>, "max": <number> },
    "revenue_range": { "min": <number>, "max": <number>, "currency": "USD" },
    "geographies": ["<country>"],
    "tech_indicators": ["<indicator>"]
  },
  "fit_score": <0-100>,
  "fit_reasoning": "<one paragraph>",
  "objections": [
    { "objection": "<objection>", "response": "<response>" }
  ],
  "sales_motion": "<self-serve | assisted | enterprise>",
  "deal_size_usd": { "min": <number>, "max": <number> },
  "sales_cycle_days": { "min": <number>, "max": <number> }
}`;

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
  try {
    const env = (locals as any).runtime?.env as Env;
    const body = await request.json() as {
      sessionId: string;
      enrichment: Record<string, unknown>;
      founderContext: string;
      userHints?: {
        persona_title?: string;
        persona_seniority?: string;
        industries?: string;
        employee_min?: number;
        employee_max?: number;
        sales_motion?: string;
        deal_min?: number;
        deal_max?: number;
      };
    };

    const client = getClaudeClient(env.ANTHROPIC_API_KEY);

    const hintsText = body.userHints && Object.values(body.userHints).some(Boolean)
      ? `\n\nFounder-provided hints (treat as hard constraints):\n${JSON.stringify(body.userHints, null, 2)}`
      : '';

    const icp = await runAgentJSON<ICPOutput>(
      client,
      SYSTEM_PROMPT,
      `Founder context: ${body.founderContext}\n\nEnrichment data: ${JSON.stringify(body.enrichment, null, 2)}${hintsText}`,
    );

    await env.DB.prepare(
      `UPDATE sessions SET icp_json = ?, stage = 'icp_ready', updated_at = unixepoch() WHERE id = ?`
    ).bind(JSON.stringify(icp), body.sessionId).run();

    return Response.json({ icp });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

interface Env {
  DB: D1Database;
  ANTHROPIC_API_KEY: string;
}
