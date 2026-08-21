// ============================================================
// The database has to hold every surface the catalog knows
// ============================================================
//
// `premiumBackgroundAssets.surface` carries a CHECK constraint, and SQLite
// cannot alter one in place — widening it means rebuilding the table and the
// whole graph of tables that reference it. So a surface added to the catalog
// without a matching migration does not fail loudly at build time: it fails
// the first time somebody tries to create a background on it in Studio, with
// a constraint error and a half-finished upload.
//
// That is exactly the state Guitar Night was in until 0031. This test is the
// tripwire, in the only form that does not need a live D1: read the newest
// definition of the column out of the migrations and compare it against the
// surfaces the shared catalog declares.
//
// It lives under `src/` rather than beside the worker because it reads the
// migration files off disk. `workers/db-worker/tsconfig.json` declares
// `types: ["@cloudflare/workers-types"]` deliberately — the worker has no Node
// runtime — so `node:fs` does not resolve there and `pnpm typecheck:db` fails
// on the import alone. The migrations path is resolved from the workspace
// root, which is where vitest runs from in either project.

import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BACKGROUND_CATALOG } from './background-catalog'

// Repo-relative: vitest runs from the workspace root, and `import.meta.url`
// is not a file URL under its transform.
const MIGRATIONS = 'workers/db-worker/migrations'

/** The last `surface TEXT NOT NULL CHECK (...)` any migration declares. */
function currentSurfaceCheck(): string {
  const files = readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort()
  let latest: string | null = null
  for (const file of files) {
    const sql = readFileSync(`${MIGRATIONS}/${file}`, 'utf8')
    const matches = [
      ...sql.matchAll(
        /surface TEXT NOT NULL\s*CHECK \(surface IN \(([^)]*)\)/g,
      ),
    ]
    const last = matches.at(-1)
    if (last !== undefined) latest = last[1]
  }
  if (latest === null) throw new Error('No surface CHECK found in migrations')
  return latest
}

describe('the premium background surface constraint', () => {
  it('accepts every surface the catalog declares', () => {
    const allowed = currentSurfaceCheck()
    const surfaces = [
      ...new Set(BACKGROUND_CATALOG.map((background) => background.surface)),
    ]
    expect(surfaces.length).toBeGreaterThan(0)
    for (const surface of surfaces) {
      expect(allowed).toContain(`'${surface}'`)
    }
  })

  it('accepts guitar, which is what 0031 was for', () => {
    expect(currentSurfaceCheck()).toContain("'guitar'")
  })

  it('accepts drum, which is what 0033 is for', () => {
    expect(currentSurfaceCheck()).toContain("'drum'")
  })
})
