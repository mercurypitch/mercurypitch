-- 0072_reports_and_blocks.sql: what a singer reports, and whom they block.
--
-- App Store guideline 1.2 and Play's user-generated content policy ask an app
-- whose singers post for a way to report what is posted and a way to block a
-- singer. These are the two tables behind those routes (reports.ts,
-- blocks.ts). Both are worker-internal: neither is in the CRUD TABLES, so no
-- client reads or writes them except through those routes.
--
-- A report names what it is about twice: `targetKind` and `targetId` (a
-- singer, their profile, a shared melody or a shared result) and the singer
-- behind it, `targetUserId`, which the worker reads from the target itself.
-- `reason` is one of a fixed list and `targetKind` one of four, both checked
-- by the worker (report-rules.ts) rather than by a CHECK here: SQLite changes
-- a CHECK only by rebuilding the table, and either list may grow. A reporter
-- holds at most one open report on a target, by the partial unique index.
-- `resolvedBy` names the Cloudflare Access identity behind a resolution, and
-- is NULL when the shared admin key made it.
--
-- A block is one row, blocker to blocked. The worker reads it both ways: a
-- block hides each singer from the other.
--
-- Account deletion (auth.ts, USER_OWNED_TABLES) erases a singer's reports,
-- the reports about them, and their blocks from both sides.
--
-- Purely additive: two new tables, and nothing that exists is touched.
CREATE TABLE IF NOT EXISTS contentReports (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  reporterId TEXT NOT NULL,
  targetUserId TEXT NOT NULL,
  targetKind TEXT NOT NULL,
  targetId TEXT NOT NULL,
  reason TEXT NOT NULL,
  note TEXT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'actioned', 'dismissed')),
  resolvedAt TEXT NULL,
  resolvedBy TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contentReports_open_once
  ON contentReports(reporterId, targetKind, targetId) WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_contentReports_target
  ON contentReports(targetKind, targetId, status);

CREATE INDEX IF NOT EXISTS idx_contentReports_status
  ON contentReports(status, createdAt);

CREATE INDEX IF NOT EXISTS idx_contentReports_targetUser
  ON contentReports(targetUserId);

CREATE TABLE IF NOT EXISTS userBlocks (
  blockerId TEXT NOT NULL,
  blockedId TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  PRIMARY KEY (blockerId, blockedId)
);

CREATE INDEX IF NOT EXISTS idx_userBlocks_blocked
  ON userBlocks(blockedId);
