import type { APIRoute } from 'astro';
import { getClaudeClient, runAgentJSON } from '@/lib/claude';
import { searchPeople } from '@/lib/apollo';

export const prerender = false;

const SYSTEM_PROMPT = `You are a B2B go-to-market expert. Given a founder's ICP and their top GTM motion, create a concrete execution plan.

Return ONLY valid JSON — no markdown, no extra keys:

{
  "execution_inputs_needed": [
    {
      "category": "<Tools | Access | Content | Team | Budget>",
      "items": [
        { "name": "<tool or input>", "why": "<one sentence>", "priority": "<required | recommended | optional>" }
      ]
    }
  ],
  "week1": [
    { "day_range": "Days 1-3", "title": "<action>", "description": "<2 sentences of specific steps>", "channel": "<email|linkedin|phone|async>", "owner": "<founder|team|both>" }
  ],
  "week2": [ { "day_range": "Days 8-10", "title": "<action>", "description": "<2 sentences>", "channel": "<channel>", "owner": "<owner>" } ],
  "week3": [ { "day_range": "Days 15-17", "title": "<action>", "description": "<2 sentences>", "channel": "<channel>", "owner": "<owner>" } ],
  "week4": [ { "day_range": "Days 22-24", "title": "<action>", "description": "<2 sentences>", "channel": "<channel>", "owner": "<owner>" } ],
  "email_subject": "<best cold email subject line for this ICP>",
  "email_body": "<personalised cold email — use {{first_name}}, {{company}}, {{pain_point}} — under 120 words>",
  "linkedin_sequence": [
    "<connection request — under 50 words>",
    "<follow-up day 3 — under 60 words>"
  ],
  "pilot_offer": "<a specific, low-risk first offer — time-limited, concrete, under 30 words>"
}

Generate 2 actions per week. Keep descriptions specific and actionable, not generic. Tailor everything to the founder's product and ICP.`;

interface ExecutionOutput {
  execution_inputs_needed: unknown[];
  week1: unknown[];
  week2: unknown[];
  week3: unknown[];
  week4: unknown[];
  email_subject: string;
  email_body: string;
  linkedin_sequence: string[];
  pilot_offer: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = (locals as any).runtime?.env as Env;
    const body = await request.json() as {
      sessionId: string;
      icp: Record<string, unknown>;
      founderContext: string;
      gtmMotions: unknown[];
      firstCustomerPlan: unknown;
    };

    if (!body.icp || typeof body.icp !== 'object') {
      return Response.json({ error: 'ICP data is required' }, { status: 400 });
    }

    const client = getClaudeClient(env.ANTHROPIC_API_KEY);
    const icp = body.icp as any;

    // Top recommended motion for context
    const topMotion = (body.gtmMotions as any[])?.find(m => m.recommended) ?? (body.gtmMotions as any[])?.[0];
    const motionContext = topMotion
      ? `\n\nTop GTM motion to execute first: ${topMotion.motion} (score: ${topMotion.fit_score}). Why: ${topMotion.why_fits}`
      : '';

    const [execution, targets] = await Promise.allSettled([
      runAgentJSON<ExecutionOutput>(
        client,
        SYSTEM_PROMPT,
        `Founder context: ${body.founderContext}${motionContext}\n\nICP: ${JSON.stringify(icp, null, 2)}`,
        'claude-sonnet-4-6',
        2048,
      ),
      env.APOLLO_API_KEY ? searchPeople(
        {
          titles: [icp?.persona?.title].filter(Boolean),
          industries: icp?.company_profile?.industries,
          employee_count_min: icp?.company_profile?.employee_range?.min,
          employee_count_max: icp?.company_profile?.employee_range?.max,
          countries: icp?.company_profile?.geographies,
          per_page: 25,
        },
        env.APOLLO_API_KEY,
      ) : Promise.resolve([]),
    ]);

    if (execution.status === 'rejected') {
      throw new Error(`Execution plan failed: ${execution.reason}`);
    }

    const execData = execution.value;
    const targetList = targets.status === 'fulfilled' ? targets.value : [];

    // Merge phase 1 (motions) + phase 2 (execution) into full playbook
    const fullPlaybook = {
      gtm_motions: body.gtmMotions ?? [],
      first_customer_plan: body.firstCustomerPlan ?? {},
      ...execData,
    };

    // Save complete playbook to DB
    await env.DB.prepare(
      `UPDATE sessions SET playbook_json = ?, stage = 'playbook_ready', updated_at = unixepoch() WHERE id = ?`
    ).bind(JSON.stringify(fullPlaybook), body.sessionId).run();

    // Save targets
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

    return Response.json({ playbook: fullPlaybook, targets: targetList });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

interface Env { DB: D1Database; ANTHROPIC_API_KEY: string; APOLLO_API_KEY: string; }
