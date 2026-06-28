import type { APIRoute } from 'astro';
import { getClaudeClient, runAgentJSON } from '@/lib/claude';

export const prerender = false;

const SYSTEM_PROMPT = `You are a B2B go-to-market expert. From the list of GTM motions below, select ONLY the ones that are a genuine fit for this specific founder's product, stage, and ICP. Skip motions that are a poor fit — do not include them at all.

Return ONLY valid JSON — no markdown, no extra keys:

{
  "gtm_motions": [
    {
      "motion": "<motion name>",
      "description": "<one sentence on what this motion involves>",
      "fit_score": <0-100>,
      "why_fits": "<one sentence, specific to this founder's product and ICP>",
      "why_not": "<one sentence on the main risk or downside>",
      "recommended": <true|false>,
      "priority": <1-N, 1 = execute first>
    }
  ],
  "first_customer_plan": {
    "target_segment": "<the single most specific segment to pursue first>",
    "approach": "<2 sentences on the exact approach>",
    "timeline_days": <30|45|60|90>,
    "milestones": [
      { "day": <number>, "milestone": "<what should be true by this day>" }
    ],
    "success_criteria": "<what does first customer closed look like concretely>"
  }
}

Available motions to choose from:
Outbound cold email, LinkedIn outbound, Warm introductions / referrals, Content marketing,
Account-based marketing (ABM), Partnership / channel sales, Product-led growth (PLG),
Events / conferences, Community-led growth, Paid acquisition, PR / media outreach,
Inbound SEO, Free trial / freemium, Enterprise direct sales.

Rules:
- Include a motion only if fit_score >= 55
- Mark the top 1-3 as recommended: true, the rest as recommended: false
- Keep every text field under 25 words
- Aim for 3-6 motions total — quality over quantity`;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = (locals as any).runtime?.env as Env;
    const body = await request.json() as {
      sessionId: string;
      icp: Record<string, unknown>;
      founderContext: string;
    };

    if (!body.icp || typeof body.icp !== 'object') {
      return Response.json({ error: 'ICP data is required' }, { status: 400 });
    }

    const client = getClaudeClient(env.ANTHROPIC_API_KEY);

    const result = await runAgentJSON<{
      gtm_motions: unknown[];
      first_customer_plan: unknown;
    }>(
      client,
      SYSTEM_PROMPT,
      `Founder context: ${body.founderContext}\n\nICP: ${JSON.stringify(body.icp, null, 2)}`,
      'claude-sonnet-4-6',
      2500,
    );

    return Response.json(result);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

interface Env { DB: D1Database; ANTHROPIC_API_KEY: string; }
