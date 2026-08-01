-- 0010_voiceprints.sql — a singer's measured voice over time (PR #366),
-- converted from that PR's schema.sql edit into the tracked chain.
--
-- Derived numbers ONLY. No audio and no pitch frames: the trace is a
-- rendering detail that belongs to the take that produced it. Anonymous
-- visitors keep the same numbers in localStorage; an account uploads them
-- (takenAt may predate createdAt - the take happened before sign-in).

CREATE TABLE IF NOT EXISTS voiceprints (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  userId TEXT NOT NULL,
  summary TEXT NOT NULL, -- JSON: MirrorSummary
  -- The legend whose range overlaps, e.g. 'Freddie Mercury'. NULL when the
  -- range task produced nothing to match against.
  twin TEXT,
  -- 'onboarding' | 'mirror'
  source TEXT NOT NULL,
  takenAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_voiceprints_userId ON voiceprints(userId);
CREATE INDEX IF NOT EXISTS idx_voiceprints_takenAt ON voiceprints(takenAt);
