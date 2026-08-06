-- 0018_premium_background_studio.sql — mutable premium-background publishing.
--
-- The environment-local main DB owns lifecycle, supporter groups and
-- revocable Jam capabilities. The separately bound PERKS_DB remains the
-- backwards-compatible ledger for individual verified-email grants.
--
-- Objects use IF NOT EXISTS so persistent preview databases that applied the
-- same schema under its pre-rebase migration filename can safely replay this
-- migration and still receive any newly added indexes.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS premiumBackgroundAssets (
  id TEXT PRIMARY KEY,
  surface TEXT NOT NULL CHECK (surface IN ('karaoke', 'jam')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'retired')),
  activeRevisionId TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  retiredAt TEXT
);

CREATE TABLE IF NOT EXISTS premiumBackgroundRevisions (
  id TEXT PRIMARY KEY,
  backgroundId TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  lifecycle TEXT NOT NULL DEFAULT 'draft'
    CHECK (lifecycle IN ('draft', 'published', 'superseded')),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  publishedAt TEXT,
  supersededAt TEXT,
  UNIQUE (backgroundId, version),
  FOREIGN KEY (backgroundId) REFERENCES premiumBackgroundAssets(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_premiumBackgroundRevisions_asset
  ON premiumBackgroundRevisions (backgroundId, lifecycle, version DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_premiumBackgroundRevisions_one_draft
  ON premiumBackgroundRevisions (backgroundId)
  WHERE lifecycle = 'draft';
CREATE UNIQUE INDEX IF NOT EXISTS idx_premiumBackgroundRevisions_one_published
  ON premiumBackgroundRevisions (backgroundId)
  WHERE lifecycle = 'published';

CREATE TABLE IF NOT EXISTS premiumBackgroundVariants (
  id TEXT PRIMARY KEY,
  revisionId TEXT NOT NULL,
  variant TEXT NOT NULL
    CHECK (variant IN ('landscape-2k', 'landscape-4k', 'portrait-2k')),
  objectKey TEXT NOT NULL UNIQUE,
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  byteSize INTEGER NOT NULL CHECK (byteSize > 0),
  sha256 TEXT NOT NULL,
  etag TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE (revisionId, variant),
  FOREIGN KEY (revisionId) REFERENCES premiumBackgroundRevisions(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_premiumBackgroundVariants_revision
  ON premiumBackgroundVariants (revisionId, variant);

CREATE TABLE IF NOT EXISTS premiumSupporterGroups (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL CHECK (kind IN ('automatic', 'manual')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT
);

CREATE TABLE IF NOT EXISTS premiumSupporterGroupMembers (
  groupId TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  note TEXT,
  grantedAt TEXT NOT NULL,
  revokedAt TEXT,
  PRIMARY KEY (groupId, email),
  FOREIGN KEY (groupId) REFERENCES premiumSupporterGroups(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_premiumSupporterGroupMembers_email
  ON premiumSupporterGroupMembers (email, revokedAt);

CREATE TABLE IF NOT EXISTS premiumSupporterGroupPerks (
  groupId TEXT NOT NULL,
  backgroundId TEXT NOT NULL,
  assignedAt TEXT NOT NULL,
  revokedAt TEXT,
  PRIMARY KEY (groupId, backgroundId),
  FOREIGN KEY (groupId) REFERENCES premiumSupporterGroups(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (backgroundId) REFERENCES premiumBackgroundAssets(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_premiumSupporterGroupPerks_background
  ON premiumSupporterGroupPerks (backgroundId, revokedAt);

CREATE TABLE IF NOT EXISTS premiumBackgroundCapabilities (
  id TEXT PRIMARY KEY,
  backgroundId TEXT NOT NULL,
  revisionId TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  roomId TEXT NOT NULL,
  issuerUserId TEXT NOT NULL,
  issuedAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  revokedAt TEXT,
  FOREIGN KEY (backgroundId) REFERENCES premiumBackgroundAssets(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (revisionId) REFERENCES premiumBackgroundRevisions(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (issuerUserId) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_premiumBackgroundCapabilities_scope
  ON premiumBackgroundCapabilities
    (backgroundId, version, roomId, expiresAt, revokedAt);
CREATE INDEX IF NOT EXISTS idx_premiumBackgroundCapabilities_issuer
  ON premiumBackgroundCapabilities (issuerUserId, expiresAt, revokedAt);
CREATE INDEX IF NOT EXISTS idx_premiumBackgroundCapabilities_expiry
  ON premiumBackgroundCapabilities (expiresAt, revokedAt);

CREATE TABLE IF NOT EXISTS premiumPerkAudit (
  id TEXT PRIMARY KEY,
  actorType TEXT NOT NULL,
  actorId TEXT,
  action TEXT NOT NULL,
  entityType TEXT NOT NULL,
  entityId TEXT NOT NULL,
  detailsJson TEXT NOT NULL DEFAULT '{}',
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_premiumPerkAudit_entity
  ON premiumPerkAudit (entityType, entityId, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_premiumPerkAudit_created
  ON premiumPerkAudit (createdAt DESC);

-- Stable catalog identities. Publishing remains impossible until an admin
-- creates a revision, uploads every required variant and explicitly publishes.
INSERT OR IGNORE INTO premiumBackgroundAssets
  (id, surface, title, description, status, activeRevisionId, createdAt, updatedAt, retiredAt)
VALUES
  ('golden-stage', 'jam', 'Golden Stage', 'A warm supporter stage for shared Jam Rooms.', 'active', NULL, '2026-08-05T00:00:00.000Z', '2026-08-05T00:00:00.000Z', NULL),
  ('golden-singer', 'jam', 'Golden Vocal Booth', 'An intimate golden-hour vocal room.', 'active', NULL, '2026-08-05T00:00:00.000Z', '2026-08-05T00:00:00.000Z', NULL),
  ('aurora-loft', 'jam', 'Aurora Loft', 'A luminous high-altitude room for collaborative singing.', 'active', NULL, '2026-08-05T00:00:00.000Z', '2026-08-05T00:00:00.000Z', NULL),
  ('golden-hour-stage', 'karaoke', 'Golden Hour Stage', 'A cinematic sunset stage for Karaoke Night.', 'active', NULL, '2026-08-05T00:00:00.000Z', '2026-08-05T00:00:00.000Z', NULL),
  ('aurora-stage', 'karaoke', 'Aurora Stage', 'A celestial stage lit by flowing northern lights.', 'active', NULL, '2026-08-05T00:00:00.000Z', '2026-08-05T00:00:00.000Z', NULL),
  ('neon-velvet-stage', 'karaoke', 'Neon Velvet Stage', 'A saturated club stage with a premium late-night mood.', 'active', NULL, '2026-08-05T00:00:00.000Z', '2026-08-05T00:00:00.000Z', NULL),
  ('midnight-rain-stage', 'karaoke', 'Midnight Rain Stage', 'A reflective midnight performance stage.', 'active', NULL, '2026-08-05T00:00:00.000Z', '2026-08-05T00:00:00.000Z', NULL),
  ('neon-velvet-room', 'jam', 'Neon Velvet Room', 'A close, vivid room for supporter Jam sessions.', 'active', NULL, '2026-08-05T00:00:00.000Z', '2026-08-05T00:00:00.000Z', NULL),
  ('midnight-rain-room', 'jam', 'Midnight Rain Room', 'A calm nocturnal room for ensemble practice.', 'active', NULL, '2026-08-05T00:00:00.000Z', '2026-08-05T00:00:00.000Z', NULL),
  ('mercury-archive', 'jam', 'Mercury Archive', 'A collectible Mercury edition room for supporters.', 'active', NULL, '2026-08-05T00:00:00.000Z', '2026-08-05T00:00:00.000Z', NULL);

INSERT OR IGNORE INTO premiumSupporterGroups
  (id, slug, name, description, kind, active, createdAt, updatedAt, deletedAt)
VALUES
  ('group-active-supporters', 'active-supporters', 'Active supporters',
   'Automatically includes accounts with a current supporter entitlement.',
   'automatic', 1, '2026-08-05T00:00:00.000Z', '2026-08-05T00:00:00.000Z', NULL);

INSERT OR IGNORE INTO premiumSupporterGroupPerks
  (groupId, backgroundId, assignedAt, revokedAt)
SELECT 'group-active-supporters', id, '2026-08-05T00:00:00.000Z', NULL
  FROM premiumBackgroundAssets;
