import { useState } from 'react';

type Stage = 'intake' | 'enriching' | 'scoring' | 'score_ready' | 'icp' | 'playbook';

interface IntakeData {
  email: string;
  linkedin_url: string;
  company_url: string;
  company_linkedin: string;
  product_description: string;
  problem_solved: string;
  ticket_size: string;
  industry_focus: string;
}

interface ScoreResult {
  dimensions: Record<string, number>;
  overall_score: number;
  insights: Array<{ type: string; text: string }>;
  recommended_icp: string;
}

const STAGE_LABELS: Record<Stage, string> = {
  intake: 'Tell us about you',
  enriching: 'Enriching your profile...',
  scoring: 'Scoring your idea...',
  score_ready: 'Your readiness score',
  icp: 'Building your ICP...',
  playbook: 'Your GTM playbook',
};

export default function IntakeFlow() {
  const [stage, setStage] = useState<Stage>('intake');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [enrichment, setEnrichment] = useState<Record<string, unknown> | null>(null);
  const [score, setScore] = useState<ScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<IntakeData>({
    email: '',
    linkedin_url: '',
    company_url: '',
    company_linkedin: '',
    product_description: '',
    problem_solved: '',
    ticket_size: '',
    industry_focus: '',
  });

  const set = (k: keyof IntakeData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStage('enriching');

    try {
      const res = await fetch('/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          linkedin_url: form.linkedin_url,
          company_url: form.company_url || undefined,
          company_linkedin: form.company_linkedin || undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to create session');
      const { sessionId: sid, enrichment: enr } = await res.json();
      setSessionId(sid);
      setEnrichment(enr);
      setStage('scoring');

      const scoreRes = await fetch('/api/agents/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sid,
          founderContext: `Product: ${form.product_description}. Problem solved: ${form.problem_solved}. Target ticket size: ${form.ticket_size}. Industry focus: ${form.industry_focus}.`,
          enrichment: enr,
        }),
      });

      if (!scoreRes.ok) {
        const errBody = await scoreRes.json().catch(() => ({}));
        throw new Error(`Scoring failed: ${JSON.stringify(errBody)}`);
      }
      const scoreData = await scoreRes.json();
      setScore(scoreData);
      setStage('score_ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStage('intake');
    }
  }

  async function buildPlaybook() {
    if (!sessionId || !enrichment) return;
    setStage('icp');

    const icpRes = await fetch('/api/agents/icp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        enrichment,
        founderContext: `Product: ${form.product_description}. Problem: ${form.problem_solved}. Ticket size: ${form.ticket_size}. Industry: ${form.industry_focus}.`,
      }),
    });

    const { icp } = await icpRes.json();

    await fetch('/api/agents/playbook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        icp,
        founderContext: `Product: ${form.product_description}. Problem: ${form.problem_solved}.`,
      }),
    });

    window.location.href = `/dashboard?session=${sessionId}`;
  }

  const insightIcon = (type: string) => {
    if (type === 'strength') return '✓';
    if (type === 'warning') return '⚠';
    return '→';
  };

  const insightColor = (type: string) => {
    if (type === 'strength') return 'text-emerald-700 bg-emerald-50';
    if (type === 'warning') return 'text-amber-700 bg-amber-50';
    return 'text-indigo-700 bg-indigo-50';
  };

  const dimLabel: Record<string, string> = {
    market_demand: 'Market demand',
    icp_clarity: 'ICP clarity',
    differentiator_strength: 'Differentiator',
    sales_readiness: 'Sales readiness',
  };

  const dimColor = (v: number) =>
    v >= 75 ? 'bg-emerald-500' : v >= 55 ? 'bg-amber-400' : 'bg-red-400';

  if (stage === 'enriching' || stage === 'scoring' || stage === 'icp') {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <div className="w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
        <p className="text-lg font-medium text-gray-900">{STAGE_LABELS[stage]}</p>
        <p className="text-sm text-gray-500 mt-2">
          {stage === 'enriching' && 'Pulling your professional profile and company data from Apollo...'}
          {stage === 'scoring' && 'Analysing market demand, ICP clarity, and sales readiness...'}
          {stage === 'icp' && 'Building your ICP and generating target list...'}
        </p>
      </div>
    );
  }

  if (stage === 'score_ready' && score) {
    return (
      <div className="max-w-xl mx-auto px-6 py-12">
        <div className="mb-8">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Step 2 of 3 · Readiness score</p>
          <h1 className="text-2xl font-medium text-gray-900">
            Your idea scored{' '}
            <span className="text-emerald-600">{score.overall_score} / 100</span>
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Recommended first target: <strong className="text-gray-700">{score.recommended_icp}</strong>
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {Object.entries(score.dimensions).map(([key, val]) => (
            <div key={key}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-700">{dimLabel[key] ?? key}</span>
                <span className="font-medium text-gray-900">{val}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full">
                <div className={`h-1.5 rounded-full ${dimColor(val)}`} style={{ width: `${val}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2 mb-8">
          {score.insights.map((ins, i) => (
            <div key={i} className={`flex gap-3 rounded-lg p-3 text-sm ${insightColor(ins.type)}`}>
              <span className="font-medium flex-shrink-0">{insightIcon(ins.type)}</span>
              <span>{ins.text}</span>
            </div>
          ))}
        </div>

        <button
          onClick={buildPlaybook}
          className="w-full bg-indigo-600 text-white rounded-lg py-3 font-medium hover:bg-indigo-700 transition-colors"
        >
          Build my GTM playbook →
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-12">
      <div className="mb-8">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Step 1 of 3 · About you</p>
        <h1 className="text-2xl font-medium text-gray-900">Tell us about your idea</h1>
        <p className="text-gray-500 mt-1 text-sm">We'll screen it and score it before we spend any time together.</p>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">Your email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={set('email')}
              placeholder="you@company.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">Your LinkedIn URL</label>
            <input
              type="url"
              required
              value={form.linkedin_url}
              onChange={set('linkedin_url')}
              placeholder="linkedin.com/in/yourname"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">Company website <span className="text-gray-400">(optional)</span></label>
            <input
              type="url"
              value={form.company_url}
              onChange={set('company_url')}
              placeholder="https://yourcompany.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">Company LinkedIn <span className="text-gray-400">(optional)</span></label>
            <input
              type="url"
              value={form.company_linkedin}
              onChange={set('company_linkedin')}
              placeholder="linkedin.com/company/..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1.5">What's your product or service?</label>
          <input
            type="text"
            required
            value={form.product_description}
            onChange={set('product_description')}
            placeholder="e.g. AI scheduling tool for dental practices"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1.5">What problem does it solve? (2–3 sentences)</label>
          <textarea
            required
            rows={3}
            value={form.problem_solved}
            onChange={set('problem_solved')}
            placeholder="Describe the specific pain your first customer feels. Be concrete — include numbers if you have them."
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">Expected deal size</label>
            <select
              value={form.ticket_size}
              onChange={set('ticket_size')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">Select range</option>
              <option value="under_1k">Under $1K/yr</option>
              <option value="1k_10k">$1K – $10K/yr</option>
              <option value="10k_50k">$10K – $50K/yr</option>
              <option value="50k_plus">$50K+/yr</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">Target industry</label>
            <input
              type="text"
              value={form.industry_focus}
              onChange={set('industry_focus')}
              placeholder="e.g. Healthcare, SaaS, Retail"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-indigo-600 text-white rounded-lg py-3 font-medium hover:bg-indigo-700 transition-colors mt-2"
        >
          Screen my idea →
        </button>
      </form>
    </div>
  );
}
