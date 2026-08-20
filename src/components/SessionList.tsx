import { useEffect, useState } from 'react';

interface Session {
  id: string;
  name: string;
  stage: string;
  score: number | null;
  created_at: number;
  updated_at: number;
}

const STAGE_LABELS: Record<string, string> = {
  intake: 'Started',
  enriched: 'Enriched',
  icp_ready: 'ICP ready',
  playbook_ready: 'Playbook ready',
  outbound_active: 'Outbound live',
  closed: 'First customer',
};

const STAGE_ORDER = ['intake', 'enriched', 'icp_ready', 'playbook_ready', 'outbound_active', 'closed'];

function stagePct(stage: string) {
  const idx = STAGE_ORDER.indexOf(stage);
  return idx < 0 ? 0 : Math.round((idx / (STAGE_ORDER.length - 1)) * 100);
}

function relativeTime(ts: number) {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function SessionList() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetch('/api/sessions').then(r => r.json()),
    ]).then(([me, list]: any[]) => {
      setLoggedIn(!!me?.account);
      setSessions(list?.sessions ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="max-w-2xl mx-auto px-8 py-24 text-center">
      <div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  );

  if (!loggedIn) {
    // Redirect to the intake flow which will show the sign-in/sign-up screen
    if (typeof window !== 'undefined') window.location.href = '/';
    return (
      <div className="max-w-lg mx-auto px-8 py-32 text-center">
        <div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-2xl mx-auto px-8 py-12">

        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-medium text-ink-muted uppercase tracking-widest mb-2">Your First Customer</p>
            <h1 className="font-serif text-3xl text-ink">My sessions</h1>
          </div>
          <a href="/"
            className="bg-teal text-white text-sm font-medium px-5 py-2.5 rounded hover:bg-teal-light transition-colors">
            + New session
          </a>
        </div>

        {sessions.length === 0 ? (
          <div className="bg-white border border-cream-dark rounded p-12 text-center">
            <p className="font-serif text-xl text-ink mb-2">No sessions yet</p>
            <p className="text-sm text-ink-muted mb-6">Start a new session to build your first GTM playbook.</p>
            <a href="/" className="inline-block bg-teal text-white text-sm font-medium px-5 py-3 rounded hover:bg-teal-light transition-colors">
              Start now →
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map(s => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionCard({ session: s }: { session: Session }) {
  const pct = stagePct(s.stage);
  const isReady = s.stage === 'playbook_ready' || s.stage === 'outbound_active' || s.stage === 'closed';
  const href = isReady || s.stage === 'icp_ready'
    ? `/dashboard?session=${s.id}`
    : `/`;

  return (
    <a href={isReady || s.stage === 'icp_ready' ? `/dashboard?session=${s.id}` : '/'} className="block">
      <div className="bg-white border border-cream-dark rounded p-5 hover:border-teal/40 transition-colors cursor-pointer group">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink group-hover:text-teal transition-colors truncate">{s.name}</p>
            <p className="text-xs text-ink-faint mt-0.5">Updated {relativeTime(s.updated_at)}</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {s.score != null && (
              <div className="text-right">
                <p className="font-serif text-lg text-teal leading-none">{s.score}</p>
                <p className="text-[10px] text-ink-faint">score</p>
              </div>
            )}
            <StageBadge stage={s.stage} />
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-cream-dark rounded-full">
          <div
            className="h-0.5 bg-teal rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-ink-faint">Started</span>
          <span className="text-[10px] text-ink-faint">First customer</span>
        </div>
      </div>
    </a>
  );
}

function StageBadge({ stage }: { stage: string }) {
  const label = STAGE_LABELS[stage] ?? stage;
  const isLate = stage === 'playbook_ready' || stage === 'outbound_active' || stage === 'closed';
  return (
    <span className={`text-[10px] font-medium uppercase tracking-wide px-2 py-1 rounded-sm ${isLate ? 'bg-teal-pale text-teal' : 'bg-cream text-ink-muted'}`}>
      {label}
    </span>
  );
}
