const APOLLO_BASE = 'https://api.apollo.io/v1';

interface ApolloPersonResult {
  person: {
    name: string;
    title: string;
    email: string;
    linkedin_url: string;
    organization: {
      name: string;
      website_url: string;
      estimated_num_employees: number;
      annual_revenue: number;
      industry: string;
      keywords: string[];
    };
  };
}

interface ApolloOrgResult {
  organization: {
    name: string;
    website_url: string;
    blog_url: string;
    linkedin_url: string;
    twitter_url: string;
    estimated_num_employees: number;
    annual_revenue: number;
    industry: string;
    short_description: string;
    keywords: string[];
    founded_year: number;
    hq_city: string;
    hq_country: string;
  };
}

export async function enrichPersonByLinkedIn(
  linkedinUrl: string,
  apiKey: string,
): Promise<ApolloPersonResult['person'] | null> {
  const res = await fetch(`${APOLLO_BASE}/people/match`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({ linkedin_url: linkedinUrl, reveal_personal_emails: true }),
  });

  if (!res.ok) return null;
  const data = await res.json<ApolloPersonResult>();
  return data.person ?? null;
}

export async function enrichOrganizationByDomain(
  domain: string,
  apiKey: string,
): Promise<ApolloOrgResult['organization'] | null> {
  const res = await fetch(`${APOLLO_BASE}/organizations/enrich?domain=${encodeURIComponent(domain)}`, {
    headers: { 'X-Api-Key': apiKey },
  });

  if (!res.ok) return null;
  const data = await res.json<ApolloOrgResult>();
  return data.organization ?? null;
}

export async function searchLeadership(
  domain: string,
  apiKey: string,
  limit = 6,
): Promise<ApolloPersonResult['person'][]> {
  const res = await fetch(`${APOLLO_BASE}/mixed_people/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify({
      organization_domains: [domain],
      person_seniorities: ['c_suite', 'founder', 'vp', 'director'],
      per_page: limit,
    }),
  });
  if (!res.ok) return [];
  const data = await res.json<{ people: ApolloPersonResult['person'][] }>();
  return data.people ?? [];
}

export async function searchPeople(
  params: {
    titles?: string[];
    industries?: string[];
    employee_count_min?: number;
    employee_count_max?: number;
    countries?: string[];
    per_page?: number;
  },
  apiKey: string,
) {
  const res = await fetch(`${APOLLO_BASE}/mixed_people/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({ ...params, per_page: params.per_page ?? 25 }),
  });

  if (!res.ok) return [];
  const data = await res.json<{ people: unknown[] }>();
  return data.people ?? [];
}
