import { useEffect, useState } from 'react';

interface SessionState {
  stage: string;
  score: number | null;
  icp: any;
  playbook: any;
  targets: any[];
  enrichment: any;
}

const STAGES = [
  { key: 'enriched', label: 'Profile enriched' },
  { key: 'icp_ready', label: 'ICP built' },
  { key: 'playbook_ready', label: 'Playbook ready' },
  { key: 'outbound_active', label: 'Outbound live' },
  { key: 'closed', label: 'First customer closed' },
];

export default function Dashboard() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'playbook' | 'targets' | 'emails'>('overview');

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

  const currentStageIdx = STAGES.findIndex(s => s.key === session.stage);
  const icp = session.icp;
  const playbook = session.playbook;
  const targets = session.targets ?? [];

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'playbook', label: 'Playbook' },
    { key: 'emails', label: 'Email templates' },
    { key: 'targets', label: `Targets${targets.length ? ` (${targets.length})` : ''}` },
  ];

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-2xl mx-auto px-8 py-12">

        {/* Header */}
        <div className="mb-10">
          <p className="text-xs font-medium text-ink-muted uppercase tracking-widest mb-2">Your First Customer</p>
          <h1 className="font-serif text-3xl text-ink leading-tight">GTM Dashboard</h1>
          <p className="text-sm text-ink-faint mt-1">Session <span className="font-mono">{sessionId.slice(0, 8)}</span></p>
        </div>

        {/* Score bar */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          <div className="bg-white border border-cream-dark rounded p-5">
            <p className="font-serif text-3xl text-teal">{session.score ?? '—'}</p>
            <p className="text-xs text-ink-muted mt-1.5 uppercase tracking-wide">Readiness score</p>
          </div>
          <div className="bg-white border border-cream-dark rounded p-5">
            <p className="font-serif text-3xl text-ink">{targets.length}</p>
            <p className="text-xs text-ink-muted mt-1.5 uppercase tracking-wide">Targets found</p>
          </div>
          <div className="bg-white border border-cream-dark rounded p-5">
            <p className="font-serif text-3xl text-ink">{Math.max(0, currentStageIdx + 1)}<span className="text-xl text-ink-faint">/5</span></p>
            <p className="text-xs text-ink-muted mt-1.5 uppercase tracking-wide">Milestones</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-cream-dark mb-8">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key as any)}
              className={`px-5 py-3 text-sm transition-colors border-b-2 -mb-px ${activeTab === t.key ? 'border-teal text-teal font-medium' : 'border-transparent text-ink-muted hover:text-ink'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-medium text-ink-faint uppercase tracking-widest mb-4">Progress</p>
              <div className="space-y-3">
                {STAGES.map((s, i) => {
                  const done = i <= currentStageIdx;
                  const active = i === currentStageIdx + 1;
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
            </div>

            {icp && (
              <div className="bg-white border border-cream-dark rounded p-6 mt-6">
                <p className="text-xs font-medium text-ink-faint uppercase tracking-widest mb-4">Your ICP</p>
                <div className="space-y-3 text-sm">
                  <Row label="Target buyer" value={`${icp.persona?.title} · ${icp.persona?.seniority}`} />
                  <Row label="Industries" value={icp.company_profile?.industries?.join(', ')} />
                  <Row label="Company size" value={`${icp.company_profile?.employee_range?.min}–${icp.company_profile?.employee_range?.max} employees`} />
                  <Row label="Deal size" value={`$${icp.deal_size_usd?.min?.toLocaleString()} – $${icp.deal_size_usd?.max?.toLocaleString()}`} />
                  <Row label="Sales motion" value={icp.sales_motion} capitalize />
                </div>
              </div>
            )}
          </div>
        )}

        {/* PLAYBOOK */}
        {activeTab === 'playbook' && (
          <div>
            {!playbook ? (
              <Empty label="Playbook not generated yet." />
            ) : (
              <div className="space-y-6">
                {(['week1', 'week2', 'week3', 'week4'] as const).map((week, wi) => {
                  const actions = playbook[week];
                  if (!Array.isArray(actions) || actions.length === 0) return null;
                  return (
                    <div key={week}>
                      <p className="text-xs font-medium text-ink-faint uppercase tracking-widest mb-3">Week {wi + 1}</p>
                      <div className="space-y-3">
                        {actions.map((action: any, i: number) => (
                          <div key={i} className="bg-white border border-cream-dark rounded p-5">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <p className="text-sm font-medium text-ink leading-snug">{action.title}</p>
                              <span className="text-xs bg-cream text-ink-muted px-2.5 py-1 rounded-sm flex-shrink-0 whitespace-nowrap">{action.day_range}</span>
                            </div>
                            <p className="text-sm text-ink-muted leading-relaxed">{action.description}</p>
                            <div className="flex gap-2 mt-3">
                              <Tag color="teal">{action.channel}</Tag>
                              <Tag color="neutral">{action.owner}</Tag>
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

        {/* EMAIL TEMPLATES */}
        {activeTab === 'emails' && (
          <div>
            {!playbook ? (
              <Empty label="Email templates not generated yet." />
            ) : (
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
                          <p className="text-xs text-ink-faint mb-2">Message {i + 1}</p>
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

        {/* TARGETS */}
        {activeTab === 'targets' && (
          <div>
            {targets.length === 0 ? (
              <Empty label="No targets identified yet." />
            ) : (
              <div className="space-y-3">
                {targets.map((t: any, i: number) => (
                  <div key={i} className="bg-white border border-cream-dark rounded p-5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-ink">{t.name ?? `${t.first_name ?? ''} ${t.last_name ?? ''}`.trim()}</p>
                      <p className="text-xs text-ink-muted mt-0.5">{t.title} · {t.organization?.name}</p>
                    </div>
                    <span className="text-xs bg-cream text-ink-muted px-3 py-1 rounded-sm">{t.organization?.primary_city ?? '—'}</span>
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

function Row({ label, value, capitalize }: { label: string; value?: string; capitalize?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex gap-4">
      <span className="text-ink-faint w-28 flex-shrink-0 text-xs pt-0.5 uppercase tracking-wide">{label}</span>
      <span className={`text-ink ${capitalize ? 'capitalize' : ''}`}>{value}</span>
    </div>
  );
}

function Tag({ children, color }: { children: React.ReactNode; color: 'teal' | 'neutral' }) {
  return (
    <span className={`text-xs px-2.5 py-0.5 rounded-sm capitalize ${color === 'teal' ? 'bg-teal-pale text-teal' : 'bg-cream text-ink-muted'}`}>
      {children}
    </span>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="py-16 text-center text-ink-faint text-sm">{label}</div>;
}
