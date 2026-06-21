import { useState } from 'react';

type Stage = 'signup' | 'urls' | 'enriching' | 'confirm' | 'scoring' | 'score_ready' | 'icp';

interface Account { id: string; email: string; }
interface ScoreResult {
  dimensions: Record<string, number>;
  overall_score: number;
  insights: Array<{ type: string; text: string }>;
  recommended_icp: string;
}

const STEPS = ['signup', 'urls', 'confirm', 'score_ready'];

function StepBar({ stage }: { stage: Stage }) {
  const idx = STEPS.indexOf(stage);
  return (
    <div className="flex gap-1.5 mb-8">
      {STEPS.map((_, i) => (
        <div key={i} className={`h-0.5 flex-1 rounded-full transition-all duration-300 ${i <= idx ? 'bg-teal' : 'bg-cream-dark'}`} />
      ))}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-ink-muted uppercase tracking-wide mb-2">{children}</label>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props}
      className="w-full bg-white border border-cream-dark rounded px-4 py-3 text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition-colors" />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props}
      className="w-full bg-white border border-cream-dark rounded px-4 py-3 text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition-colors resize-none" />
  );
}

function PrimaryBtn({ children, onClick, type = 'submit', disabled }: { children: React.ReactNode; onClick?: () => void; type?: 'submit' | 'button'; disabled?: boolean }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className="w-full bg-teal text-white text-sm font-medium px-6 py-3.5 rounded hover:bg-teal-light transition-colors disabled:opacity-50">
      {children}
    </button>
  );
}

function GhostBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="px-5 py-3.5 border border-cream-dark rounded text-sm text-ink-muted hover:bg-cream-dark transition-colors">
      {children}
    </button>
  );
}

function Spinner({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="max-w-lg mx-auto px-8 py-32 text-center">
      <div className="w-8 h-8 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto mb-8" />
      <p className="font-serif text-xl text-ink">{label}</p>
      {sub && <p className="text-sm text-ink-muted mt-2">{sub}</p>}
    </div>
  );
}

function AutoBadge() {
  return <span className="ml-2 text-xs bg-teal-pale text-teal px-2 py-0.5 rounded-sm font-medium">Auto-filled</span>;
}

