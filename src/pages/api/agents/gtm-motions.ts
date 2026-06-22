import type { APIRoute } from 'astro';
import { getClaudeClient, runAgentJSON } from '@/lib/claude';

export const prerender = false;

const SYSTEM_PROMPT = `You are a B2B go-to-market expert. Evaluate all 14 GTM motions for this specific founder and produce a ranked analysis plus a first customer plan.

Return ONLY valid JSON — no markdown, no extra keys:

{
  "gtm_motions": [
    {
      "motion": "<motion name>",
      "description": "<one sentence>",
      "fit_score": <0-100>,
      "why_fits": "<one sentence, specific to this founder's product and ICP>",
      "why_not": "<one sentence honest downside>",
      "recommended": <true|false>,
      "priority": <1-14>
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

Evaluate ALL of these motions and assign a unique priority rank 1-14 (1 = best fit):
Outbound cold email, LinkedIn outbound, Warm introductions / referrals, Content marketing,
Account-based marketing (ABM), Partnership / channel sales, Product-led growth (PLG),
Events / conferences, Community-led growth, Paid acquisition, PR / media outreach,
Inbound SEO, Free trial / freemium, Enterprise direct sales.

Be specific to this founder's product and ICP. Keep every field under 30 words.`;

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
      2048,
    );

    return Response.json(result);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

interface Env { DB: D1Database; ANTHROPIC_API_KEY: string; }
