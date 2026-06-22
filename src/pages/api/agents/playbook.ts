import type { APIRoute } from 'astro';
import { getClaudeClient, runAgentJSON } from '@/lib/claude';
import { searchPeople } from '@/lib/apollo';

export const prerender = false;

const SYSTEM_PROMPT = `You are a B2B go-to-market expert helping a founder land their first paying customer.

Given an ICP and founder context, produce a comprehensive GTM playbook as a single JSON object.

Return ONLY valid JSON with this exact structure — no markdown, no extra keys:

{
  "gtm_motions": [
    {
      "motion": "<motion name>",
      "description": "<one sentence>",
      "fit_score": <0-100>,
      "why_fits": "<specific reason this fits this founder's situation>",
      "why_not": "<honest reason this might not work or is harder>",
      "recommended": <true|false>,
      "priority": <1-14, 1 = best>
    }
  ],
  "first_customer_plan": {
    "target_segment": "<the single most specific segment to pursue first>",
    "approach": "<2-3 sentences on the exact approach>",
    "timeline_days": <30|45|60|90>,
    "milestones": [
      { "day": <number>, "milestone": "<what should be true by this day>" }
    ],
    "success_criteria": "<what does 'got the first customer' look like concretely>"
  },
  "execution_inputs_needed": [
    {
      "category": "<Tools | Access | Content | Team | Budget>",
      "items": [
        { "name": "<tool or input name>", "why": "<why it's needed>", "priority": "<required | recommended | optional>" }
      ]
    }
  ],
  "week1": [
    { "day_range": "Days 1-3", "title": "<action>", "description": "<specific steps>", "channel": "<email|linkedin|phone|async>", "owner": "<founder|yfc_team|both>" }
  ],
  "week2": [ <same shape> ],
  "week3": [ <same shape> ],
  "week4": [ <same shape> ],
  "email_subject": "<best cold email subject for this ICP>",
  "email_body": "<personalized cold email template — use {{first_name}}, {{company}}, {{pain_point}} as variables>",
  "linkedin_sequence": [
    "<connection request message>",
    "<follow-up message 1 — day 3>",
    "<follow-up message 2 — day 7>"
  ],
  "pilot_offer": "<a specific, low-risk first offer to remove friction — time-limited, concrete>"
}

For gtm_motions, evaluate ALL of these and assign a priority rank to each:
Outbound cold email, LinkedIn outbound, Warm introductions / referrals, Content marketing, Account-based marketing (ABM), Partnership / channel sales, Product-led growth (PLG), Events / conferences, Community-led growth, Paid acquisition, PR / media outreach, Inbound SEO, Free trial / freemium, Enterprise direct sales.

Be specific to this founder's product, ICP, and situation. Do not give generic advice.`;

interface PlaybookOutput {
  gtm_motions: Array<{
    motion: string;
    description: string;
    fit_score: number;
    why_fits: string;
    why_not: string;
    recommended: boolean;
    priority: number;
  }>;
  first_customer_plan: {
    target_segment: string;
    approach: string;
    timeline_days: number;
    milestones: Array<{ day: number; milestone: string }>;
    success_criteria: string;
  };
  execution_inputs_needed: Array<{
    category: string;
    items: Array<{ name: string; why: string; priority: string }>;
  }>;
  week1: WeekAction[];
  week2: WeekAction[];
  week3: WeekAction[];
  week4: WeekAction[];
  email_subject: string;
  email_body: string;
  linkedin_sequence: string[];
  pilot_offer: string;
}

interface WeekAction {
  day_range: string;
  title: string;
  description: string;
  channel: string;
  owner: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = (locals as any).runtime?.env as Env;
    const body = await request.json() as {
      sessionId: string;
      icp: Record<string, unknown>;
      founderContext: string;
    };

    const client = getClaudeClient(env.ANTHROPIC_API_KEY);
    const icp = body.icp as any;

    if (!icp || typeof icp !== 'object') {
      return Response.json({ error: 'ICP data is missing — cannot build playbook without a valid ICP.' }, { status: 400 });
    }

    const [playbook, targets] = await Promise.allSettled([
      runAgentJSON<PlaybookOutput>(
        client,
        SYSTEM_PROMPT,
        `Founder context: ${body.founderContext}\n\nICP: ${JSON.stringify(icp, null, 2)}`,
        'claude-sonnet-4-6',
        8192,
      ),
      searchPeople(
        {
          titles: [icp?.persona?.title].filter(Boolean),
          industries: icp?.company_profile?.industries,
          employee_count_min: icp?.company_profile?.employee_range?.min,
          employee_count_max: icp?.company_profile?.employee_range?.max,
          countries: icp?.company_profile?.geographies,
          per_page: 25,
        },
        env.APOLLO_API_KEY,
      ),
    ]);

    if (playbook.status === 'rejected') {
      throw new Error(`Playbook generation failed: ${playbook.reason}`);
    }

    const playbookData = playbook.value;
    const targetList = targets.status === 'fulfilled' ? targets.value : [];

    await env.DB.prepare(
      `UPDATE sessions SET playbook_json = ?, stage = 'playbook_ready', updated_at = unixepoch() WHERE id = ?`
    ).bind(JSON.stringify(playbookData), body.sessionId).run();

    // Save targets to DB
    if (targetList.length > 0) {
      const inserts = (targetList as any[]).slice(0, 25).map((t: any) =>
        env.DB.prepare(
          `INSERT OR IGNORE INTO targets (id, session_id, company_name, contact_name, contact_title, contact_email, linkedin_url)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(),
          body.sessionId,
          t.organization?.name ?? t.employment_history?.[0]?.organization_name ?? null,
          `${t.first_name ?? ''} ${t.last_name ?? ''}`.trim() || t.name || null,
          t.title ?? null,
          t.email ?? null,
          t.linkedin_url ?? null,
        )
      );
      await env.DB.batch(inserts);
    }

    return Response.json({ playbook: playbookData, targets: targetList });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

interface Env {
  DB: D1Database;
  ANTHROPIC_API_KEY: string;
  APOLLO_API_KEY: string;
}
