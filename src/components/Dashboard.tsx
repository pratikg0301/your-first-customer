import { useEffect, useState } from 'react';

interface SessionState {
  name: string;
  stage: string;
  score: number | null;
  score_details: any;
  founder_context: string | null;
  linkedin_url: string | null;
  company_url: string | null;
  icp: any;
  playbook: any;
  targets: any[];
  enrichment: any;
}

const PIPELINE_STAGES = [
  { key: 'enriched', label: 'Profile enriched' },
  { key: 'icp_ready', label: 'ICP built' },
  { key: 'playbook_ready', label: 'Playbook ready' },
  { key: 'outbound_active', label: 'Outbound live' },
  { key: 'closed', label: 'First customer closed' },
];

type Tab = 'overview' | 'motions' | 'plan' | 'playbook' | 'execution' | 'emails' | 'targets';

export default function Dashboard() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  useEffect(() => {
    const sid = new URLSearchParams(window.location.search).get('session');
    if (!sid) { setLoading(false); return; }
    setSessionId(sid);
    fetch(`/api/session/${sid}`)
      .then(r => r.json())
      .then((data: any) => { setSession(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="max-w-2xl mx-auto px-8 py-24 text-center">
      <div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  );

  if (!session || !sessionId) return (
    <div className="max-w-2xl mx-auto px-8 py-24 text-center">
      <p className="text-ink-muted text-sm">No active session found.</p>
      <a href="/" className="mt-4 inline-block text-teal text-sm hover:underline">Start here →</a>
    </div>
  );

  const stageIdx = PIPELINE_STAGES.findIndex(s => s.key === session.stage);
  const icp = session.icp;
  const playbook = session.playbook;
  const targets = session.targets ?? [];
  const motions = playbook?.gtm_motions ?? [];
  const recommendedMotions = motions.filter((m: any) => m.recommended).sort((a: any, b: any) => a.priority - b.priority);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'motions', label: 'GTM Motions' },
    { key: 'plan', label: 'First Customer Plan' },
    { key: 'playbook', label: '30-Day Playbook' },
    { key: 'execution', label: 'Execution Inputs' },
    { key: 'emails', label: 'Templates' },
    { key: 'targets', label: `Targets${targets.length ? ` (${targets.length})` : ''}` },
  ];

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-2xl mx-auto px-8 py-12">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-ink-muted uppercase tracking-widest mb-2">Your First Customer</p>
            <h1 className="font-serif text-3xl text-ink leading-tight">{session.name || 'GTM Dashboard'}</h1>
            <p className="text-xs text-ink-faint mt-1 font-mono">session {sessionId.slice(0, 8)}</p>
          </div>
          <div className="flex flex-col items-end gap-2 mt-1">
            <a href="/sessions" className="text-sm text-ink-muted hover:text-ink transition-colors">← All sessions</a>
            <a href={`/?resume=${sessionId}`} className="text-xs text-teal hover:underline transition-colors">Edit & re-run →</a>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard value={session.score ?? '—'} label="Readiness score" accent={!!session.score} />
          <StatCard value={targets.length} label="Targets found" />
          <StatCard value={`${Math.max(0, stageIdx + 1)}/5`} label="Milestones" />
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-0 border-b border-cream-dark mb-8 -mx-1">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-3 text-sm transition-colors border-b-2 -mb-px mx-1 ${activeTab === t.key ? 'border-teal text-teal font-medium' : 'border-transparent text-ink-muted hover:text-ink'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ─────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <Section label="Pipeline progress">
              <div className="space-y-3">
                {PIPELINE_STAGES.map((s, i) => {
                  const done = i <= stageIdx;
                  const active = i === stageIdx + 1;
                  return (
                    <div key={s.key} className="flex items-center gap-4">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${done ? 'bg-teal text-white' : active ? 'bg-teal-pale text-teal' : 'bg-cream-dark text-ink-faint'}`}>
                        {done ? '✓' : i + 1}
                      </div>
                      <span className={`text-sm ${done ? 'text-ink font-medium' : active ? 'text-teal' : 'text-ink-faint'}`}>{s.label}</span>
                    </div>
                  );
                })}
              </div>
            </Section>

            {session.score_details && (
              <Section label="Screening score breakdown">
                <div className="space-y-3 mb-4">
                  {Object.entries(session.score_details.dimensions ?? {}).map(([key, val]: [string, any]) => {
                    const labels: Record<string, string> = {
                      market_demand: 'Market demand', icp_clarity: 'ICP clarity',
                      differentiator_strength: 'Differentiator strength', sales_readiness: 'Sales readiness',
                    };
                    return (
                      <div key={key}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-ink-muted">{labels[key] ?? key}</span>
                          <span className="font-medium text-ink">{val}</span>
                        </div>
                        <div className="h-1 bg-cream-dark rounded-full">
                          <div className={`h-1 rounded-full ${val >= 75 ? 'bg-teal' : val >= 55 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${val}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {session.score_details.insights?.map((ins: any, i: number) => {
                  const styles = ins.type === 'strength' ? 'bg-teal-pale border-teal/20 text-teal' : ins.type === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-800' : 'bg-cream-dark border-cream-dark text-ink-muted';
                  const icon = ins.type === 'strength' ? '✓' : ins.type === 'warning' ? '⚠' : '→';
                  return (
                    <div key={i} className={`flex gap-3 border rounded p-3 text-xs leading-relaxed mb-2 ${styles}`}>
                      <span className="font-medium flex-shrink-0">{icon}</span><span>{ins.text}</span>
                    </div>
                  );
                })}
              </Section>
            )}

            {icp && (
              <Section label="Your ICP">
                <div className="space-y-3 text-sm">
                  <IcpRow label="Target buyer" value={`${icp.persona?.title} · ${icp.persona?.seniority}`} />
                  <IcpRow label="Industries" value={icp.company_profile?.industries?.join(', ')} />
                  <IcpRow label="Company size" value={`${icp.company_profile?.employee_range?.min}–${icp.company_profile?.employee_range?.max} employees`} />
                  <IcpRow label="Deal size" value={`$${icp.deal_size_usd?.min?.toLocaleString()} – $${icp.deal_size_usd?.max?.toLocaleString()}`} />
                  <IcpRow label="Sales motion" value={icp.sales_motion} capitalize />
                  <IcpRow label="Sales cycle" value={`${icp.sales_cycle_days?.min}–${icp.sales_cycle_days?.max} days`} />
                </div>
                {icp.fit_reasoning && (
                  <p className="text-sm text-ink-muted leading-relaxed mt-4 pt-4 border-t border-cream-dark italic">
                    "{icp.fit_reasoning}"
                  </p>
                )}
              </Section>
            )}

            {icp?.objections?.length > 0 && (
              <Section label="Top objections & responses">
                <div className="space-y-4">
                  {icp.objections.map((o: any, i: number) => (
                    <div key={i} className="text-sm">
                      <p className="font-medium text-ink mb-1">"{o.objection}"</p>
                      <p className="text-ink-muted leading-relaxed">→ {o.response}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {recommendedMotions.length > 0 && (
              <Section label="Top GTM motions">
                <div className="space-y-2">
                  {recommendedMotions.slice(0, 3).map((m: any) => (
                    <div key={m.motion} className="flex items-start gap-3 bg-teal-pale border border-teal/20 rounded p-3">
                      <span className="text-teal font-medium text-xs mt-0.5 flex-shrink-0">#{m.priority}</span>
                      <div>
                        <p className="text-sm font-medium text-ink">{m.motion}</p>
                        <p className="text-xs text-ink-muted mt-0.5">{m.why_fits}</p>
                      </div>
                      <span className="ml-auto text-xs font-medium text-teal flex-shrink-0">{m.fit_score}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => setActiveTab('motions')} className="text-xs text-teal hover:underline mt-3 block">
                  See all {motions.length} motions →
                </button>
              </Section>
            )}
          </div>
        )}

        {/* ── GTM MOTIONS ───────────────────────────────────────────────── */}
        {activeTab === 'motions' && (
          <div>
            {!playbook ? <Empty label="Playbook not ready yet. Complete the ICP step to generate." /> : (
              <div className="space-y-3">
                <p className="text-sm text-ink-muted mb-4">All GTM motions evaluated for your specific product and ICP, ranked by fit.</p>
                {[...motions].sort((a: any, b: any) => a.priority - b.priority).map((m: any) => (
                  <MotionCard key={m.motion} motion={m} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── FIRST CUSTOMER PLAN ──────────────────────────────────────── */}
        {activeTab === 'plan' && (
          <div>
            {!playbook?.first_customer_plan ? <Empty label="Playbook not ready yet." /> : (
              <div className="space-y-5">
                {(() => {
                  const plan = playbook.first_customer_plan;
                  return (
                    <>
                      <div className="bg-white border border-cream-dark rounded p-6">
                        <p className="text-xs font-medium text-ink-faint uppercase tracking-widest mb-3">Target segment</p>
                        <p className="text-sm font-medium text-ink leading-relaxed">{plan.target_segment}</p>
                      </div>

                      <div className="bg-white border border-cream-dark rounded p-6">
                        <p className="text-xs font-medium text-ink-faint uppercase tracking-widest mb-3">Approach</p>
                        <p className="text-sm text-ink leading-relaxed">{plan.approach}</p>
                      </div>

                      <div className="bg-white border border-cream-dark rounded p-6">
                        <p className="text-xs font-medium text-ink-faint uppercase tracking-widest mb-4">
                          Milestone plan — {plan.timeline_days} days
                        </p>
                        <div className="relative">
                          <div className="absolute left-3 top-0 bottom-0 w-px bg-cream-dark" />
                          <div className="space-y-5">
                            {plan.milestones?.map((m: any, i: number) => (
                              <div key={i} className="flex gap-5 pl-8 relative">
                                <div className="absolute left-0 w-6 h-6 rounded-full bg-cream-dark flex items-center justify-center text-xs font-medium text-ink-muted">
                                  {m.day}
                                </div>
                                <div>
                                  <p className="text-xs text-ink-faint mb-0.5">Day {m.day}</p>
                                  <p className="text-sm text-ink">{m.milestone}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="border-l-2 border-teal bg-teal-pale rounded-r p-5">
                        <p className="text-xs font-medium text-teal uppercase tracking-wide mb-2">Success looks like</p>
                        <p className="text-sm text-ink leading-relaxed">{plan.success_criteria}</p>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ── 30-DAY PLAYBOOK ───────────────────────────────────────────── */}
        {activeTab === 'playbook' && (
          <div>
            {!playbook ? <Empty label="Playbook not ready yet." /> : (
              <div className="space-y-6">
                {(['week1', 'week2', 'week3', 'week4'] as const).map((week, wi) => {
                  const actions = playbook[week];
                  if (!Array.isArray(actions) || !actions.length) return null;
                  return (
                    <div key={week}>
                      <p className="text-xs font-medium text-ink-faint uppercase tracking-widest mb-3">Week {wi + 1}</p>
                      <div className="space-y-3">
                        {actions.map((a: any, i: number) => (
                          <div key={i} className="bg-white border border-cream-dark rounded p-5">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <p className="text-sm font-medium text-ink leading-snug">{a.title}</p>
                              <span className="text-xs bg-cream text-ink-muted px-2.5 py-1 rounded-sm flex-shrink-0 whitespace-nowrap">{a.day_range}</span>
                            </div>
                            <p className="text-sm text-ink-muted leading-relaxed">{a.description}</p>
                            <div className="flex gap-2 mt-3">
                              <Chip color="teal">{a.channel}</Chip>
                              <Chip color="neutral">{a.owner}</Chip>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {playbook.pilot_offer && (
                  <div className="border-l-2 border-teal bg-teal-pale rounded-r p-5">
                    <p className="text-xs font-medium text-teal uppercase tracking-wide mb-2">Pilot offer</p>
                    <p className="text-sm text-ink leading-relaxed">{playbook.pilot_offer}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── EXECUTION INPUTS ─────────────────────────────────────────── */}
        {activeTab === 'execution' && (
          <div>
            {!playbook?.execution_inputs_needed ? <Empty label="Playbook not ready yet." /> : (
              <div className="space-y-6">
                <p className="text-sm text-ink-muted leading-relaxed">
                  Before you start execution, make sure you have everything below in place. Prioritise <span className="font-medium text-ink">required</span> items first.
                </p>
                {playbook.execution_inputs_needed.map((group: any) => (
                  <div key={group.category}>
                    <p className="text-xs font-medium text-ink-faint uppercase tracking-widest mb-3">{group.category}</p>
                    <div className="space-y-2">
                      {group.items?.map((item: any, i: number) => (
                        <div key={i} className="bg-white border border-cream-dark rounded p-4 flex items-start gap-4">
                          <PriorityDot priority={item.priority} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink">{item.name}</p>
                            <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">{item.why}</p>
                          </div>
                          <PriorityBadge priority={item.priority} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── EMAIL TEMPLATES ───────────────────────────────────────────── */}
        {activeTab === 'emails' && (
          <div>
            {!playbook ? <Empty label="Playbook not ready yet." /> : (
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-medium text-ink-faint uppercase tracking-widest mb-3">Cold email</p>
                  <div className="bg-white border border-cream-dark rounded p-6">
                    <p className="text-xs text-ink-faint mb-1">Subject line</p>
                    <p className="text-sm font-medium text-ink mb-5">{playbook.email_subject}</p>
                    <p className="text-xs text-ink-faint mb-2">Body</p>
                    <pre className="text-sm text-ink-muted whitespace-pre-wrap font-sans leading-relaxed bg-cream rounded p-4">{playbook.email_body}</pre>
                  </div>
                </div>

                {Array.isArray(playbook.linkedin_sequence) && (
                  <div>
                    <p className="text-xs font-medium text-ink-faint uppercase tracking-widest mb-3">LinkedIn sequence</p>
                    <div className="space-y-3">
                      {playbook.linkedin_sequence.map((msg: string, i: number) => (
                        <div key={i} className="bg-white border border-cream-dark rounded p-5">
                          <p className="text-xs text-ink-faint mb-2">Message {i + 1}{i === 0 ? ' — connection request' : i === 1 ? ' — follow-up day 3' : ' — follow-up day 7'}</p>
                          <p className="text-sm text-ink leading-relaxed">{msg}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TARGETS ───────────────────────────────────────────────────── */}
        {activeTab === 'targets' && (
          <div>
            {targets.length === 0 ? (
              <Empty label="No targets yet — complete the ICP step to generate your target list." />
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-ink-muted mb-4">These contacts match your ICP. Prioritise those at companies that match your target segment first.</p>
                {targets.map((t: any, i: number) => (
                  <div key={i} className="bg-white border border-cream-dark rounded p-5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{t.contact_name || '—'}</p>
                      <p className="text-xs text-ink-muted mt-0.5 truncate">{t.contact_title} · {t.company_name}</p>
                      {t.contact_email && <p className="text-xs text-teal mt-0.5">{t.contact_email}</p>}
                    </div>
                    {t.linkedin_url && (
                      <a href={t.linkedin_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-ink-faint hover:text-teal transition-colors flex-shrink-0">
                        LinkedIn →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ value, label, accent }: { value: any; label: string; accent?: boolean }) {
  return (
    <div className="bg-white border border-cream-dark rounded p-5">
      <p className={`font-serif text-3xl ${accent ? 'text-teal' : 'text-ink'}`}>{value}</p>
      <p className="text-xs text-ink-muted mt-1.5 uppercase tracking-wide">{label}</p>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-cream-dark rounded p-6">
      <p className="text-xs font-medium text-ink-faint uppercase tracking-widest mb-4">{label}</p>
      {children}
    </div>
  );
}

function IcpRow({ label, value, capitalize }: { label: string; value?: string; capitalize?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex gap-4">
      <span className="text-ink-faint w-28 flex-shrink-0 text-xs pt-0.5 uppercase tracking-wide">{label}</span>
      <span className={`text-ink ${capitalize ? 'capitalize' : ''}`}>{value}</span>
    </div>
  );
}

function MotionCard({ motion: m }: { motion: any }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border rounded overflow-hidden ${m.recommended ? 'border-teal/30 bg-white' : 'border-cream-dark bg-cream'}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span className={`text-xs font-medium w-6 flex-shrink-0 ${m.recommended ? 'text-teal' : 'text-ink-faint'}`}>#{m.priority}</span>
        <span className={`text-sm font-medium flex-1 ${m.recommended ? 'text-ink' : 'text-ink-muted'}`}>{m.motion}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {m.recommended && <span className="text-[10px] bg-teal-pale text-teal px-2 py-0.5 rounded-sm font-medium uppercase tracking-wide">Recommended</span>}
          <ScoreBar score={m.fit_score} />
          <span className="text-xs text-ink-muted w-6 text-right">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-cream-dark pt-3 space-y-2">
          <p className="text-xs text-ink-muted leading-relaxed">{m.description}</p>
          <div className="flex gap-1 mt-1">
            <span className="text-[10px] font-medium text-teal uppercase tracking-wide flex-shrink-0 mt-0.5">✓</span>
            <p className="text-xs text-teal leading-relaxed">{m.why_fits}</p>
          </div>
          <div className="flex gap-1">
            <span className="text-[10px] font-medium text-amber-500 uppercase tracking-wide flex-shrink-0 mt-0.5">⚠</span>
            <p className="text-xs text-ink-muted leading-relaxed">{m.why_not}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1 bg-cream-dark rounded-full">
        <div className={`h-1 rounded-full ${score >= 75 ? 'bg-teal' : score >= 55 ? 'bg-amber-400' : 'bg-red-300'}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-ink-muted">{score}</span>
    </div>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const color = priority === 'required' ? 'bg-teal' : priority === 'recommended' ? 'bg-amber-400' : 'bg-cream-dark';
  return <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${color}`} />;
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles = priority === 'required'
    ? 'bg-teal-pale text-teal'
    : priority === 'recommended'
    ? 'bg-amber-50 text-amber-700'
    : 'bg-cream text-ink-faint';
  return <span className={`text-[10px] px-2 py-0.5 rounded-sm font-medium uppercase tracking-wide flex-shrink-0 ${styles}`}>{priority}</span>;
}

function Chip({ children, color }: { children: React.ReactNode; color: 'teal' | 'neutral' }) {
  return (
    <span className={`text-xs px-2.5 py-0.5 rounded-sm capitalize ${color === 'teal' ? 'bg-teal-pale text-teal' : 'bg-cream text-ink-muted'}`}>
      {children}
    </span>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="py-16 text-center text-ink-faint text-sm">{label}</div>;
}
