import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const MEDIA_REFERENCE_NOT_READY = 'GUIDED_MEDIA_NOT_READY'
const NOW = '2026-07-26T12:00:00.000Z'
const SCHEMA_FILES = [
  'scripts/migrate-guided-exercises.sql',
  'workers/db-worker/schema.sql',
]

function openSchema(file) {
  const database = new DatabaseSync(':memory:')
  const schema = readFileSync(resolve(process.cwd(), file), 'utf8')
  database.exec(schema)
  // Both schema entry points are documented as safe to re-run.
  database.exec(schema)
  return database
}

function insertExercise(database, id) {
  database
    .prepare(
      `INSERT INTO guidedExercises
        (id, createdAt, updatedAt, category, level)
       VALUES (?, ?, ?, 'tone', 'foundation')`,
    )
    .run(id, NOW, NOW)
}

function insertMedia(database, id, status) {
  database
    .prepare(
      `INSERT INTO guidedExerciseMedia
        (id, createdAt, updatedAt, status, source, transcript, durationMs,
         objectKey, readyAt)
       VALUES (?, ?, ?, ?, 'coach', 'ng', 5000, ?, ?)`,
    )
    .run(
      id,
      NOW,
      NOW,
      status,
      `guided-exercise-media/${id}/playback`,
      status === 'ready' ? NOW : null,
    )
}

function expectMediaConflict(callback) {
  assert.throws(callback, (error) =>
    String(error).includes(MEDIA_REFERENCE_NOT_READY),
  )
}

for (const schemaFile of SCHEMA_FILES) {
  const database = openSchema(schemaFile)
  try {
    insertExercise(database, 'insert-check')
    insertExercise(database, 'update-check')
    insertExercise(database, 'ready-check')
    insertMedia(database, 'uploading-media', 'uploading')
    insertMedia(database, 'ready-media', 'ready')

    expectMediaConflict(() =>
      database
        .prepare(
          `INSERT INTO guidedExerciseVersions
            (exerciseId, version, specJson, exampleMediaId, createdAt, updatedAt)
           VALUES ('insert-check', 1, '{}', 'uploading-media', ?, ?)`,
        )
        .run(NOW, NOW),
    )

    database
      .prepare(
        `INSERT INTO guidedExerciseVersions
          (exerciseId, version, specJson, createdAt, updatedAt)
         VALUES ('update-check', 1, '{}', ?, ?)`,
      )
      .run(NOW, NOW)

    expectMediaConflict(() =>
      database
        .prepare(
          `UPDATE guidedExerciseVersions
              SET exampleMediaId = 'uploading-media'
            WHERE exerciseId = 'update-check' AND version = 1`,
        )
        .run(),
    )

    database
      .prepare(
        `INSERT INTO guidedExerciseVersions
          (exerciseId, version, specJson, exampleMediaId, createdAt, updatedAt)
         VALUES ('ready-check', 1, '{}', 'ready-media', ?, ?)`,
      )
      .run(NOW, NOW)
    database
      .prepare(
        `UPDATE guidedExerciseVersions
            SET exampleMediaId = 'ready-media'
          WHERE exerciseId = 'update-check' AND version = 1`,
      )
      .run()

    const inserted = database
      .prepare(
        `SELECT exampleMediaId
           FROM guidedExerciseVersions
          WHERE exerciseId = 'ready-check' AND version = 1`,
      )
      .get()
    const updated = database
      .prepare(
        `SELECT exampleMediaId
           FROM guidedExerciseVersions
          WHERE exerciseId = 'update-check' AND version = 1`,
      )
      .get()
    assert.equal(inserted.exampleMediaId, 'ready-media')
    assert.equal(updated.exampleMediaId, 'ready-media')
  } finally {
    database.close()
  }
}

console.log(
  `Guided exercise schema checks passed for ${SCHEMA_FILES.join(' and ')}`,
)
