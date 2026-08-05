// ============================================================
// Prod content seed — port authored content from dev to prod
// ============================================================
//
// A fresh production database has the migration chain and nothing else.
// Definitions come from `src/db/seed-data.json` (a file), but the Karaoke
// Night demo songs were authored against **dev** and live only in dev's
// D1 — without them prod's Karaoke page falls back to the single manifest
// shipped in the build and the second song simply is not on the bill.
//
// The guided exercises are the interesting exception, and they are OFF by
// default. `guidedExercises` is an override layer, not the source: the
// eight bundled definitions in `src/features/zen/exercise-catalog.ts` ship
// in the build, and `guided-content-store.ts` calls
// `restoreSeedZenExercises()` when the API returns nothing. Dev's eight
// published rows carry byte-identical ids and specs to those seeds, so
// seeding them buys nothing — and `installPublishedZenExercises()`
// REPLACES the catalogue wholesale, so a DB spec is strictly poorer than
// the seed it displaces: the static `exampleAudio` on
// `mah-meh-mee-moh-moo` cannot survive the round trip (the publish path
// derives that field from `exampleMediaId`, which points into the dev
// media bucket). Pass `--with-exercises` only when prod genuinely needs
// an exercise the build does not carry.
//
// So this reads dev and emits SQL. It never writes anything: the output is
// a file you inspect and then apply with one `wrangler d1 execute`, which
// keeps the production write a deliberate act rather than a side effect of
// running a script.
//
// Every statement is an idempotent upsert on the natural key, so applying
// it twice changes nothing and applying it after an edit updates content
// while leaving ids — and therefore per-user progress that points at them
// — attached.
//
// Usage:
//   node scripts/gen-prod-content-sql.mjs > prod-content.sql
//   node scripts/gen-prod-content-sql.mjs --with-exercises --with-media
//
// Media (the coach audio clips) is EXCLUDED by default. The rows are
// pointers into the `mercurypitch-guided-media-dev` R2 bucket; seeding
// them into prod would hand prod a set of object keys that exist in the
// wrong bucket, and the exercise UI is honest about missing audio while it
// is not honest about audio that 404s. Copy the objects to
// `mercurypitch-guided-media-prod` first, then re-run with `--with-media`.

import { execFileSync } from 'node:child_process'
import { buildStatements as definitionStatements } from './gen-preview-definitions-sql.mjs'

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 ? process.argv[i + 1] : fallback
}
const flag = (name) => process.argv.includes(`--${name}`)

const FROM = arg('from', 'mercurypitch-db-dev')
const WITH_EXERCISES = flag('with-exercises')
const WITH_MEDIA = flag('with-media')
const WITH_DEFINITIONS = !flag('no-definitions')

/** Read rows out of the source database. Read-only by construction. */
function query(sql) {
  const out = execFileSync(
    'pnpm',
    [
      'exec',
      'wrangler',
      'd1',
      'execute',
      FROM,
      '--remote',
      '--json',
      '--command',
      sql,
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] },
  )
  return JSON.parse(out)[0].results
}

function sqlValue(v) {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'boolean') return v ? '1' : '0'
  if (typeof v === 'number') return String(v)
  return `'${String(v).replace(/'/g, "''")}'`
}

/**
 * One upsert per row, with every column named.
 *
 * `keys` is the row's identity — the conflict target, and the one thing
 * never in the update list. Everything else is overwritten, so a column
 * dropped from the source is reset rather than left stale.
 */
function upserts(table, rows, keys, { skipUpdate = [] } = {}) {
  if (rows.length === 0) return []
  const cols = Object.keys(rows[0])
  const updates = cols
    .filter((c) => !keys.includes(c) && !skipUpdate.includes(c))
    .map((c) => `${c} = excluded.${c}`)
  return rows.map(
    (row) =>
      `INSERT INTO ${table} (${cols.join(', ')})\n` +
      `VALUES (${cols.map((c) => sqlValue(row[c])).join(', ')})\n` +
      `ON CONFLICT(${keys.join(', ')}) DO UPDATE SET ${updates.join(', ')};`,
  )
}

const sections = []
const counts = {}

