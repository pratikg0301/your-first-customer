import { useEffect, useState } from 'react';

interface SessionState {
  stage: string;
  score: number | null;
  icp: Record<string, unknown> | null;
  playbook: Record<string, unknown> | null;
  targets: Array<Record<string, unknown>>;
  lastUpdated: number;
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

  useEffect(() => {
    const sid = new URLSearchParams(window.location.search).get('session');
    if (!sid) { setLoading(false); return; }
    setSessionId(sid);

    fetch(`/api/session/${sid}`)
      .then(r => r.json())
      .then(data => { setSession(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (!session || !sessionId) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <p className="text-gray-500">No active session found.</p>
        <a href="/" className="mt-4 inline-block text-indigo-600 text-sm hover:underline">Start here →</a>
      </div>
    );
  }

  const currentStageIdx = STAGES.findIndex(s => s.key === session.stage);
  const icp = session.icp as any;
  const playbook = session.playbook as any;

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-gray-900">Your dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Session <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{sessionId.slice(0, 8)}</code></p>
      </div>

      {session.score && (
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-2xl font-medium text-indigo-600">{session.score}</p>
            <p className="text-xs text-gray-500 mt-1">Readiness score</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-2xl font-medium text-gray-900">{session.targets?.length ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Targets identified</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-2xl font-medium text-emerald-600">{currentStageIdx + 1}/5</p>
            <p className="text-xs text-gray-500 mt-1">Milestones done</p>
          </div>
        </div>
      )}

      <div className="mb-8">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-4">Progress</p>
        <div className="space-y-4">
          {STAGES.map((s, i) => {
            const done = i <= currentStageIdx;
            const active = i === currentStageIdx + 1;
            return (
              <div key={s.key} className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                  done ? 'bg-emerald-100 text-emerald-700' : active ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-400'
                }`}>
                  {done ? '✓' : i + 1}
                </div>
                <span className={`text-sm ${done ? 'text-gray-900 font-medium' : active ? 'text-indigo-600' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {icp && (
        <div className="border border-gray-100 rounded-xl p-5 mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Your ICP</p>
          <div className="space-y-2 text-sm">
            <div className="flex gap-2">
              <span className="text-gray-500 w-28 flex-shrink-0">Target buyer</span>
              <span className="text-gray-900 font-medium">{icp.persona?.title} · {icp.persona?.seniority}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-28 flex-shrink-0">Industries</span>
              <span className="text-gray-900">{icp.company_profile?.industries?.join(', ')}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-28 flex-shrink-0">Company size</span>
              <span className="text-gray-900">{icp.company_profile?.employee_range?.min}–{icp.company_profile?.employee_range?.max} employees</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-28 flex-shrink-0">Deal size</span>
              <span className="text-gray-900">${icp.deal_size_usd?.min?.toLocaleString()} – ${icp.deal_size_usd?.max?.toLocaleString()}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-28 flex-shrink-0">Sales motion</span>
              <span className="text-gray-900 capitalize">{icp.sales_motion}</span>
            </div>
          </div>
        </div>
      )}

      {playbook && (
        <div className="border border-gray-100 rounded-xl p-5 mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Cold email template</p>
          <p className="text-xs text-gray-500 mb-1">Subject</p>
          <p className="text-sm font-medium text-gray-900 mb-3">{playbook.email_subject}</p>
          <p className="text-xs text-gray-500 mb-1">Body</p>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed bg-gray-50 rounded-lg p-3">{playbook.email_body}</pre>
        </div>
      )}

      {session.targets && session.targets.length > 0 && (
        <div className="border border-gray-100 rounded-xl p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Target list ({session.targets.length})</p>
          <div className="space-y-3">
            {session.targets.slice(0, 10).map((t: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-gray-900">{t.name ?? t.first_name + ' ' + t.last_name}</p>
                  <p className="text-gray-500 text-xs">{t.title} · {t.organization?.name}</p>
                </div>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                  {t.organization?.primary_city ?? '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
