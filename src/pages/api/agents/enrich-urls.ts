import type { APIRoute } from 'astro';
import { enrichPersonByLinkedIn, enrichOrganizationByDomain, searchLeadership } from '@/lib/apollo';
import { getClaudeClient, runAgentJSON } from '@/lib/claude';

export const prerender = false;

interface EnrichResult {
  product_description: string;
  problem_solved: string;
  industry_focus: string;
  company_name: string;
  enrichment: Record<string, unknown>;
  teamData: unknown[];
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = (locals as any).runtime?.env as Env;
    const body = await request.json() as {
      linkedin_url: string;
      company_url?: string;
      company_linkedin?: string;
    };

    const domain = body.company_url ? (() => { try { return new URL(body.company_url!).hostname; } catch { return null; } })() : null;

    const [personData, orgData, leadershipData] = await Promise.allSettled([
      enrichPersonByLinkedIn(body.linkedin_url, env.APOLLO_API_KEY),
      domain ? enrichOrganizationByDomain(domain, env.APOLLO_API_KEY) : Promise.resolve(null),
      domain ? searchLeadership(domain, env.APOLLO_API_KEY) : Promise.resolve([]),
    ]);

    const person = personData.status === 'fulfilled' ? personData.value : null;
    const org = orgData.status === 'fulfilled' ? orgData.value : null;
    const teamData = leadershipData.status === 'fulfilled' ? leadershipData.value : [];
    const enrichment = { person, organization: org };

    const client = getClaudeClient(env.ANTHROPIC_API_KEY);

    const prefilled = await runAgentJSON<Omit<EnrichResult, 'enrichment' | 'teamData'>>(
      client,
      `You are a B2B analyst. Given company and founder data, generate concise pre-filled form values.

Return JSON with exactly these fields:
{
  "product_description": "<one sentence describing what this company sells, max 15 words>",
  "problem_solved": "<2-3 sentences describing the specific business pain this product solves, be concrete>",
  "industry_focus": "<primary industry, e.g. Healthcare, SaaS, Fintech, Real Estate>",
  "company_name": "<company name>"
}`,
      `Person data: ${JSON.stringify(person, null, 2)}\n\nOrganization data: ${JSON.stringify(org, null, 2)}`,
    );

    return Response.json({ ...prefilled, enrichment, teamData });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

interface Env {
  APOLLO_API_KEY: string;
  ANTHROPIC_API_KEY: string;
}
