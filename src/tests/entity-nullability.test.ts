// @vitest-environment node
// ============================================================
// Entity types must agree with the schema about null
// ============================================================
//
// The bug this exists to prevent shipped twice and hid both times, because
// it is the one kind of wrong type the compiler cannot flag on its own.
//
// A nullable D1 column reaches the app as a literal `null`: `fromSql`
// (workers/db-worker/src/tables.ts) converts only boolCols and jsonCols, and
// the server adapter hands `res.json()` straight through. So an entity field
// declared `?: string` over a nullable column type-checks everywhere, and
// every `x !== undefined` guard written against it passes at runtime on null.
//
// What that cost: challenge and achievement cards dated every unfinished row
// to 1 Jan 1970 (`new Date(null).getTime()` is 0, not NaN), and
// `countActivity` collapsed every ref-less row onto the key `kind:null`, so
// twenty melodies counted as one. Both were invisible to tsc and to review.
//
// This reads the migrations — the actual source of truth — and fails if any
// declared field disagrees with its column about whether null is possible.
// It follows the allowlist-drift test in hybrid-adapter.test.ts, which
// likewise parses worker source rather than importing across the project
// boundary (the worker is a separate tsconfig with its own globals).
//
// Deliberately NOT asserted: whether a field is optional (`?`). That is a
// write-side question with legitimate answers on both sides — a NOT NULL
// column with a DEFAULT is omittable on write, and a column outside
// publicCols is absent from a stranger's read. Nullability has no such
// ambiguity, so that is what gets pinned.

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CLOUD_ENTITIES } from '@/db/adapters/hybrid-adapter'

const ROOT = resolve(__dirname, '../..')
const MIGRATIONS_DIR = resolve(ROOT, 'workers/db-worker/migrations')
const ENTITIES_FILE = resolve(ROOT, 'src/db/entities.ts')

/**
 * Which interface in entities.ts describes which table.
 *
 * Hand-written because the link only exists at `getRepository<T>('name')`
 * call sites, which is not something to parse. A cloud entity missing from
 * here fails the coverage test below, so the map cannot silently rot.
 */
const ENTITY_TABLES: Readonly<Record<string, string>> = {
  UserProfile: 'userProfiles',
  SessionRecord: 'sessionRecords',
  Voiceprint: 'voiceprints',
  ChallengeDefinition: 'challengeDefinitions',
  ChallengeProgress: 'challengeProgress',
  BadgeDefinition: 'badgeDefinitions',
  UserBadge: 'userBadges',
  Achievement: 'achievements',
  UserAchievement: 'userAchievements',
  LeaderboardEntry: 'leaderboardEntries',
  League: 'leagues',
  LeagueCohort: 'leagueCohorts',
  LeagueMembership: 'leagueMembership', // singular, unlike its neighbours
  LeaguePointsConfig: 'leaguePointsConfig',
  SharedMelody: 'sharedMelodies',
  SharedSession: 'sharedSessions',
  FeatureFlag: 'featureFlags',
  UserSetting: 'userSettings',
  Follow: 'follows',
  UserActivity: 'userActivity',
  SongManifest: 'songManifests',
  UserSurveyResponse: 'userSurveyResponses',
}

// ── Migration parsing ────────────────────────────────────────────

interface Column {
  nullable: boolean
}
type Schema = Map<string, Map<string, Column>>

/** Strip `--` line comments without touching string literals' contents. */
function stripComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => {
      const i = line.indexOf('--')
      return i === -1 ? line : line.slice(0, i)
    })
    .join('\n')
}

/** Split a CREATE TABLE body on commas that are not inside parentheses. */
function splitTopLevel(body: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const ch of body) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(current)
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim() !== '') parts.push(current)
  return parts
}

const CONSTRAINT_START =
  /^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|CONSTRAINT)\b/i

/**
 * Replay every migration in filename order — the order wrangler applies them
 * in — so the result is the schema as it actually stands, including the
 * create-copy-drop-rename table rebuilds in 0014 and 0023.
 */
