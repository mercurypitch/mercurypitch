// ============================================================
// Reconcile a live D1 against the shape the migrations assume
// ============================================================
//
// `0001_baseline.sql` declares every column inside
// `CREATE TABLE IF NOT EXISTS`, and that is a no-op on a table that already
// exists — it does not compare shapes. A database built by
// `d1 execute schema.sql` before the numbered-migration era therefore keeps
// its old version of every table, and any column the baseline added to an
// already-existing table never arrives. Columns added AFTER the baseline are
// fine: those ship as `ALTER TABLE ... ADD COLUMN` migrations, which do reach
// every database.
//
// The failure is quiet in the worst way. The chain reports success while the
// app writes to columns that are not there — one D1 error per write, at
// runtime, on the environment nobody tests against. Worse, where the baseline
// builds an index over such a column the FIRST migration fails outright.
//
// So this closes the gap, and derives what to close it with rather than being
// told:
//
//   1. Apply ONLY `0001_baseline.sql` to a throwaway local database. That is
//      the shape the chain assumes before it starts altering.
//   2. Read the target database's actual shape.
//   3. For every table BOTH have, add the columns the reference has and the
//      target does not, carrying the reference's own type and default.
//
// Step 1 is why there is no list to maintain, and why a new migration cannot
// break this. A column some later migration adds by ALTER is absent from a
// baseline-only reference, so it is never pre-added here, so that migration
// still finds it missing and still succeeds. A table the baseline never had is
// absent from the target, so it is left for the migration that creates it
// whole. The migrations are the source of truth; this reads them.
//
// Run it BEFORE `d1 migrations apply` — the chain has to meet a shape it
// recognises. `deploy-db.yml` does exactly that. It is a no-op against any
// database the migrations built, which is every environment except the one
// legacy production database.
//
// Usage:
//   node scripts/reconcile-d1-schema.mjs --db mercurypitch-db-dev --env dev
//   node scripts/reconcile-d1-schema.mjs --db mercurypitch-db --env prod --apply
//
// Without `--apply` it prints the statements and changes nothing. Add
// `--local --persist-to <dir>` to reconcile a local replica instead of a
// remote database, which is how this gets tested.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 ? process.argv[i + 1] : fallback
}
const flag = (name) => process.argv.includes(`--${name}`)

const DB = arg('db', 'mercurypitch-db')
const ENV = arg('env', 'prod')
const APPLY = flag('apply')
const LOCAL = flag('local')
const PERSIST_TO = arg('persist-to', null)
const WORKER_DIR = 'workers/db-worker'
const BASELINE = 'migrations/0001_baseline.sql'

/** Every column of every table, with the detail needed to re-add one. */
const SHAPE_QUERY = [
  'SELECT m.name AS tbl, p.name AS col, p.type AS ty,',
  'p."notnull" AS nn, p.dflt_value AS dv',
  'FROM sqlite_master m JOIN pragma_table_info(m.name) p',
  "WHERE m.type = 'table'",
  "AND m.name NOT LIKE 'sqlite_%' AND m.name NOT LIKE '_cf_%'",
].join(' ')

function d1(where, args) {
  const out = execFileSync(
    'pnpm',
    ['exec', 'wrangler', 'd1', 'execute', DB, ...where, ...args],
    {
      cwd: WORKER_DIR,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  )
  return out
}

// `--env` is not optional even for a local throwaway: each environment binds
// its own database NAME (dev binds mercurypitch-db-dev, prod mercurypitch-db),
// and wrangler resolves the name against the selected environment's config or
// refuses to run at all.
const ENV_ARGS = ['--env', ENV]

/** Where the target database lives: the remote, or a local replica. */
const target = LOCAL
  ? ['--local', '--persist-to', PERSIST_TO ?? '.wrangler/state', ...ENV_ARGS]
  : ['--remote', ...ENV_ARGS, '-y']

/** Group flat {tbl,col,...} rows into Map<table, Map<column, detail>>. */
function shapeOf(rows) {
  const tables = new Map()
  for (const r of rows) {
    if (!tables.has(r.tbl)) tables.set(r.tbl, new Map())
    tables
      .get(r.tbl)
      .set(r.col, { type: r.ty, notNull: r.nn === 1, dflt: r.dv })
  }
  return tables
}

function readShape(where) {
  const raw = d1(where, ['--json', '--command', SHAPE_QUERY])
  return shapeOf(JSON.parse(raw)[0].results)
}

// ---- 1. the reference: the baseline, and nothing after it ----
const scratch = mkdtempSync(join(tmpdir(), 'd1-reference-'))
let reference
try {
  const ref = ['--local', '--persist-to', scratch, ...ENV_ARGS]
  d1(ref, ['--file', BASELINE])
  reference = readShape(ref)
} finally {
  rmSync(scratch, { recursive: true, force: true })
}

// ---- 2. the target as it actually is ----
const actual = readShape(target)

// ---- 3. the difference, restricted to tables both have ----
const missing = []
const unfixable = []
for (const [table, columns] of reference) {
  if (!actual.has(table)) continue
  const present = actual.get(table)
  for (const [column, detail] of columns) {
    if (present.has(column)) continue
    // SQLite cannot add a NOT NULL column without a default to a table that
    // already has rows. Report it rather than emit a statement that fails.
    if (detail.notNull && detail.dflt === null) {
      unfixable.push({ table, column, detail })
      continue
    }
    missing.push({ table, column, detail })
  }
}

const statements = missing.map(({ table, column, detail }) => {
  const parts = [detail.type]
  if (detail.notNull) parts.push('NOT NULL')
  if (detail.dflt !== null) parts.push(`DEFAULT ${detail.dflt}`)
  return `ALTER TABLE ${table} ADD COLUMN ${column} ${parts.join(' ')};`
})

const label = LOCAL ? `${DB} (local)` : `${DB} (${ENV})`

if (unfixable.length > 0) {
  process.stderr.write(
    [
      `${label} is missing ${unfixable.length} NOT NULL column(s) that have no`,
      'default, which SQLite cannot add to a table that already has rows:',
      ...unfixable.map(
        ({ table, column, detail }) => `  ${table}.${column} ${detail.type}`,
      ),
      'That needs a table rebuild, by hand, with a decision about what the',
      'existing rows should hold. Nothing has been changed.',
      '',
    ].join('\n'),
  )
  process.exit(1)
}

if (statements.length === 0) {
  process.stderr.write(
    `${label} already has every column the migrations assume. Nothing to do.\n`,
  )
  process.exit(0)
}

process.stderr.write(
  [
    `${label} is missing ${statements.length} column(s) that`,
    '0001_baseline.sql declares on a table it already had, so',
    'CREATE TABLE IF NOT EXISTS skipped them:',
    '',
    ...statements.map((s) => `  ${s}`),
    '',
  ].join('\n'),
)

if (!APPLY) {
  process.stderr.write('Re-run with --apply to apply them.\n')
  process.stdout.write(`${statements.join('\n')}\n`)
  process.exit(0)
}

d1(target, ['--command', statements.join(' ')])
process.stderr.write(`Applied ${statements.length} column(s) to ${label}.\n`)
