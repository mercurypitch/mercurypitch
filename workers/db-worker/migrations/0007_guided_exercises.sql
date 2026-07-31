-- 0007_guided_exercises.sql — guided Zen exercise content tables (Content
-- Studio, PR #358), converted from that PR's schema.sql edit into the
-- tracked migration chain. All objects are new; IF NOT EXISTS throughout,
-- so re-application is harmless. Forward-only.


-- ── Guided Zen exercises (owner-authored, immutable publishing) ──────
-- Stable exercise ids deliberately match the frontend's existing seed slugs.
-- Drafts are mutable through custom /api/admin/guided-exercises handlers;
-- published JSON is immutable and is the exact ZenExerciseDefinition runtime
-- shape. These tables are intentionally absent from the generic CRUD allowlist.
CREATE TABLE IF NOT EXISTS guidedExercises (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  category TEXT NOT NULL,
  level TEXT NOT NULL,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active', -- active | archived
  publishedVersion INTEGER,
  archivedAt TEXT,
  CHECK (status IN ('active', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_guidedExercises_catalog
  ON guidedExercises(status, sortOrder, id);

CREATE TABLE IF NOT EXISTS guidedExerciseMedia (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploading', -- uploading | ready | failed
  locale TEXT NOT NULL DEFAULT 'en-GB',
  source TEXT NOT NULL,                     -- coach | generated | imported
  transcript TEXT NOT NULL,
  durationMs INTEGER NOT NULL,
  objectKey TEXT NOT NULL UNIQUE,
  mimeType TEXT,
  byteLength INTEGER,
  sha256 TEXT,
  etag TEXT,
  readyAt TEXT,
  CHECK (status IN ('uploading', 'ready', 'failed')),
  CHECK (locale = 'en-GB'),
  CHECK (source IN ('coach', 'generated', 'imported')),
  CHECK (durationMs > 0 AND durationMs <= 15000)
);

CREATE INDEX IF NOT EXISTS idx_guidedExerciseMedia_status
  ON guidedExerciseMedia(status, createdAt);

CREATE TABLE IF NOT EXISTS guidedExerciseVersions (
  exerciseId TEXT NOT NULL,
  version INTEGER NOT NULL,
  schemaVersion INTEGER NOT NULL DEFAULT 1,
  locale TEXT NOT NULL DEFAULT 'en-GB',
  lifecycle TEXT NOT NULL DEFAULT 'draft', -- draft | published | superseded
  draftRevision INTEGER NOT NULL DEFAULT 1,
  specJson TEXT NOT NULL,
  exampleMediaId TEXT,
  contentHash TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  publishedAt TEXT,
  supersededAt TEXT,
  PRIMARY KEY (exerciseId, version),
  FOREIGN KEY (exerciseId) REFERENCES guidedExercises(id),
  FOREIGN KEY (exampleMediaId) REFERENCES guidedExerciseMedia(id),
  CHECK (version > 0),
  CHECK (schemaVersion = 1),
  CHECK (locale = 'en-GB'),
  CHECK (lifecycle IN ('draft', 'published', 'superseded'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_guidedExerciseVersions_oneDraft
  ON guidedExerciseVersions(exerciseId)
  WHERE lifecycle = 'draft';

CREATE INDEX IF NOT EXISTS idx_guidedExerciseVersions_lifecycle
  ON guidedExerciseVersions(exerciseId, lifecycle, version DESC);

-- Keep media readiness and attachment atomic. The worker checks readiness for
-- useful validation copy, while these triggers close the race with orphan GC.
CREATE TRIGGER IF NOT EXISTS trg_guidedExerciseVersions_readyMedia_insert
BEFORE INSERT ON guidedExerciseVersions
FOR EACH ROW
WHEN NEW.exampleMediaId IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
      FROM guidedExerciseMedia m
     WHERE m.id = NEW.exampleMediaId
       AND m.status = 'ready'
  )
BEGIN
  SELECT RAISE(ABORT, 'GUIDED_MEDIA_NOT_READY');
END;

CREATE TRIGGER IF NOT EXISTS trg_guidedExerciseVersions_readyMedia_update
BEFORE UPDATE OF exampleMediaId ON guidedExerciseVersions
FOR EACH ROW
WHEN NEW.exampleMediaId IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
      FROM guidedExerciseMedia m
     WHERE m.id = NEW.exampleMediaId
       AND m.status = 'ready'
  )
BEGIN
  SELECT RAISE(ABORT, 'GUIDED_MEDIA_NOT_READY');
END;

-- Content assignments only. User path progress remains device-local for v1.
-- dayNumber=0 is the week-level library used by the current Ascent UI; 1..7
-- are reserved for daily lesson slots.
CREATE TABLE IF NOT EXISTS pathLessonAssignments (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  pathId TEXT NOT NULL,
  weekNumber INTEGER NOT NULL,
  dayNumber INTEGER NOT NULL DEFAULT 0,
  slotNumber INTEGER NOT NULL,
  exerciseId TEXT NOT NULL,
  exerciseVersion INTEGER NOT NULL,
  FOREIGN KEY (exerciseId, exerciseVersion)
    REFERENCES guidedExerciseVersions(exerciseId, version),
  UNIQUE (pathId, weekNumber, dayNumber, slotNumber),
  CHECK (weekNumber > 0),
  CHECK (dayNumber BETWEEN 0 AND 7),
  CHECK (slotNumber > 0),
  CHECK (exerciseVersion > 0)
);

CREATE INDEX IF NOT EXISTS idx_pathLessonAssignments_path
  ON pathLessonAssignments(pathId, weekNumber, dayNumber, slotNumber);