function buildSchema(): Schema {
  const schema: Schema = new Map()
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  expect(files.length).toBeGreaterThan(0)

  for (const file of files) {
    const sql = stripComments(
      readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8'),
    )

    for (const m of sql.matchAll(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(/gi,
    )) {
      const table = m[1]!
      // Walk from the opening paren to its match, so CHECK(...) does not end
      // the body early.
      let depth = 0
      let end = -1
      for (let i = m.index! + m[0].length - 1; i < sql.length; i++) {
        if (sql[i] === '(') depth++
        else if (sql[i] === ')') {
          depth--
          if (depth === 0) {
            end = i
            break
          }
        }
      }
      expect(
        end,
        `unterminated CREATE TABLE ${table} in ${file}`,
      ).toBeGreaterThan(0)
      const cols = new Map<string, Column>()
      for (const raw of splitTopLevel(sql.slice(m.index! + m[0].length, end))) {
        const part = raw.trim()
        if (part === '' || CONSTRAINT_START.test(part)) continue
        // `key` is a reserved word, so those columns are declared as `"key"`.
        const name = /^"?([A-Za-z_][A-Za-z0-9_]*)"?/.exec(part)?.[1]
        if (name === undefined) continue
        // PRIMARY KEY implies NOT NULL for the purposes of what can come back.
        const notNull =
          /\bNOT\s+NULL\b/i.test(part) || /\bPRIMARY\s+KEY\b/i.test(part)
        cols.set(name, { nullable: !notNull })
      }
      schema.set(table, cols)
    }

    for (const m of sql.matchAll(
      /ALTER\s+TABLE\s+([A-Za-z_][A-Za-z0-9_]*)\s+ADD\s+COLUMN\s+([A-Za-z_][A-Za-z0-9_]*)([^;]*);/gi,
    )) {
      const cols = schema.get(m[1]!)
      if (cols === undefined) continue
      cols.set(m[2]!, { nullable: !/\bNOT\s+NULL\b/i.test(m[3]!) })
    }

    for (const m of sql.matchAll(
      /ALTER\s+TABLE\s+([A-Za-z_][A-Za-z0-9_]*)\s+RENAME\s+TO\s+([A-Za-z_][A-Za-z0-9_]*)/gi,
    )) {
      const cols = schema.get(m[1]!)
      if (cols === undefined) continue
      schema.delete(m[1]!)
      schema.set(m[2]!, cols)
    }

    for (const m of sql.matchAll(
      /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([A-Za-z_][A-Za-z0-9_]*)/gi,
    )) {
      schema.delete(m[1]!)
    }
  }
  return schema
}

// ── entities.ts parsing ──────────────────────────────────────────

interface Field {
  /** Only nullability is recorded — see the note on `?` at the top. */
  nullable: boolean
}

/**
 * Pull each interface's own top-level fields out of entities.ts.
 *
 * Only depth-1 lines count, so the nested object in `Voiceprint.summary` does
 * not contribute phantom fields of its own.
 */
function parseEntities(): Map<string, Map<string, Field>> {
  const src = readFileSync(ENTITIES_FILE, 'utf8')
  const out = new Map<string, Map<string, Field>>()
  const lines = src.split('\n')
  let current: Map<string, Field> | null = null
  let depth = 0

  for (const line of lines) {
    if (current === null) {
      const start = /^export interface ([A-Za-z0-9_]+)[^{]*\{/.exec(line)
      if (start !== null) {
        current = new Map()
        out.set(start[1]!, current)
        depth = 1
      }
      continue
    }
    const opens = (line.match(/\{/g) ?? []).length
    const closes = (line.match(/\}/g) ?? []).length
    if (depth === 1) {
      const field = /^\s{2}([A-Za-z0-9_]+)\??:\s*(.+?)$/.exec(line)
      if (field !== null) {
        current.set(field[1]!, {
          nullable: /(^|[|\s])null(\s|$|\[|,)/.test(` ${field[2]!} `),
        })
      }
    }
    depth += opens - closes
    if (depth <= 0) current = null
  }
  return out
}

// ── The checks ───────────────────────────────────────────────────

const schema = buildSchema()
const entities = parseEntities()

describe('the migration parser', () => {
  it('finds the tables the entities are meant to map to', () => {
    // A silent parse failure would make every check below vacuously pass.
    const missing = Object.entries(ENTITY_TABLES)
      .filter(([, table]) => !schema.has(table))
      .map(([entity, table]) => `${entity} -> ${table}`)
    expect(missing).toEqual([])
  })

  it('reads columns for every mapped table', () => {
    // Distinct from the test above: a table that parsed to zero columns is a
    // parser bug, while a table that is absent is a wrong name in the map.
    const empty = Object.values(ENTITY_TABLES).filter((t) => {
      const cols = schema.get(t)
      return cols !== undefined && cols.size === 0
    })
    expect(empty).toEqual([])
  })

  it('parses every entity interface it maps', () => {
    const missing = Object.keys(ENTITY_TABLES).filter((e) => !entities.has(e))
    expect(missing).toEqual([])
  })
})

describe('entity types agree with the schema about null', () => {
  it('declares `| null` for exactly the nullable columns', () => {
    const wrong: string[] = []
    for (const [entity, table] of Object.entries(ENTITY_TABLES)) {
      const cols = schema.get(table)
      const fields = entities.get(entity)
      if (cols === undefined || fields === undefined) continue
      for (const [name, field] of fields) {
        const col = cols.get(name)
        if (col === undefined) continue // phantom fields are a separate test
        if (col.nullable && !field.nullable) {
          wrong.push(
            `${entity}.${name} is missing \`| null\` (${table}.${name} is nullable)`,
          )
        } else if (!col.nullable && field.nullable) {
          wrong.push(
            `${entity}.${name} declares \`| null\` (${table}.${name} is NOT NULL)`,
          )
        }
      }
    }
    expect(wrong).toEqual([])
  })

  it('declares no field without a column behind it', () => {
    // How the phantom `LeaderboardEntry.longestStreak` was found: it only
    // ever existed in the worker's derived leaderboard payload, never in the
    // table, while the type claimed both.
    const phantom: string[] = []
    for (const [entity, table] of Object.entries(ENTITY_TABLES)) {
      const cols = schema.get(table)
      const fields = entities.get(entity)
      if (cols === undefined || fields === undefined) continue
      for (const name of fields.keys()) {
        if (!cols.has(name))
          phantom.push(`${entity}.${name} (no ${table}.${name})`)
      }
    }
    expect(phantom).toEqual([])
  })
})

describe('the entity/table map stays complete', () => {
  it('maps every cloud entity', () => {
    // A new entity routed to the cloud without an entry here would never be
    // nullability-checked at all — the exact silence this test exists to end.
    const mapped = new Set(Object.values(ENTITY_TABLES))
    const unmapped = [...CLOUD_ENTITIES].filter((t) => !mapped.has(t))
    expect(unmapped).toEqual([])
  })
})
