-- Guided exercise schema version 2: blocks that ask for loudness or a breath
-- rather than a note.
--
-- 0007 wrote CHECK (schemaVersion = 1) into guidedExerciseVersions, which is
-- the right instinct — a stored revision must declare which validator decodes
-- it — but SQLite cannot alter a CHECK in place. So the table is rebuilt.
--
-- Nothing about existing rows changes. Every current revision stays at
-- schemaVersion 1 and keeps being decoded by the frozen v1 validator; v2
-- differs only in accepting a `kind` on a target, which no v1 spec contains.

-- defer_foreign_keys rather than foreign_keys: D1 runs a migration inside a
-- transaction, where toggling enforcement is a no-op, and pathLessonAssignments
-- references the table being rebuilt. Deferring moves the check to COMMIT, by
-- which point every row points at the new table.
PRAGMA defer_foreign_keys = true;

CREATE TABLE guidedExerciseVersions_new (
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
  CHECK (schemaVersion IN (1, 2)),
  CHECK (locale = 'en-GB'),
  CHECK (lifecycle IN ('draft', 'published', 'superseded'))
);

INSERT INTO guidedExerciseVersions_new
  (exerciseId, version, schemaVersion, locale, lifecycle, draftRevision,
   specJson, exampleMediaId, contentHash, createdAt, updatedAt,
   publishedAt, supersededAt)
SELECT
  exerciseId, version, schemaVersion, locale, lifecycle, draftRevision,
  specJson, exampleMediaId, contentHash, createdAt, updatedAt,
  publishedAt, supersededAt
FROM guidedExerciseVersions;

DROP TABLE guidedExerciseVersions;
ALTER TABLE guidedExerciseVersions_new RENAME TO guidedExerciseVersions;

-- Indexes and triggers went with the old table; 0007's definitions, verbatim.
CREATE UNIQUE INDEX IF NOT EXISTS idx_guidedExerciseVersions_oneDraft
  ON guidedExerciseVersions(exerciseId)
  WHERE lifecycle = 'draft';

CREATE INDEX IF NOT EXISTS idx_guidedExerciseVersions_lifecycle
  ON guidedExerciseVersions(exerciseId, lifecycle, version DESC);

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
