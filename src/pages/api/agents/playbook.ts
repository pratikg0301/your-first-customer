import type { APIRoute } from 'astro';
import { getClaudeClient, runAgentJSON } from '@/lib/claude';
import { searchPeople } from '@/lib/apollo';

const SYSTEM_PROMPT = `You are a B2B sales execution expert who creates actionable 30-day GTM playbooks for first-time founders.

Given an ICP and founder context, produce a 30-day playbook with:
- week1: days 1-7 actions (outreach setup, target list building, first emails)
- week2: days 8-14 actions (follow-ups, discovery calls)
- week3: days 15-21 actions (pilot offer, objection handling)
- week4: days 22-30 actions (close or iterate)

Each action has: day_range, title, description, channel ("email"|"linkedin"|"phone"|"async"), owner ("founder"|"yfc_team"|"both")

Also produce:
- email_subject: the best cold email subject line for this ICP
- email_body: a personalized cold email template (use {{first_name}}, {{company}}, {{pain_point}} as variables)
- linkedin_sequence: array of 3 LinkedIn messages (connection request, follow-up 1, follow-up 2)
- pilot_offer: a low-risk first offer to remove friction (specific, time-limited)

Return valid JSON only.`;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = (locals as any).runtime?.env as Env;
    const body = await request.json() as {
      sessionId: string;
      icp: Record<string, unknown>;
      founderContext: string;
    };

    const client = getClaudeClient(env.ANTHROPIC_API_KEY);

    const [playbook, targets] = await Promise.all([
      runAgentJSON(
        client,
        SYSTEM_PROMPT,
        `Founder context: ${body.founderContext}\n\nICP: ${JSON.stringify(body.icp, null, 2)}`,
      ),
      searchPeople(
        {
          titles: [(body.icp as any)?.persona?.title],
          industries: (body.icp as any)?.company_profile?.industries,
          employee_count_min: (body.icp as any)?.company_profile?.employee_range?.min,
          employee_count_max: (body.icp as any)?.company_profile?.employee_range?.max,
          countries: (body.icp as any)?.company_profile?.geographies,
          per_page: 25,
        },
        env.APOLLO_API_KEY,
      ),
    ]);

    await env.DB.prepare(
      `UPDATE sessions SET playbook_json = ?, stage = 'playbook_ready', updated_at = unixepoch() WHERE id = ?`
    ).bind(JSON.stringify(playbook), body.sessionId).run();

    return Response.json({ playbook, targets });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

interface Env {
  DB: D1Database;
  ANTHROPIC_API_KEY: string;
  APOLLO_API_KEY: string;
}
