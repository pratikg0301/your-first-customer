import { useState } from 'react';

type Stage = 'signup' | 'urls' | 'enriching' | 'confirm' | 'scoring' | 'score_ready' | 'icp';

interface Account { id: string; email: string; }
interface ScoreResult {
  dimensions: Record<string, number>;
  overall_score: number;
  insights: Array<{ type: string; text: string }>;
  recommended_icp: string;
}

const STEP_LABELS: Partial<Record<Stage, string>> = {
  signup: 'Create account',
  urls: 'Your links',
  confirm: 'Confirm details',
  score_ready: 'Your score',
};
const STEPS = ['signup', 'urls', 'confirm', 'score_ready'];

function StepDots({ stage }: { stage: Stage }) {
  const idx = STEPS.indexOf(stage);
  return (
    <div className="flex gap-2 items-center">
      {STEPS.map((s, i) => (
        <div key={s} className={`h-1.5 rounded-full transition-all ${i < idx ? 'w-4 bg-indigo-300' : i === idx ? 'w-6 bg-indigo-600' : 'w-4 bg-gray-200'}`} />
      ))}
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="max-w-lg mx-auto px-6 py-24 text-center">
      <div className="w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
      <p className="text-lg font-medium text-gray-900">{label}</p>
    </div>
  );
}