export default function IntakeFlow() {
  const [stage, setStage] = useState<Stage>('signup');
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLogin, setIsLogin] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [companyUrl, setCompanyUrl] = useState('');
  const [companyLinkedin, setCompanyLinkedin] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [problemSolved, setProblemSolved] = useState('');
  const [industryFocus, setIndustryFocus] = useState('');
  const [enrichment, setEnrichment] = useState<Record<string, unknown> | null>(null);
  const [wasAutoFilled, setWasAutoFilled] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [score, setScore] = useState<ScoreResult | null>(null);

  const dimLabel: Record<string, string> = {
    market_demand: 'Market demand',
    icp_clarity: 'ICP clarity',
    differentiator_strength: 'Differentiator strength',
    sales_readiness: 'Sales readiness',
  };

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(isLogin ? '/api/auth/login' : '/api/auth/signup', {
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
    if (!linkedinUrl) { setError('Your LinkedIn URL is required'); return; }

    if (companyUrl || companyLinkedin) {
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
        setWasAutoFilled(true);
      }
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
      if (!sessionRes.ok) throw new Error((await sessionRes.json() as any).error ?? 'Session error');
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
      setScore(await scoreRes.json() as ScoreResult);
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
      body: JSON.stringify({ sessionId, enrichment: enrichment ?? {}, founderContext: `Product: ${productDescription}. Problem: ${problemSolved}. Industry: ${industryFocus}.` }),
    });
    const { icp } = await icpRes.json() as any;
    await fetch('/api/agents/playbook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, icp, founderContext: `Product: ${productDescription}. Problem: ${problemSolved}.` }),
    });
    window.location.href = `/dashboard?session=${sessionId}`;
  }

  if (stage === 'enriching') return <Spinner label="Reading your profile..." sub="Pulling company and founder data to auto-fill your details." />;
  if (stage === 'scoring') return <Spinner label="Screening your idea..." sub="Our AI is scoring market demand, ICP clarity, and sales readiness." />;
  if (stage === 'icp') return <Spinner label="Building your GTM playbook..." sub="This takes about 30 seconds." />;

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-lg mx-auto px-8 py-16">

        {/* SIGNUP */}
        {stage === 'signup' && (
          <>
            <StepBar stage={stage} />
            <p className="text-xs font-medium text-ink-muted uppercase tracking-widest mb-3">Your First Customer</p>
            <h1 className="font-serif text-3xl text-ink leading-tight mb-2">
              {isLogin ? 'Welcome back.' : 'Let\'s get you your first customer.'}
            </h1>
            <p className="text-sm text-ink-muted mb-8 leading-relaxed">
              {isLogin ? 'Sign in to access your dashboard and playbook.' : 'Create a free account. Your progress, playbook, and targets are saved so you can pick up where you left off.'}
            </p>

            {error && <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded text-sm text-red-700">{error}</div>}

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <Label>Email address</Label>
                <Input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
              </div>
              <div>
                <Label>Password {!isLogin && <span className="normal-case text-ink-faint font-normal tracking-normal">— min 8 characters</span>}</Label>
                <Input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="pt-1">
                <PrimaryBtn>{isLogin ? 'Sign in' : 'Create account'} →</PrimaryBtn>
              </div>
            </form>

            <p className="text-center text-sm text-ink-muted mt-6">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button type="button" onClick={() => { setIsLogin(!isLogin); setError(null); }} className="text-teal hover:underline">
                {isLogin ? 'Sign up free' : 'Sign in'}
              </button>
            </p>
          </>
        )}

        {/* URLS */}
        {stage === 'urls' && (
          <>
            <StepBar stage={stage} />
            <p className="text-xs font-medium text-ink-muted uppercase tracking-widest mb-3">Step 1 of 3</p>
            <h1 className="font-serif text-3xl text-ink leading-tight mb-2">Your links</h1>

            <div className="bg-teal-pale border border-teal/20 rounded p-4 mb-8">
              <p className="text-sm text-teal leading-relaxed">
                <strong className="font-medium">Why this speeds things up:</strong> Providing your company website and LinkedIn lets us auto-fill your product description, problem statement, and target industry — so you spend less time typing and more time closing.
              </p>
            </div>

            {error && <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded text-sm text-red-700">{error}</div>}

            <form onSubmit={handleUrls} className="space-y-4">
              <div>
                <Label>Your LinkedIn URL <span className="text-teal normal-case font-normal tracking-normal">required</span></Label>
                <Input type="url" required value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/yourname" />
              </div>
              <div>
                <Label>Company website <span className="text-ink-faint normal-case font-normal tracking-normal">optional · enables auto-fill</span></Label>
                <Input type="url" value={companyUrl} onChange={e => setCompanyUrl(e.target.value)} placeholder="https://yourcompany.com" />
              </div>
              <div>
                <Label>Company LinkedIn <span className="text-ink-faint normal-case font-normal tracking-normal">optional · enables auto-fill</span></Label>
                <Input type="url" value={companyLinkedin} onChange={e => setCompanyLinkedin(e.target.value)} placeholder="https://linkedin.com/company/yourcompany" />
              </div>
              <div className="pt-1">
                <PrimaryBtn>{(companyUrl || companyLinkedin) ? 'Fetch my details →' : 'Continue →'}</PrimaryBtn>
              </div>
            </form>
          </>
        )}

        {/* CONFIRM */}
        {stage === 'confirm' && (
          <>
            <StepBar stage={stage} />
            <p className="text-xs font-medium text-ink-muted uppercase tracking-widest mb-3">Step 2 of 3</p>
            <h1 className="font-serif text-3xl text-ink leading-tight mb-2">
              {wasAutoFilled ? 'We filled in the details.' : 'Tell us about your idea.'}
            </h1>
            <p className="text-sm text-ink-muted mb-8 leading-relaxed">
              {wasAutoFilled ? 'Review and edit anything that looks off — this shapes your score and playbook.' : 'Be specific. The more concrete you are, the sharper your playbook.'}
            </p>

            {error && <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded text-sm text-red-700">{error}</div>}

            <form onSubmit={handleConfirm} className="space-y-5">
              <div>
                <Label>Product or service {wasAutoFilled && <AutoBadge />}</Label>
                <Input type="text" required value={productDescription} onChange={e => setProductDescription(e.target.value)} placeholder="e.g. AI scheduling tool for dental practices" />
              </div>
              <div>
                <Label>Problem you solve {wasAutoFilled && <AutoBadge />}</Label>
                <Textarea required rows={4} value={problemSolved} onChange={e => setProblemSolved(e.target.value)} placeholder="Describe the specific pain your first customer feels. Include numbers if you have them." />
              </div>
              <div>
                <Label>Target industry {wasAutoFilled && <AutoBadge />}</Label>
                <Input type="text" value={industryFocus} onChange={e => setIndustryFocus(e.target.value)} placeholder="e.g. Healthcare, SaaS, Real Estate" />
              </div>
              <div className="flex gap-3 pt-1">
                <GhostBtn onClick={() => setStage('urls')}>← Back</GhostBtn>
                <div className="flex-1">
                  <PrimaryBtn>Screen my idea →</PrimaryBtn>
                </div>
              </div>
            </form>
          </>
        )}

        {/* SCORE */}
        {stage === 'score_ready' && score && (
          <>
            <StepBar stage={stage} />
            <p className="text-xs font-medium text-ink-muted uppercase tracking-widest mb-3">Step 3 of 3</p>
            <h1 className="font-serif text-3xl text-ink leading-tight mb-1">
              Your idea scored <span className="text-teal">{score.overall_score}/100</span>
            </h1>
            <p className="text-sm text-ink-muted mb-8 leading-relaxed">
              Best first target: <span className="text-ink font-medium">{score.recommended_icp}</span>
            </p>

            <div className="space-y-4 mb-8">
              {Object.entries(score.dimensions).map(([key, val]) => (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-ink-muted">{dimLabel[key] ?? key}</span>
                    <span className="font-medium text-ink">{val}</span>
                  </div>
                  <div className="h-1 bg-cream-dark rounded-full">
                    <div
                      className={`h-1 rounded-full transition-all duration-500 ${val >= 75 ? 'bg-teal' : val >= 55 ? 'bg-amber-400' : 'bg-red-400'}`}
                      style={{ width: `${val}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 mb-8">
              {score.insights.map((ins, i) => {
                const styles = ins.type === 'strength'
                  ? 'bg-teal-pale border-teal/20 text-teal'
                  : ins.type === 'warning'
                  ? 'bg-amber-50 border-amber-100 text-amber-800'
                  : 'bg-cream-dark border-cream-dark text-ink-muted';
                const icon = ins.type === 'strength' ? '✓' : ins.type === 'warning' ? '⚠' : '→';
                return (
                  <div key={i} className={`flex gap-3 border rounded p-4 text-sm leading-relaxed ${styles}`}>
                    <span className="font-medium flex-shrink-0">{icon}</span>
                    <span>{ins.text}</span>
                  </div>
                );
              })}
            </div>

            <PrimaryBtn type="button" onClick={buildPlaybook}>Build my GTM playbook →</PrimaryBtn>
          </>
        )}

      </div>
    </div>
  );
}
