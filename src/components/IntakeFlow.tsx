import { useState, useRef } from 'react';

type Stage =
  | 'signup'
  | 'urls'
  | 'enriching'
  | 'confirm'
  | 'scoring'
  | 'score_ready'
  | 'icp_review'
  | 'icp_building';

interface Account { id: string; email: string; }

interface ScoreResult {
  dimensions: Record<string, number>;
  overall_score: number;
  insights: Array<{ type: string; text: string }>;
  recommended_icp: string;
  team_analysis?: {
    credibility_score: number;
    strengths: string[];
    gaps: string[];
    signal: string;
  };
}

interface ICPHints {
  persona_title: string;
  persona_seniority: string;
  industries: string;
  employee_min: string;
  employee_max: string;
  sales_motion: string;
  deal_min: string;
  deal_max: string;
}

const STAGE_ORDER: Stage[] = ['signup', 'urls', 'confirm', 'score_ready', 'icp_review'];
const STEP_LABELS = ['Account', 'Links', 'Confirm', 'Screening', 'ICP'];

function StepBar({ stage }: { stage: Stage }) {
  const idx = STAGE_ORDER.indexOf(stage);
  return (
    <div className="flex items-start gap-1.5 mb-8">
      {STEP_LABELS.map((label, i) => (
        <div key={i} className="flex-1 flex flex-col gap-1">
          <div className={`h-0.5 rounded-full transition-all duration-300 ${i <= idx ? 'bg-teal' : 'bg-cream-dark'}`} />
          <span className={`text-[10px] uppercase tracking-wide ${i <= idx ? 'text-teal' : 'text-ink-faint'}`}>{label}</span>
        </div>
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

function SelectInput({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props}
      className="w-full bg-white border border-cream-dark rounded px-4 py-3 text-sm text-ink focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition-colors">
      {children}
    </select>
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props}
      className="w-full bg-white border border-cream-dark rounded px-4 py-3 text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition-colors resize-none" />
  );
}

function PrimaryBtn({ children, onClick, type = 'submit', disabled }: {
  children: React.ReactNode; onClick?: () => void; type?: 'submit' | 'button'; disabled?: boolean;
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className="w-full bg-teal text-white text-sm font-medium px-6 py-3.5 rounded hover:bg-teal-light transition-colors disabled:opacity-40">
      {children}
    </button>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors mb-6">
      ← Back
    </button>
  );
}

function AutoBadge() {
  return <span className="ml-2 text-[10px] bg-teal-pale text-teal px-2 py-0.5 rounded-sm font-medium uppercase tracking-wide">Auto-filled</span>;
}

function Spinner({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="max-w-lg mx-auto px-8 py-32 text-center">
      <div className="w-8 h-8 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto mb-8" />
      <p className="font-serif text-xl text-ink">{label}</p>
      {sub && <p className="text-sm text-ink-muted mt-2 leading-relaxed">{sub}</p>}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded text-sm text-red-700 leading-relaxed">{message}</div>;
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
  const [wasAutoFilled, setWasAutoFilled] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [deckFile, setDeckFile] = useState<File | null>(null);
  const [deckContext, setDeckContext] = useState('');
  const [deckParsing, setDeckParsing] = useState(false);

  const [enrichment, setEnrichment] = useState<Record<string, unknown> | null>(null);
  const [teamData, setTeamData] = useState<any[]>([]);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [score, setScore] = useState<ScoreResult | null>(null);
  const [showTeam, setShowTeam] = useState(false);

  const [sessionName, setSessionName] = useState('');

  const [icpHints, setIcpHints] = useState<ICPHints>({
    persona_title: '',
    persona_seniority: '',
    industries: '',
    employee_min: '',
    employee_max: '',
    sales_motion: '',
    deal_min: '',
    deal_max: '',
  });

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

  async function handleDeckChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDeckFile(file);
    setDeckParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const res = await fetch('/api/agents/parse-deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: base64, mediaType: 'application/pdf' }),
      });
      const data = await res.json() as any;
      if (res.ok) setDeckContext(data.context ?? '');
    } catch { /* deck is optional */ }
    setDeckParsing(false);
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
        setTeamData(data.teamData ?? []);
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
          session_name: sessionName || productDescription || 'Untitled session',
        }),
      });
      if (!sessionRes.ok) throw new Error((await sessionRes.json() as any).error ?? 'Session error');
      const { sessionId: sid, enrichment: enr } = await sessionRes.json() as any;
      setSessionId(sid);
      const finalEnrichment = enrichment ?? enr ?? {};
      if (enr) setEnrichment(finalEnrichment);

      const founderContext = `Product: ${productDescription}. Problem: ${problemSolved}. Industry: ${industryFocus}.`;

      const scoreRes = await fetch('/api/agents/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sid,
          founderContext,
          enrichment: finalEnrichment,
          deckContext: deckContext || undefined,
          teamData: teamData.length ? teamData : undefined,
        }),
      });
      if (!scoreRes.ok) throw new Error((await scoreRes.json() as any).error ?? 'Scoring failed');
      setScore(await scoreRes.json() as ScoreResult);
      setStage('score_ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStage('confirm');
    }
  }

  async function handleIcpReview(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId) return;
    setError(null);
    setStage('icp_building');
    try {

    const founderContext = `Product: ${productDescription}. Problem: ${problemSolved}. Industry: ${industryFocus}.`;

    const hints: Record<string, unknown> = {};
    if (icpHints.persona_title) hints.persona_title = icpHints.persona_title;
    if (icpHints.persona_seniority) hints.persona_seniority = icpHints.persona_seniority;
    if (icpHints.industries) hints.industries = icpHints.industries;
    if (icpHints.employee_min) hints.employee_min = Number(icpHints.employee_min);
    if (icpHints.employee_max) hints.employee_max = Number(icpHints.employee_max);
    if (icpHints.sales_motion) hints.sales_motion = icpHints.sales_motion;
    if (icpHints.deal_min) hints.deal_min = Number(icpHints.deal_min);
    if (icpHints.deal_max) hints.deal_max = Number(icpHints.deal_max);

    // Step 1: Build ICP
    const icpRes = await fetch('/api/agents/icp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        enrichment: enrichment ?? {},
        founderContext,
        userHints: Object.keys(hints).length ? hints : undefined,
      }),
    });
    const icpData = await icpRes.json() as any;

    if (!icpRes.ok || icpData.error || !icpData.icp) {
      setError(icpData.error ?? 'ICP generation failed — please try again.');
      setStage('icp_review');
      return;
    }

    // Step 2: Build GTM playbook using the ICP
    const playbookRes = await fetch('/api/agents/playbook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, icp: icpData.icp, founderContext }),
    });
    const playbookData = await playbookRes.json() as any;

    if (!playbookRes.ok || playbookData.error) {
      setError(playbookData.error ?? 'Playbook generation failed — please try again.');
      setStage('icp_review');
      return;
    }

    window.location.href = `/dashboard?session=${sessionId}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong building your playbook. Please try again.');
      setStage('icp_review');
    }
  }

  if (stage === 'enriching') return <Spinner label="Gathering your profile..." sub="We're pulling together everything we can find about you and your company. This takes a few seconds." />;
  if (stage === 'scoring') return <Spinner label="Screening your idea..." sub="Analysing market demand, ICP clarity, team signals, and differentiators. Usually about 15 seconds." />;
  if (stage === 'icp_building') return <Spinner label="Building your GTM playbook..." sub="Creating your ideal customer profile, outbound sequences, and 4-week action plan. Hang tight." />;

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-lg mx-auto px-8 py-14">

        {/* SIGNUP */}
        {stage === 'signup' && (
          <>
            <StepBar stage={stage} />
            <p className="text-xs font-medium text-ink-muted uppercase tracking-widest mb-3">Your First Customer</p>
            <h1 className="font-serif text-3xl text-ink leading-tight mb-2">
              {isLogin ? 'Welcome back.' : "Let's land your first customer."}
            </h1>
            <p className="text-sm text-ink-muted mb-8 leading-relaxed">
              {isLogin
                ? 'Sign in to access your dashboard and GTM playbook.'
                : 'Create a free account. Your playbook and targets are saved so you can pick up where you left off.'}
            </p>

            {error && <ErrorBox message={error} />}

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <Label>Email address</Label>
                <Input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
              </div>
              <div>
                <Label>Password {!isLogin && <span className="normal-case text-ink-faint font-normal tracking-normal ml-1">min 8 characters</span>}</Label>
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
            <BackBtn onClick={() => { setError(null); setStage('signup'); }} />
            <p className="text-xs font-medium text-ink-muted uppercase tracking-widest mb-3">Step 1 of 4</p>
            <h1 className="font-serif text-3xl text-ink leading-tight mb-2">Your links</h1>

            <div className="bg-teal-pale border border-teal/20 rounded p-4 mb-8">
              <p className="text-sm text-teal leading-relaxed">
                <strong className="font-medium">Why this helps:</strong> The more we know about you and your company, the smarter your screening and the sharper your GTM playbook will be. Everything is optional except your LinkedIn.
              </p>
            </div>

            {error && <ErrorBox message={error} />}

            <form onSubmit={handleUrls} className="space-y-4">
              <div>
                <Label>Session name <span className="text-ink-faint normal-case font-normal tracking-normal ml-1">e.g. "AlignWorks GTM" or "Stealth Fintech"</span></Label>
                <Input type="text" value={sessionName} onChange={e => setSessionName(e.target.value)} placeholder="Name this venture or session" />
              </div>
              <div>
                <Label>Your LinkedIn URL <span className="text-teal normal-case font-normal tracking-normal ml-1">required</span></Label>
                <Input type="url" required value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/yourname" />
              </div>
              <div>
                <Label>Company website <span className="text-ink-faint normal-case font-normal tracking-normal ml-1">optional</span></Label>
                <Input type="url" value={companyUrl} onChange={e => setCompanyUrl(e.target.value)} placeholder="https://yourcompany.com" />
              </div>
              <div>
                <Label>Company LinkedIn <span className="text-ink-faint normal-case font-normal tracking-normal ml-1">optional</span></Label>
                <Input type="url" value={companyLinkedin} onChange={e => setCompanyLinkedin(e.target.value)} placeholder="https://linkedin.com/company/yourcompany" />
              </div>

              <div className="border-t border-cream-dark pt-5">
                <Label>
                  Business deck or pitch PDF
                  <span className="text-ink-faint normal-case font-normal tracking-normal ml-1">optional · gives richer screening context</span>
                </Label>
                <div
                  className={`border-2 border-dashed rounded p-6 text-center cursor-pointer transition-colors ${deckFile ? 'border-teal bg-teal-pale' : 'border-cream-dark hover:border-teal/40'}`}
                  onClick={() => fileRef.current?.click()}
                >
                  <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleDeckChange} />
                  {deckParsing ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-teal">
                      <div className="w-4 h-4 border-2 border-teal border-t-transparent rounded-full animate-spin" />
                      Reading deck…
                    </div>
                  ) : deckFile ? (
                    <>
                      <p className="text-sm font-medium text-teal">{deckFile.name}</p>
                      <p className="text-xs text-teal/70 mt-1">Deck parsed ✓ — context will be used in screening</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-ink-muted">Click to upload PDF</p>
                      <p className="text-xs text-ink-faint mt-1">Pitch decks, one-pagers, product overviews</p>
                    </>
                  )}
                </div>
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
            <BackBtn onClick={() => { setError(null); setStage('urls'); }} />
            <p className="text-xs font-medium text-ink-muted uppercase tracking-widest mb-3">Step 2 of 4</p>
            <h1 className="font-serif text-3xl text-ink leading-tight mb-2">
              {wasAutoFilled ? 'We filled in the details.' : 'Tell us about your idea.'}
            </h1>
            <p className="text-sm text-ink-muted mb-8 leading-relaxed">
              {wasAutoFilled
                ? 'Review and edit anything that looks off — this shapes your score and playbook.'
                : 'Be specific. The more concrete you are, the sharper your playbook.'}
            </p>

            {error && <ErrorBox message={error} />}

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

              {deckContext && (
                <div className="bg-teal-pale border border-teal/20 rounded p-4">
                  <p className="text-xs font-medium text-teal uppercase tracking-wide mb-1">Deck summary included ✓</p>
                  <p className="text-xs text-teal/80 leading-relaxed line-clamp-3">{deckContext}</p>
                </div>
              )}

              <div className="pt-1">
                <PrimaryBtn>Screen my idea →</PrimaryBtn>
              </div>
            </form>
          </>
        )}

        {/* SCORE READY */}
        {stage === 'score_ready' && score && (
          <>
            <StepBar stage={stage} />
            <p className="text-xs font-medium text-ink-muted uppercase tracking-widest mb-3">Step 3 of 4</p>
            <h1 className="font-serif text-3xl text-ink leading-tight mb-1">
              Idea scored <span className="text-teal">{score.overall_score}/100</span>
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
                      className={`h-1 rounded-full transition-all duration-700 ${val >= 75 ? 'bg-teal' : val >= 55 ? 'bg-amber-400' : 'bg-red-400'}`}
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

            {/* Team insights — collapsible */}
            {score.team_analysis && (
              <div className="mb-8">
                <button
                  type="button"
                  onClick={() => setShowTeam(t => !t)}
                  className="flex items-center justify-between w-full py-3 border-t border-b border-cream-dark text-sm hover:bg-cream-dark/40 transition-colors px-1 rounded"
                >
                  <span>
                    <span className="font-medium text-ink">Team analysis</span>
                    <span className="text-ink-muted ml-2">— credibility {score.team_analysis.credibility_score}/100</span>
                  </span>
                  <span className="text-xs text-ink-faint">{showTeam ? '▲ Hide' : '▼ Show'}</span>
                </button>

                {showTeam && (
                  <div className="pt-4 space-y-4">
                    <p className="text-sm text-ink italic leading-relaxed">"{score.team_analysis.signal}"</p>

                    {score.team_analysis.strengths.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-ink-faint uppercase tracking-widest mb-2">Strengths</p>
                        <ul className="space-y-1.5">
                          {score.team_analysis.strengths.map((s, i) => (
                            <li key={i} className="text-sm text-ink flex gap-2.5">
                              <span className="text-teal flex-shrink-0 mt-0.5">✓</span>{s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {score.team_analysis.gaps.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-ink-faint uppercase tracking-widest mb-2">Gaps to watch</p>
                        <ul className="space-y-1.5">
                          {score.team_analysis.gaps.map((g, i) => (
                            <li key={i} className="text-sm text-ink-muted flex gap-2.5">
                              <span className="text-amber-500 flex-shrink-0 mt-0.5">⚠</span>{g}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {teamData.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-ink-faint uppercase tracking-widest mb-2">Leadership found</p>
                        <div className="space-y-2">
                          {teamData.slice(0, 5).map((p: any, i: number) => {
                            const name = (p.name ?? `${p.first_name ?? ''} ${p.last_name ?? ''}`).trim();
                            return (
                              <div key={i} className="flex items-center gap-3 bg-white border border-cream-dark rounded px-4 py-2.5">
                                <div className="w-7 h-7 rounded-full bg-cream-dark flex items-center justify-center text-xs font-medium text-ink-muted flex-shrink-0">
                                  {name[0] ?? '?'}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-ink truncate">{name}</p>
                                  <p className="text-xs text-ink-faint truncate">{p.title}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <PrimaryBtn type="button" onClick={() => setStage('icp_review')}>
              Refine my ICP &amp; build playbook →
            </PrimaryBtn>
          </>
        )}

        {/* ICP REVIEW */}
        {stage === 'icp_review' && (
          <>
            <StepBar stage={stage} />
            <BackBtn onClick={() => setStage('score_ready')} />
            <p className="text-xs font-medium text-ink-muted uppercase tracking-widest mb-3">Step 4 of 4</p>
            <h1 className="font-serif text-3xl text-ink leading-tight mb-2">Refine your ICP</h1>
            <p className="text-sm text-ink-muted mb-8 leading-relaxed">
              Our AI will auto-build your ideal customer profile and playbook. Override any field below to steer it — or leave everything blank to let the AI decide from your data.
            </p>

            {error && <ErrorBox message={error} />}
            <form onSubmit={handleIcpReview} className="space-y-5">
              {/* Persona */}
              <div className="border border-cream-dark rounded p-5 space-y-4">
                <p className="text-xs font-medium text-ink-faint uppercase tracking-widest">Buyer persona</p>
                <div>
                  <Label>Job title <span className="text-ink-faint normal-case font-normal tracking-normal ml-1">optional — overrides AI</span></Label>
                  <Input
                    type="text"
                    value={icpHints.persona_title}
                    onChange={e => setIcpHints(h => ({ ...h, persona_title: e.target.value }))}
                    placeholder="e.g. Head of Revenue Operations"
                  />
                </div>
                <div>
                  <Label>Seniority <span className="text-ink-faint normal-case font-normal tracking-normal ml-1">optional — overrides AI</span></Label>
                  <SelectInput
                    value={icpHints.persona_seniority}
                    onChange={e => setIcpHints(h => ({ ...h, persona_seniority: e.target.value }))}
                  >
                    <option value="">AI decides</option>
                    <option value="C-Suite">C-Suite (CEO, CTO, CMO…)</option>
                    <option value="VP">VP level</option>
                    <option value="Director">Director level</option>
                    <option value="Manager">Manager level</option>
                    <option value="IC">Individual contributor</option>
                  </SelectInput>
                </div>
              </div>

              {/* Company */}
              <div className="border border-cream-dark rounded p-5 space-y-4">
                <p className="text-xs font-medium text-ink-faint uppercase tracking-widest">Target company</p>
                <div>
                  <Label>Industries <span className="text-ink-faint normal-case font-normal tracking-normal ml-1">comma-separated · optional</span></Label>
                  <Input
                    type="text"
                    value={icpHints.industries}
                    onChange={e => setIcpHints(h => ({ ...h, industries: e.target.value }))}
                    placeholder="e.g. SaaS, Healthcare, Fintech"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Min employees</Label>
                    <Input
                      type="number"
                      value={icpHints.employee_min}
                      onChange={e => setIcpHints(h => ({ ...h, employee_min: e.target.value }))}
                      placeholder="e.g. 50"
                    />
                  </div>
                  <div>
                    <Label>Max employees</Label>
                    <Input
                      type="number"
                      value={icpHints.employee_max}
                      onChange={e => setIcpHints(h => ({ ...h, employee_max: e.target.value }))}
                      placeholder="e.g. 500"
                    />
                  </div>
                </div>
              </div>

              {/* Deal */}
              <div className="border border-cream-dark rounded p-5 space-y-4">
                <p className="text-xs font-medium text-ink-faint uppercase tracking-widest">Deal parameters</p>
                <div>
                  <Label>Sales motion <span className="text-ink-faint normal-case font-normal tracking-normal ml-1">optional — overrides AI</span></Label>
                  <SelectInput
                    value={icpHints.sales_motion}
                    onChange={e => setIcpHints(h => ({ ...h, sales_motion: e.target.value }))}
                  >
                    <option value="">AI decides</option>
                    <option value="self-serve">Self-serve (product-led)</option>
                    <option value="assisted">Assisted (founder-led)</option>
                    <option value="enterprise">Enterprise (sales-led)</option>
                  </SelectInput>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Min deal (USD)</Label>
                    <Input
                      type="number"
                      value={icpHints.deal_min}
                      onChange={e => setIcpHints(h => ({ ...h, deal_min: e.target.value }))}
                      placeholder="1000"
                    />
                  </div>
                  <div>
                    <Label>Max deal (USD)</Label>
                    <Input
                      type="number"
                      value={icpHints.deal_max}
                      onChange={e => setIcpHints(h => ({ ...h, deal_max: e.target.value }))}
                      placeholder="10000"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-1">
                <PrimaryBtn>Build my GTM playbook →</PrimaryBtn>
              </div>
            </form>
          </>
        )}

      </div>
    </div>
  );
}
