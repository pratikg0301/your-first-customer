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
  { key: 'closed', label: 'First customer' },
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
    <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  );

  if (!session || !sessionId) return (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <p className="text-gray-500">No active session found.</p>
      <a href="/" className="mt-4 inline-block text-indigo-600 text-sm hover:underline">Start here →</a>
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
    { key: 'targets', label: `Targets (${targets.length})` },
  ];

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-medium text-gray-900">Your dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Session <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{sessionId.slice(0, 8)}</code></p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-2xl font-medium text-indigo-600">{session.score ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-1">Readiness score</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-2xl font-medium text-gray-900">{targets.length}</p>
          <p className="text-xs text-gray-500 mt-1">Targets found</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-2xl font-medium text-emerald-600">{Math.max(0, currentStageIdx + 1)}/5</p>
          <p className="text-xs text-gray-500 mt-1">Milestones done</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-100 mb-6">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Progress</p>
            <div className="space-y-3">
              {STAGES.map((s, i) => {
                const done = i <= currentStageIdx;
                const active = i === currentStageIdx + 1;
                return (
                  <div key={s.key} className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${done ? 'bg-emerald-100 text-emerald-700' : active ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-400'}`}>
                      {done ? '✓' : i + 1}
                    </div>
                    <span className={`text-sm ${done ? 'text-gray-900 font-medium' : active ? 'text-indigo-600' : 'text-gray-400'}`}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {icp && (
            <div className="border border-gray-100 rounded-xl p-5 mt-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Your ICP</p>
              <div className="space-y-2 text-sm">
                <div className="flex gap-2"><span className="text-gray-500 w-28 flex-shrink-0">Target buyer</span><span className="text-gray-900 font-medium">{icp.persona?.title} · {icp.persona?.seniority}</span></div>
                <div className="flex gap-2"><span className="text-gray-500 w-28 flex-shrink-0">Industries</span><span className="text-gray-900">{icp.company_profile?.industries?.join(', ')}</span></div>
                <div className="flex gap-2"><span className="text-gray-500 w-28 flex-shrink-0">Company size</span><span className="text-gray-900">{icp.company_profile?.employee_range?.min}–{icp.company_profile?.employee_range?.max} employees</span></div>
                <div className="flex gap-2"><span className="text-gray-500 w-28 flex-shrink-0">Deal size</span><span className="text-gray-900">${icp.deal_size_usd?.min?.toLocaleString()} – ${icp.deal_size_usd?.max?.toLocaleString()}</span></div>
                <div className="flex gap-2"><span className="text-gray-500 w-28 flex-shrink-0">Sales motion</span><span className="text-gray-900 capitalize">{icp.sales_motion}</span></div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'playbook' && (
        <div>
          {!playbook ? (
            <div className="text-center py-12 text-gray-400 text-sm">Playbook not generated yet.</div>
          ) : (
            <div className="space-y-4">
              {['week1', 'week2', 'week3', 'week4'].map((week, wi) => {
                const actions = playbook[week];
                if (!actions || !Array.isArray(actions)) return null;
                return (
                  <div key={week}>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Week {wi + 1}</p>
                    <div className="space-y-2">
                      {actions.map((action: any, i: number) => (
                        <div key={i} className="border border-gray-100 rounded-lg p-4">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm font-medium text-gray-900">{action.title}</p>
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex-shrink-0">{action.day_range}</span>
                          </div>
                          <p className="text-xs text-gray-500">{action.description}</p>
                          <div className="flex gap-2 mt-2">
                            <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full capitalize">{action.channel}</span>
                            <span className="text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full capitalize">{action.owner}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {playbook.pilot_offer && (
                <div className="border-l-4 border-indigo-400 bg-indigo-50 rounded-r-lg p-4">
                  <p className="text-xs font-medium text-indigo-700 mb-1">Pilot offer</p>
                  <p className="text-sm text-indigo-900">{playbook.pilot_offer}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'emails' && (
        <div>
          {!playbook ? (
            <div className="text-center py-12 text-gray-400 text-sm">Email templates not generated yet.</div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Cold email</p>
                <div className="border border-gray-100 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Subject line</p>
                  <p className="text-sm font-medium text-gray-900 mb-4">{playbook.email_subject}</p>
                  <p className="text-xs text-gray-500 mb-1">Body</p>
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed bg-gray-50 rounded-lg p-3">{playbook.email_body}</pre>
                </div>
              </div>
              {Array.isArray(playbook.linkedin_sequence) && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">LinkedIn sequence</p>
                  <div className="space-y-3">
                    {playbook.linkedin_sequence.map((msg: string, i: number) => (
                      <div key={i} className="border border-gray-100 rounded-lg p-4">
                        <p className="text-xs text-gray-400 mb-1">Message {i + 1}</p>
                        <p className="text-sm text-gray-700">{msg}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'targets' && (
        <div>
          {targets.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No targets identified yet.</div>
          ) : (
            <div className="space-y-3">
              {targets.map((t: any, i: number) => (
                <div key={i} className="flex items-center justify-between border border-gray-100 rounded-lg p-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{t.name ?? `${t.first_name ?? ''} ${t.last_name ?? ''}`.trim()}</p>
                    <p className="text-xs text-gray-500">{t.title} · {t.organization?.name}</p>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">{t.organization?.primary_city ?? '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