// ── Definitions ─────────────────────────────────────────────────────
// From the repo, not from dev: seed-data.json is the source of truth and
// dev may carry studio edits that were never meant to ship.
//
// These same rows also have an established release path,
// `pnpm db:seed --url … --admin-key …`, which posts them through the
// Worker. Including them here folds that step into this one write and
// needs no admin key; the statements come from the very emitter CI already
// trusts for PR previews, so the two agree by construction rather than by
// discipline. Pass `--no-definitions` to leave them to `pnpm db:seed`.
if (WITH_DEFINITIONS) {
  const defs = definitionStatements()
  sections.push([
    'challenge / badge / achievement definitions (seed-data.json)',
    defs,
  ])
  counts.definitions = defs.length
}

// ── Guided exercises (opt-in) ───────────────────────────────────────
// Published versions only, and only exercises that HAVE one. A draft is
// by definition not ready, and an exercise row without a version is worse
// than a missing exercise: the catalogue lists it and it opens to nothing.
// Dev currently carries one such leftover (`untitled-exercise`).
if (WITH_EXERCISES) {
  const exercises = query(
    `SELECT e.* FROM guidedExercises e
      WHERE e.status = 'active'
        AND EXISTS (
          SELECT 1 FROM guidedExerciseVersions v
           WHERE v.exerciseId = e.id AND v.lifecycle = 'published'
        )
      ORDER BY e.sortOrder, e.id`,
  )
  sections.push([
    'guided exercises',
    upserts('guidedExercises', exercises, ['id'], { skipUpdate: ['createdAt'] }),
  ])
  counts.exercises = exercises.length

  const versions = query(
    `SELECT * FROM guidedExerciseVersions WHERE lifecycle = 'published' ORDER BY exerciseId, version`,
  )
  // The media pointer is dropped unless the media rows travel too, or the
  // FK has nothing to point at.
  const versionRows = WITH_MEDIA
    ? versions
    : versions.map((v) => ({ ...v, exampleMediaId: null }))
  sections.push([
    `guided exercise versions (published${WITH_MEDIA ? '' : ', media pointers cleared'})`,
    upserts('guidedExerciseVersions', versionRows, ['exerciseId', 'version'], {
      skipUpdate: ['createdAt'],
    }),
  ])
  counts.versions = versionRows.length

  if (WITH_MEDIA) {
    const media = query(
      `SELECT * FROM guidedExerciseMedia WHERE status = 'ready' ORDER BY id`,
    )
    sections.push([
      'guided exercise media',
      upserts('guidedExerciseMedia', media, ['id'], {
        skipUpdate: ['createdAt'],
      }),
    ])
    counts.media = media.length
  }
}

// ── Demo songs ──────────────────────────────────────────────────────
// `lyricsRevision` is deliberately NOT updated on conflict: it is the
// client's re-seed cue, and copying dev's number backwards over a prod row
// that has moved ahead would strand an authored correction.
const demoSongs = query(`SELECT * FROM demoSongs ORDER BY createdAt`)
sections.push([
  'Karaoke Night demo songs',
  upserts('demoSongs', demoSongs, ['slug'], {
    skipUpdate: ['id', 'createdAt', 'lyricsRevision'],
  }),
])
counts.demoSongs = demoSongs.length

// ── Output ──────────────────────────────────────────────────────────
const header = [
  `-- Generated by scripts/gen-prod-content-sql.mjs from ${FROM}.`,
  '-- Idempotent: every statement is an upsert on the natural key.',
  '-- Apply AFTER the migration chain, or the tables will not exist yet:',
  '--   pnpm exec wrangler d1 execute mercurypitch-db --remote --file=prod-content.sql',
  '--',
  ...Object.entries(counts).map(([k, v]) => `--   ${k}: ${v}`),
  WITH_EXERCISES
    ? WITH_MEDIA
      ? '--   media INCLUDED — object keys must already exist in the prod bucket.'
      : '--   media EXCLUDED (no audio). Re-run with --with-media once copied.'
    : '--   exercises EXCLUDED — the build ships the same catalogue. --with-exercises to include.',
  '',
]

const body = sections
  .filter(([, statements]) => statements.length > 0)
  .map(([label, statements]) => `-- ── ${label} ──\n\n${statements.join('\n\n')}`)
  .join('\n\n')

process.stdout.write(`${header.join('\n')}\n${body}\n`)