export default function IntakeFlow() {
  const [stage, setStage] = useState<Stage>('signup');
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(false);

  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [companyUrl, setCompanyUrl] = useState('');
  const [companyLinkedin, setCompanyLinkedin] = useState('');

  const [productDescription, setProductDescription] = useState('');
  const [problemSolved, setProblemSolved] = useState('');
  const [industryFocus, setIndustryFocus] = useState('');
  const [enrichment, setEnrichment] = useState<Record<string, unknown> | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [score, setScore] = useState<ScoreResult | null>(null);

  const dimLabel: Record<string, string> = {
    market_demand: 'Market demand',
    icp_clarity: 'ICP clarity',
    differentiator_strength: 'Differentiator',
    sales_readiness: 'Sales readiness',
  };
  const dimColor = (v: number) => v >= 75 ? 'bg-emerald-500' : v >= 55 ? 'bg-amber-400' : 'bg-red-400';
  const insightColor = (t: string) => t === 'strength' ? 'bg-emerald-50 text-emerald-700' : t === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700';
  const insightIcon = (t: string) => t === 'strength' ? '✓' : t === 'warning' ? '⚠' : '→';

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json() as any;
    if (!res.ok) { setError(data.error); return; }
    setAccount({ id: data.accountId, email: data.email });
    setEmail(data.email);
    setStage('urls');
  }

  async function handleUrls(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!linkedinUrl) { setError('LinkedIn URL is required'); return; }
    setStage('enriching');

    const res = await fetch('/api/agents/enrich-urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkedin_url: linkedinUrl, company_url: companyUrl || undefined, company_linkedin: companyLinkedin || undefined }),
    });
    const data = await res.json() as any;

    if (res.ok && !data.error) {
      setProductDescription(data.product_description ?? '');
      setProblemSolved(data.problem_solved ?? '');
      setIndustryFocus(data.industry_focus ?? '');
      setEnrichment(data.enrichment ?? null);
    }
    setStage('confirm');
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStage('scoring');

    try {
      const sessionRes = await fetch('/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: account!.email,
          linkedin_url: linkedinUrl,
          company_url: companyUrl || undefined,
          company_linkedin: companyLinkedin || undefined,
          account_id: account!.id,
        }),
      });
      if (!sessionRes.ok) {
        const err = await sessionRes.json() as any;
        throw new Error(err.error ?? 'Failed to create session');
      }
      const { sessionId: sid, enrichment: enr } = await sessionRes.json() as any;
      setSessionId(sid);
      if (enr) setEnrichment(enr);

      const scoreRes = await fetch('/api/agents/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sid,
          founderContext: `Product: ${productDescription}. Problem: ${problemSolved}. Industry: ${industryFocus}.`,
          enrichment: enrichment ?? enr ?? {},
        }),
      });
      if (!scoreRes.ok) {
        const err = await scoreRes.json() as any;
        throw new Error(err.error ?? 'Scoring failed');
      }
      const scoreData = await scoreRes.json() as ScoreResult;
      setScore(scoreData);
      setStage('score_ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStage('confirm');
    }
  }

  async function buildPlaybook() {
    if (!sessionId) return;
    setStage('icp');

    const icpRes = await fetch('/api/agents/icp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        enrichment: enrichment ?? {},
        founderContext: `Product: ${productDescription}. Problem: ${problemSolved}. Industry: ${industryFocus}.`,
      }),
    });
    const { icp } = await icpRes.json() as any;

    await fetch('/api/agents/playbook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        icp,
        founderContext: `Product: ${productDescription}. Problem: ${problemSolved}.`,
      }),
    });

    window.location.href = `/dashboard?session=${sessionId}`;
  }

  if (stage === 'enriching') return <Spinner label="Reading your profile and company data..." />;
  if (stage === 'scoring') return <Spinner label="Scoring your idea..." />;
  if (stage === 'icp') return <Spinner label="Building your GTM playbook..." />;

  return (
    <div className="max-w-xl mx-auto px-6 py-10">

      {/* SIGNUP / LOGIN */}
      {stage === 'signup' && (
        <>
          <div className="mb-8">
            <StepDots stage={stage} />
            <h1 className="text-2xl font-medium text-gray-900 mt-4">{isLogin ? 'Welcome back' : 'Create your account'}</h1>
            <p className="text-gray-500 text-sm mt-1">Your progress and playbook are saved to your account.</p>
          </div>
          {error && <div className="mb-5 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">{error}</div>}
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">Email address</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">Password {!isLogin && <span className="text-gray-400">(min 8 characters)</span>}</label>
              <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <button type="submit" className="w-full bg-indigo-600 text-white rounded-lg py-3 font-medium hover:bg-indigo-700 transition-colors">
              {isLogin ? 'Sign in →' : 'Create account →'}
            </button>
            <p className="text-center text-sm text-gray-500">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button type="button" onClick={() => { setIsLogin(!isLogin); setError(null); }} className="text-indigo-600 hover:underline">
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </form>
        </>
      )}

      {/* URLS */}
      {stage === 'urls' && (
        <>
          <div className="mb-6">
            <StepDots stage={stage} />
            <h1 className="text-2xl font-medium text-gray-900 mt-4">Your links</h1>
            <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-lg p-4 text-sm text-indigo-800">
              <strong className="font-medium">Why we ask for these:</strong> Providing your LinkedIn and company website lets our AI automatically fill in your product description, problem statement, and industry — saving you time and giving us richer data to work with.
            </div>
          </div>
          {error && <div className="mb-5 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">{error}</div>}
          <form onSubmit={handleUrls} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">Your LinkedIn URL <span className="text-red-400">*</span></label>
              <input type="url" required value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/yourname"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">Company website <span className="text-gray-400">(optional — enables auto-fill)</span></label>
              <input type="url" value={companyUrl} onChange={e => setCompanyUrl(e.target.value)} placeholder="https://yourcompany.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">Company LinkedIn <span className="text-gray-400">(optional — enables auto-fill)</span></label>
              <input type="url" value={companyLinkedin} onChange={e => setCompanyLinkedin(e.target.value)} placeholder="https://linkedin.com/company/yourcompany"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <button type="submit" className="w-full bg-indigo-600 text-white rounded-lg py-3 font-medium hover:bg-indigo-700 transition-colors">
              {(companyUrl || companyLinkedin) ? 'Fetch my details →' : 'Continue →'}
            </button>
          </form>
        </>
      )}

      {/* CONFIRM AUTO-FILLED DETAILS */}
      {stage === 'confirm' && (
        <>
          <div className="mb-6">
            <StepDots stage={stage} />
            <h1 className="text-2xl font-medium text-gray-900 mt-4">Confirm your details</h1>
            <p className="text-gray-500 text-sm mt-1">
              {enrichment ? 'We filled these in from your profile — edit anything that looks off.' : 'Tell us about your idea so we can score it accurately.'}
            </p>
          </div>
          {error && <div className="mb-5 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">{error}</div>}
          <form onSubmit={handleConfirm} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">
                What's your product or service?
                {enrichment && <span className="ml-2 text-xs text-indigo-500 font-medium">✦ Auto-filled</span>}
              </label>
              <input type="text" required value={productDescription} onChange={e => setProductDescription(e.target.value)}
                placeholder="e.g. AI scheduling tool for dental practices"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">
                What problem does it solve?
                {enrichment && <span className="ml-2 text-xs text-indigo-500 font-medium">✦ Auto-filled</span>}
              </label>
              <textarea required rows={3} value={problemSolved} onChange={e => setProblemSolved(e.target.value)}
                placeholder="Describe the specific pain your first customer feels."
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">
                Target industry
                {enrichment && <span className="ml-2 text-xs text-indigo-500 font-medium">✦ Auto-filled</span>}
              </label>
              <input type="text" value={industryFocus} onChange={e => setIndustryFocus(e.target.value)}
                placeholder="e.g. Healthcare, SaaS, Real Estate"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setStage('urls')} className="px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                ← Back
              </button>
              <button type="submit" className="flex-1 bg-indigo-600 text-white rounded-lg py-3 font-medium hover:bg-indigo-700 transition-colors">
                Screen my idea →
              </button>
            </div>
          </form>
        </>
      )}

      {/* SCORE RESULT */}
      {stage === 'score_ready' && score && (
        <>
          <div className="mb-6">
            <StepDots stage={stage} />
            <h1 className="text-2xl font-medium text-gray-900 mt-4">
              Your idea scored <span className="text-emerald-600">{score.overall_score} / 100</span>
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Best first target: <strong className="text-gray-700">{score.recommended_icp}</strong>
            </p>
          </div>

          <div className="space-y-3 mb-6">
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

          <div className="space-y-2 mb-6">
            {score.insights.map((ins, i) => (
              <div key={i} className={`flex gap-3 rounded-lg p-3 text-sm ${insightColor(ins.type)}`}>
                <span className="font-medium flex-shrink-0 mt-0.5">{insightIcon(ins.type)}</span>
                <span>{ins.text}</span>
              </div>
            ))}
          </div>

          <button onClick={buildPlaybook} className="w-full bg-indigo-600 text-white rounded-lg py-3 font-medium hover:bg-indigo-700 transition-colors">
            Build my GTM playbook →
          </button>
        </>
      )}

    </div>
  );
}
