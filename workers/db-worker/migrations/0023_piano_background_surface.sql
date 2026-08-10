-- 0023_piano_background_surface.sql — typed Piano premium backgrounds.
--
-- SQLite cannot alter the surface CHECK in place. The asset table is also
-- referenced through RESTRICT and CASCADE foreign keys, so rebuilding only
-- that table would either fail or destroy protected lifecycle state. Preserve
-- the complete dependent graph, drop it leaf-first, and restore it parent-first.

-- D1 runs migrations inside a transaction and keeps foreign keys enabled.
-- Deferral is transaction-local; the explicit drop order avoids firing the
-- existing RESTRICT/CASCADE actions while the tables are being rebuilt.
PRAGMA defer_foreign_keys = true;

CREATE TABLE _pianoSurfaceAssetsBackup AS
SELECT * FROM premiumBackgroundAssets;

CREATE TABLE _pianoSurfaceRevisionsBackup AS
SELECT * FROM premiumBackgroundRevisions;

CREATE TABLE _pianoSurfaceVariantsBackup AS
SELECT * FROM premiumBackgroundVariants;

CREATE TABLE _pianoSurfaceGroupPerksBackup AS
SELECT * FROM premiumSupporterGroupPerks;

CREATE TABLE _pianoSurfaceCapabilitiesBackup AS
SELECT * FROM premiumBackgroundCapabilities;

DROP TABLE premiumBackgroundCapabilities;
DROP TABLE premiumBackgroundVariants;
DROP TABLE premiumSupporterGroupPerks;
DROP TABLE premiumBackgroundRevisions;
DROP TABLE premiumBackgroundAssets;

CREATE TABLE premiumBackgroundAssets (
  id TEXT PRIMARY KEY,
  surface TEXT NOT NULL CHECK (surface IN ('karaoke', 'jam', 'piano')),
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
  FROM _pianoSurfaceAssetsBackup;

INSERT INTO premiumBackgroundRevisions
  (id, backgroundId, version, lifecycle, createdAt, updatedAt, publishedAt,
   supersededAt)
SELECT id, backgroundId, version, lifecycle, createdAt, updatedAt, publishedAt,
       supersededAt
  FROM _pianoSurfaceRevisionsBackup;

INSERT INTO premiumBackgroundVariants
  (id, revisionId, variant, objectKey, width, height, byteSize, sha256, etag,
   createdAt, updatedAt)
SELECT id, revisionId, variant, objectKey, width, height, byteSize, sha256,
       etag, createdAt, updatedAt
  FROM _pianoSurfaceVariantsBackup;

INSERT INTO premiumSupporterGroupPerks
  (groupId, backgroundId, assignedAt, revokedAt)
SELECT groupId, backgroundId, assignedAt, revokedAt
  FROM _pianoSurfaceGroupPerksBackup;

INSERT INTO premiumBackgroundCapabilities
  (id, backgroundId, revisionId, version, roomId, issuerUserId, issuedAt,
   expiresAt, revokedAt)
SELECT id, backgroundId, revisionId, version, roomId, issuerUserId, issuedAt,
       expiresAt, revokedAt
  FROM _pianoSurfaceCapabilitiesBackup;

DROP TABLE _pianoSurfaceCapabilitiesBackup;
DROP TABLE _pianoSurfaceGroupPerksBackup;
DROP TABLE _pianoSurfaceVariantsBackup;
DROP TABLE _pianoSurfaceRevisionsBackup;
DROP TABLE _pianoSurfaceAssetsBackup;

-- Stable Piano identities only. A background remains absent from runtime
-- delivery until an admin publishes a complete protected revision.
INSERT OR IGNORE INTO premiumBackgroundAssets
  (id, surface, title, description, status, activeRevisionId, createdAt,
   updatedAt, retiredAt)
VALUES
  ('piano-velvet-recital', 'piano', 'Velvet Recital',
   'A deep velvet recital room for focused Piano Night performances.',
   'active', NULL, '2026-08-10T00:00:00.000Z',
   '2026-08-10T00:00:00.000Z', NULL),
  ('piano-aurora-loft', 'piano', 'Aurora Piano Loft',
   'A luminous glasshouse for nocturnal piano practice.',
   'active', NULL, '2026-08-10T00:00:00.000Z',
   '2026-08-10T00:00:00.000Z', NULL),
  ('piano-midnight-rain', 'piano', 'Midnight Rain Room',
   'A reflective rain room with a quiet performance corridor.',
   'active', NULL, '2026-08-10T00:00:00.000Z',
   '2026-08-10T00:00:00.000Z', NULL),
  ('piano-mercury-archive', 'piano', 'Mercury Piano Archive',
   'A tape-and-timber Mercury edition for Piano Night.',
   'active', NULL, '2026-08-10T00:00:00.000Z',
   '2026-08-10T00:00:00.000Z', NULL);

-- Assign only the new identities. INSERT OR IGNORE preserves an intentional
-- revocation if this migration is replayed in a persistent preview database.
INSERT OR IGNORE INTO premiumSupporterGroupPerks
  (groupId, backgroundId, assignedAt, revokedAt)
SELECT g.id, a.id, '2026-08-10T00:00:00.000Z', NULL
  FROM premiumSupporterGroups g
  JOIN premiumBackgroundAssets a
    ON a.id IN (
      'piano-velvet-recital',
      'piano-aurora-loft',
      'piano-midnight-rain',
      'piano-mercury-archive'
    )
 WHERE g.slug = 'active-supporters'
   AND g.kind = 'automatic'
   AND g.deletedAt IS NULL
   AND a.surface = 'piano';
