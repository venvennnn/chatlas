CREATE TABLE IF NOT EXISTS analysis_samples(
 session_id TEXT NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
 at INTEGER NOT NULL, topics TEXT NOT NULL, participants INTEGER NOT NULL,
 messages INTEGER NOT NULL, coverage REAL NOT NULL,
 PRIMARY KEY(session_id,at)
);
CREATE INDEX IF NOT EXISTS samples_by_session ON analysis_samples(session_id,at);
PRAGMA user_version=2;
