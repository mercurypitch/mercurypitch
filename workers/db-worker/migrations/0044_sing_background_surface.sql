-- 0044_sing_background_surface.sql — the Sing room joins the surfaces.
--
-- The native Sing tab IS a room now ("Retro Analog Studio"), so the catalog
-- declares a `sing` surface. Its one cover ships free and public, which means
-- nothing is seeded here and nothing has to be: the constraint is what has to
-- move, because Studio writes `premiumBackgroundAssets.surface` the moment
-- anybody publishes a supporter background for the room, and a CHECK that
-- predates the surface fails that write with a half-finished upload behind it.
--
-- SQLite cannot alter a CHECK in place, and this table is referenced through
-- RESTRICT and CASCADE foreign keys, so preserve and rebuild the complete
-- constrained graph rather than replacing only its root. Same shape as 0031
-- (guitar), 0034 (ear) and 0036 (drum); `src/lib/backgrounds/
-- premium-background-surface-check.test.ts` is the tripwire that demands it.

-- D1 runs migrations inside a transaction and keeps foreign keys enabled.
-- Deferral is transaction-local; the explicit drop order avoids firing the
-- existing RESTRICT/CASCADE actions while the tables are being rebuilt.
PRAGMA defer_foreign_keys = true;

CREATE TABLE _singSurfaceAssetsBackup AS
SELECT * FROM premiumBackgroundAssets;

CREATE TABLE _singSurfaceRevisionsBackup AS
SELECT * FROM premiumBackgroundRevisions;

CREATE TABLE _singSurfaceVariantsBackup AS
SELECT * FROM premiumBackgroundVariants;

CREATE TABLE _singSurfaceGroupPerksBackup AS
SELECT * FROM premiumSupporterGroupPerks;

CREATE TABLE _singSurfaceCapabilitiesBackup AS
SELECT * FROM premiumBackgroundCapabilities;

DROP TABLE premiumBackgroundCapabilities;
DROP TABLE premiumBackgroundVariants;
DROP TABLE premiumSupporterGroupPerks;
DROP TABLE premiumBackgroundRevisions;
DROP TABLE premiumBackgroundAssets;

CREATE TABLE premiumBackgroundAssets (
  id TEXT PRIMARY KEY,
  surface TEXT NOT NULL
    CHECK (surface IN ('karaoke', 'jam', 'piano', 'guitar', 'drum', 'ear', 'sing')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'retired')),
  activeRevisionId TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  retiredAt TEXT
);

CREATE TABLE premiumBackgroundRevisions (
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

CREATE INDEX idx_premiumBackgroundRevisions_asset
  ON premiumBackgroundRevisions (backgroundId, lifecycle, version DESC);
CREATE UNIQUE INDEX idx_premiumBackgroundRevisions_one_draft
  ON premiumBackgroundRevisions (backgroundId)
  WHERE lifecycle = 'draft';
CREATE UNIQUE INDEX idx_premiumBackgroundRevisions_one_published
  ON premiumBackgroundRevisions (backgroundId)
  WHERE lifecycle = 'published';

CREATE TABLE premiumBackgroundVariants (
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

CREATE INDEX idx_premiumBackgroundVariants_revision
  ON premiumBackgroundVariants (revisionId, variant);

CREATE TABLE premiumSupporterGroupPerks (
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

CREATE INDEX idx_premiumSupporterGroupPerks_background
  ON premiumSupporterGroupPerks (backgroundId, revokedAt);

CREATE TABLE premiumBackgroundCapabilities (
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

CREATE INDEX idx_premiumBackgroundCapabilities_scope
  ON premiumBackgroundCapabilities
    (backgroundId, version, roomId, expiresAt, revokedAt);
CREATE INDEX idx_premiumBackgroundCapabilities_issuer
  ON premiumBackgroundCapabilities (issuerUserId, expiresAt, revokedAt);
CREATE INDEX idx_premiumBackgroundCapabilities_expiry
  ON premiumBackgroundCapabilities (expiresAt, revokedAt);

INSERT INTO premiumBackgroundAssets
  (id, surface, title, description, status, activeRevisionId, createdAt,
   updatedAt, retiredAt)
SELECT id, surface, title, description, status, activeRevisionId, createdAt,
       updatedAt, retiredAt
  FROM _singSurfaceAssetsBackup;

INSERT INTO premiumBackgroundRevisions
  (id, backgroundId, version, lifecycle, createdAt, updatedAt, publishedAt,
   supersededAt)
SELECT id, backgroundId, version, lifecycle, createdAt, updatedAt, publishedAt,
       supersededAt
  FROM _singSurfaceRevisionsBackup;

INSERT INTO premiumBackgroundVariants
  (id, revisionId, variant, objectKey, width, height, byteSize, sha256, etag,
   createdAt, updatedAt)
SELECT id, revisionId, variant, objectKey, width, height, byteSize, sha256,
       etag, createdAt, updatedAt
  FROM _singSurfaceVariantsBackup;

INSERT INTO premiumSupporterGroupPerks
  (groupId, backgroundId, assignedAt, revokedAt)
SELECT groupId, backgroundId, assignedAt, revokedAt
  FROM _singSurfaceGroupPerksBackup;

INSERT INTO premiumBackgroundCapabilities
  (id, backgroundId, revisionId, version, roomId, issuerUserId, issuedAt,
   expiresAt, revokedAt)
SELECT id, backgroundId, revisionId, version, roomId, issuerUserId, issuedAt,
       expiresAt, revokedAt
  FROM _singSurfaceCapabilitiesBackup;

DROP TABLE _singSurfaceCapabilitiesBackup;
DROP TABLE _singSurfaceGroupPerksBackup;
DROP TABLE _singSurfaceVariantsBackup;
DROP TABLE _singSurfaceRevisionsBackup;
DROP TABLE _singSurfaceAssetsBackup;
