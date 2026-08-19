CREATE TABLE IF NOT EXISTS founders (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  linkedin_url TEXT,
  company_url TEXT,
  company_linkedin TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  founder_id TEXT NOT NULL REFERENCES founders(id),
  stage TEXT NOT NULL DEFAULT 'intake',
  score INTEGER,
  icp_json TEXT,
  playbook_json TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS enrichments (
  id TEXT PRIMARY KEY,
  founder_id TEXT NOT NULL REFERENCES founders(id),
  source TEXT NOT NULL,
  data_json TEXT NOT NULL,
  cached_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS targets (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  company_name TEXT,
  contact_name TEXT,
  contact_title TEXT,
  contact_email TEXT,
  linkedin_url TEXT,
  status TEXT NOT NULL DEFAULT 'identified',
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  target_id TEXT REFERENCES targets(id),
  type TEXT NOT NULL,
  description TEXT,
  metadata_json TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_sessions_founder ON sessions(founder_id);
CREATE INDEX IF NOT EXISTS idx_targets_session ON targets(session_id);
CREATE INDEX IF NOT EXISTS idx_activities_session ON activities(session_id);
