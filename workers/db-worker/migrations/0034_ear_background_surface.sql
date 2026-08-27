-- 0034_ear_background_surface.sql — the Ear Lab joins the premium surfaces.
--
-- The Ear Lab's bench is a room now (ear-lab-polish-plan Phase 1): one free
-- Regulator Room ships from `public/`, and the supporter rooms of Phase 6 have
-- to be publishable through Studio like any other surface. The surface CHECK
-- would reject an `ear` identity today.
--
-- SQLite cannot alter a CHECK in place, and this table is referenced through
-- RESTRICT and CASCADE foreign keys, so rebuilding it alone would either fail
-- or destroy protected lifecycle state. Same shape as 0023 and 0031: preserve
-- the dependent graph, drop it leaf-first, restore it parent-first.
--
-- No identities are seeded. The art does not exist yet, and a row here with no
-- published revision is invisible to runtime delivery anyway; seeding names
-- ahead of the images would only put empty rooms in the admin library.

-- D1 runs migrations inside a transaction and keeps foreign keys enabled.
-- Deferral is transaction-local; the explicit drop order avoids firing the
-- existing RESTRICT/CASCADE actions while the tables are being rebuilt.
PRAGMA defer_foreign_keys = true;

CREATE TABLE _earSurfaceAssetsBackup AS
SELECT * FROM premiumBackgroundAssets;

CREATE TABLE _earSurfaceRevisionsBackup AS
SELECT * FROM premiumBackgroundRevisions;

CREATE TABLE _earSurfaceVariantsBackup AS
SELECT * FROM premiumBackgroundVariants;

CREATE TABLE _earSurfaceGroupPerksBackup AS
SELECT * FROM premiumSupporterGroupPerks;

CREATE TABLE _earSurfaceCapabilitiesBackup AS
SELECT * FROM premiumBackgroundCapabilities;

DROP TABLE premiumBackgroundCapabilities;
DROP TABLE premiumBackgroundVariants;
DROP TABLE premiumSupporterGroupPerks;
DROP TABLE premiumBackgroundRevisions;
DROP TABLE premiumBackgroundAssets;

CREATE TABLE premiumBackgroundAssets (
  id TEXT PRIMARY KEY,
  surface TEXT NOT NULL
    CHECK (surface IN ('karaoke', 'jam', 'piano', 'guitar', 'ear')),
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
  FROM _earSurfaceAssetsBackup;

INSERT INTO premiumBackgroundRevisions
  (id, backgroundId, version, lifecycle, createdAt, updatedAt, publishedAt,
   supersededAt)
SELECT id, backgroundId, version, lifecycle, createdAt, updatedAt, publishedAt,
       supersededAt
  FROM _earSurfaceRevisionsBackup;

INSERT INTO premiumBackgroundVariants
  (id, revisionId, variant, objectKey, width, height, byteSize, sha256, etag,
   createdAt, updatedAt)
SELECT id, revisionId, variant, objectKey, width, height, byteSize, sha256,
       etag, createdAt, updatedAt
  FROM _earSurfaceVariantsBackup;

INSERT INTO premiumSupporterGroupPerks
  (groupId, backgroundId, assignedAt, revokedAt)
SELECT groupId, backgroundId, assignedAt, revokedAt
  FROM _earSurfaceGroupPerksBackup;

INSERT INTO premiumBackgroundCapabilities
  (id, backgroundId, revisionId, version, roomId, issuerUserId, issuedAt,
   expiresAt, revokedAt)
SELECT id, backgroundId, revisionId, version, roomId, issuerUserId, issuedAt,
       expiresAt, revokedAt
  FROM _earSurfaceCapabilitiesBackup;

DROP TABLE _earSurfaceCapabilitiesBackup;
DROP TABLE _earSurfaceGroupPerksBackup;
DROP TABLE _earSurfaceVariantsBackup;
DROP TABLE _earSurfaceRevisionsBackup;
DROP TABLE _earSurfaceAssetsBackup;
