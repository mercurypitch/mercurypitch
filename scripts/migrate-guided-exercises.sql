-- Existing D1 databases: guided Zen exercise authoring, immutable versions,
-- one managed playback asset, and version-pinned Ascent assignments.
--
-- Safe to re-run: table and index creation is guarded with IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS guidedExercises (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  category TEXT NOT NULL,
  level TEXT NOT NULL,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
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
  status TEXT NOT NULL DEFAULT 'uploading',
  locale TEXT NOT NULL DEFAULT 'en-GB',
  source TEXT NOT NULL,
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
  lifecycle TEXT NOT NULL DEFAULT 'draft',
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

-- Media attachment must be checked by SQLite in the same transaction as the
-- version write. An application-level SELECT can race orphan cleanup between
-- the readiness check and INSERT/UPDATE.
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
