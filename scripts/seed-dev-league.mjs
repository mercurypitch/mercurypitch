#!/usr/bin/env node
// ============================================================
// seed-dev-league.mjs — populate a LOCAL D1 so the social surfaces
// (Leaderboard + League) are actually worth looking at in dev
// ============================================================
//
// The problem this solves: a fresh local database shows an empty leaderboard
// and an empty league, so there is nothing to eyeball while building them.
// Playing enough sessions by hand to fill seven rungs is not a reasonable
// ask. This seeds believable competitors, standings, and history instead.
//
// LOCAL ONLY, by construction. Every statement runs through
// `wrangler d1 execute --local`, which touches wrangler's on-disk SQLite —
// never a deployed database. There is deliberately no --remote path here:
// this writes fake users and fake scores, which must never reach dev or prod.
//
// Usage:
//   pnpm dev:seed                      # seed + make YOUR account competitive
//   node scripts/seed-dev-league.mjs --email you@example.com
//   node scripts/seed-dev-league.mjs --reset    # wipe seeded rows first
//
// It is idempotent: re-running replaces the seeded cohort rather than
// stacking duplicates. Seeded rows all carry the 'dev-' id prefix so
// --reset can find them without touching anything you created by hand.

import { execFileSync } from 'node:child_process'
import { rmSync, writeFileSync } from 'node:fs'

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG = 'workers/db-worker/wrangler.jsonc'
const DB = 'mercurypitch-db'
const WORKER_PORT = 8788

const args = process.argv.slice(2)
const arg = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : null
}
const RESET = args.includes('--reset')
const EMAIL = arg('email')

// ── The lock ─────────────────────────────────────────────────────────
//
// `wrangler dev` holds a write lock on the local D1 sqlite file for as long
// as it runs, and `wrangler d1 execute --local` is a SEPARATE process that
// wants the same lock. Every write below would otherwise block until the
// worker touched the database (a page reload is enough) and then die with
// `SQLITE_BUSY`. So: writes are buffered and land in ONE execute call, and
// we refuse up front if the worker is up rather than hanging on the lock.

const busyHelp = () =>
  [
    '',
    'The local database is locked by a running db-worker.',
    '',
    'wrangler dev holds the sqlite write lock, so seeding cannot run at the',
    'same time. Stop it, seed, start it again:',
    '',
    '  1. stop `pnpm dev:db` (Ctrl-C in its terminal)',
    '  2. pnpm dev:seed',
    '  3. pnpm dev:db',
    '',
    'Your app can keep running throughout — only the worker has to pause.',
  ].join('\n')

/** Is something listening on the db-worker port? */
function workerRunning() {
  try {
    execFileSync(
      'node',
      [
        '-e',
        `const s=require('net').connect(${WORKER_PORT},'127.0.0.1');` +
          `s.on('connect',()=>{s.destroy();process.exit(0)});` +
          `s.on('error',()=>process.exit(1));` +
          `setTimeout(()=>process.exit(1),700)`,
      ],
      { stdio: 'ignore' },
    )
    return true
  } catch {
    return false
  }
}

const writes = []
/** Buffer a write. Nothing touches the database until flush(). */
function sql(command) {
  writes.push(command.trim().replace(/;+\s*$/, '') + ';')
}

function run(wranglerArgs) {
  try {
    return execFileSync(
      'pnpm',
      ['exec', 'wrangler', 'd1', 'execute', DB, '--local', '--config', CONFIG, '-y', ...wranglerArgs],
      { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
  } catch (err) {
    const text = `${err.stdout ?? ''}${err.stderr ?? ''}`
    if (/SQLITE_BUSY|database is locked/i.test(text)) {
      console.error(busyHelp())
      process.exit(1)
    }
    throw err
  }
}

/** Apply every buffered write in a single statement batch. */
function flush() {
  if (writes.length === 0) return
  const file = join(REPO_ROOT, '.seed-dev-league.sql')
  writeFileSync(file, writes.join('\n') + '\n')
  try {
    run(['--file', file])
  } finally {
    rmSync(file, { force: true })
    writes.length = 0
  }
}

/** Read immediately (reads still need the buffered writes applied first). */
function query(command) {
  flush()
  try {
    const parsed = JSON.parse(run(['--json', '--command', command]))
    return (Array.isArray(parsed) ? parsed[0] : parsed)?.results ?? []
  } catch {
    return []
  }
}

if (workerRunning()) {
  console.error(busyHelp())
  process.exit(1)
}

const q = (s) => String(s).replace(/'/g, "''")
const nowIso = new Date().toISOString()

/** ISO Monday 00:00 UTC, `weeksAgo` weeks back. */
function weekStart(weeksAgo = 0) {
  const now = new Date()
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  monday.setUTCDate(monday.getUTCDate() - ((now.getUTCDay() + 6) % 7) - weeksAgo * 7)
  return monday.toISOString()
}

// ── Preflight: are the league tables even here? ──────────────────────

const tables = query(
  "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('leagues','leagueMembership','leagueCohorts','userProfiles')",
).map((r) => r.name)

if (!tables.includes('leagues') || !tables.includes('userProfiles')) {
  console.error(
    'Local D1 has no league tables. Apply the migrations first:\n' +
      `  pnpm exec wrangler d1 migrations apply ${DB} --local --config ${CONFIG}`,
  )
  process.exit(1)
}

// ── Reset ────────────────────────────────────────────────────────────

if (RESET) {
  for (const t of [
    'leaguePointEvents', 'leagueMembership', 'leagueCohorts',
    'sessionRecords', 'userProfiles', 'users',
  ]) {
    sql(`DELETE FROM ${t} WHERE id LIKE 'dev-%'`)
  }
  sql("DELETE FROM sessionRecords WHERE userId LIKE 'dev-%'")
  sql("DELETE FROM leagueMembership WHERE userId LIKE 'dev-%'")
  sql("DELETE FROM leaguePointEvents WHERE userId LIKE 'dev-%'")
  console.log('reset: seeded dev rows removed')
}

// ── The cast ─────────────────────────────────────────────────────────
// Spread across rungs so every ladder state is visible: a packed mid
// league around you, a couple of high rungs, and inactive members who
// demonstrate the relegation zone. l3 is deliberately 22 strong (23 with
// you): its promote/relegate counts are 10/10, and the zone dividers in the
// League view only draw when the cohort is bigger than the zones — a
// 10-person cohort where all 10 promote has no boundary to show.

const CAST = [
  { id: 'dev-ava',   name: 'Ava Quill',      league: 'l3', points: 412, streak: 11, longest: 14 },
  { id: 'dev-bo',    name: 'Bo Wren',        league: 'l3', points: 388, streak: 9,  longest: 9 },
  { id: 'dev-cy',    name: 'Cyra Vale',      league: 'l3', points: 350, streak: 7,  longest: 12 },
  { id: 'dev-dex',   name: 'Dex Marlow',     league: 'l3', points: 244, streak: 5,  longest: 6 },
  { id: 'dev-eli',   name: 'Eli Fontaine',   league: 'l3', points: 180, streak: 4,  longest: 8 },
  { id: 'dev-fin',   name: 'Fin Oakes',      league: 'l3', points: 96,  streak: 3,  longest: 3 },
  { id: 'dev-gus',   name: 'Gus Halloway',   league: 'l3', points: 40,  streak: 2,  longest: 5 },
  { id: 'dev-hana',  name: 'Hana Reyes',     league: 'l3', points: 0,   streak: 0,  longest: 4 },
  { id: 'dev-iris',  name: 'Iris Bloom',     league: 'l3', points: 0,   streak: 0,  longest: 2 },
  { id: 'dev-nia',   name: 'Nia Solene',     league: 'l3', points: 322, streak: 8,  longest: 10 },
  { id: 'dev-remy',  name: 'Remy Falk',      league: 'l3', points: 288, streak: 6,  longest: 9 },
  { id: 'dev-sable', name: 'Sable Kade',     league: 'l3', points: 214, streak: 5,  longest: 5 },
  { id: 'dev-theo',  name: 'Theo Brisk',     league: 'l3', points: 158, streak: 3,  longest: 6 },
  { id: 'dev-una',   name: 'Una Vex',        league: 'l3', points: 132, streak: 3,  longest: 4 },
  { id: 'dev-vera',  name: 'Vera Lume',      league: 'l3', points: 118, streak: 2,  longest: 8 },
  { id: 'dev-wren',  name: 'Wren Odari',     league: 'l3', points: 74,  streak: 2,  longest: 3 },
  { id: 'dev-xan',   name: 'Xan Pyre',       league: 'l3', points: 58,  streak: 1,  longest: 2 },
  { id: 'dev-yara',  name: 'Yara Moss',      league: 'l3', points: 34,  streak: 1,  longest: 4 },
  { id: 'dev-zeke',  name: 'Zeke Hollow',    league: 'l3', points: 22,  streak: 1,  longest: 1 },
  { id: 'dev-pia',   name: 'Pia Nightly',    league: 'l3', points: 8,   streak: 1,  longest: 2 },
  { id: 'dev-quill', name: 'Quill Farrow',   league: 'l3', points: 0,   streak: 0,  longest: 3 },
  { id: 'dev-rho',   name: 'Rho Ember',      league: 'l3', points: 0,   streak: 0,  longest: 1 },
  { id: 'dev-juno',  name: 'Juno Sparks',    league: 'l5', points: 620, streak: 21, longest: 25 },
  { id: 'dev-kai',   name: 'Kai Rivers',     league: 'l6', points: 910, streak: 34, longest: 40 },
  { id: 'dev-lux',   name: 'Lux Amari',      league: 'l1', points: 18,  streak: 1,  longest: 1 },
]

const thisWeek = weekStart(0)
const lastWeek = weekStart(1)

// Registered users (password provider) so they pass the league's
// registered-only gate and the leaderboard's eligibility rules.
for (const p of CAST) {
  sql(
    `INSERT OR REPLACE INTO users (id, createdAt, updatedAt, authProvider, email, emailVerified, tokenVersion)
     VALUES ('${p.id}', '${nowIso}', '${nowIso}', 'password', '${p.id}@dev.local', 1, 1)`,
  )
  sql(
    `INSERT OR REPLACE INTO userProfiles
       (id, createdAt, updatedAt, displayName, joinDate, lastPracticeDate,
        currentStreak, longestStreak, leaderboardOptIn, currentLeagueId)
     VALUES ('${p.id}', '${nowIso}', '${nowIso}', '${q(p.name)}', '${nowIso}',
             '${nowIso.slice(0, 10)}', ${p.streak}, ${p.longest}, 1, '${p.league}')`,
  )
}

// Cohorts + memberships for this week (the standings you see) and last
// week (so the cron has a finished week to cut when you test it).
const leagues = [...new Set(CAST.map((p) => p.league))]
for (const lg of leagues) {
  for (const [i, ws] of [thisWeek, lastWeek].entries()) {
    sql(
      `INSERT OR IGNORE INTO leagueCohorts (id, createdAt, leagueId, weekStart)
       VALUES ('dev-coh-${lg}-${i}', '${nowIso}', '${lg}', '${ws}')`,
    )
  }
}
for (const p of CAST) {
  sql(
    `INSERT OR REPLACE INTO leagueMembership (id, updatedAt, userId, cohortId, weekStart, points)
     VALUES ('dev-mem-${p.id}', '${nowIso}', '${p.id}', 'dev-coh-${p.league}-0', '${thisWeek}', ${p.points})`,
  )
}

// Ranked session history, so the Leaderboard tabs have real rows too.
// Only fixed-task sources rank (see leaderboardConfig.eligibleSources).
let n = 0
for (const p of CAST) {
  const runs = Math.max(1, Math.round(p.points / 60))
  for (let i = 0; i < runs; i++) {
    const score = Math.min(100, 55 + ((p.points + i * 7) % 45))
    const source = i % 3 === 0 ? 'challenge' : i % 3 === 1 ? 'exercise' : 'weekly'
    const day = new Date(Date.now() - i * 86_400_000).toISOString()
    sql(
      `INSERT OR REPLACE INTO sessionRecords
         (id, createdAt, updatedAt, userId, melodyName, startedAt, endedAt,
          score, accuracy, notesHit, notesTotal, streak, source, results)
       VALUES ('dev-sr-${n++}', '${day}', '${day}', '${p.id}',
               '${source === 'exercise' ? 'Exercise: Long Note' : source === 'challenge' ? 'Challenge: High Notes' : 'Legend: Bohemian'}',
               '${day}', '${day}', ${score}, ${score}, 9, 10, ${p.streak}, '${source}', '[]')`,
    )
  }
}

// ── Make YOUR account competitive ────────────────────────────────────
// Without this you sit alone in Mercling with nothing to compare against.

const me = EMAIL
  ? query(
      `SELECT id FROM users WHERE email = '${q(EMAIL)}' AND authProvider != 'anonymous'`,
    )[0]
  : query(
      "SELECT id FROM users WHERE authProvider != 'anonymous' AND id NOT LIKE 'dev-%' ORDER BY createdAt DESC LIMIT 1",
    )[0]

if (me) {
  sql(
    `UPDATE userProfiles SET currentLeagueId = 'l3', leaderboardOptIn = 1,
       currentStreak = MAX(currentStreak, 6), longestStreak = MAX(longestStreak, 9)
     WHERE id = '${me.id}'`,
  )
  sql(
    `INSERT OR IGNORE INTO leagueMembership (id, updatedAt, userId, cohortId, weekStart, points)
     VALUES ('dev-mem-self', '${nowIso}', '${me.id}', 'dev-coh-l3-0', '${thisWeek}', 275)`,
  )
  sql(
    `UPDATE leagueMembership SET points = 275, cohortId = 'dev-coh-l3-0'
     WHERE userId = '${me.id}' AND weekStart = '${thisWeek}'`,
  )
  console.log(`you: ${me.id} → Skyvox (l3), 275 pts, mid-table`)
} else {
  console.log(
    'no registered account found locally — sign up in the app, then re-run ' +
      '(or pass --email you@example.com)',
  )
}

const counts = query(
  `SELECT (SELECT COUNT(*) FROM leagueMembership WHERE weekStart='${thisWeek}') AS members,
          (SELECT COUNT(*) FROM sessionRecords WHERE userId LIKE 'dev-%') AS sessions,
          (SELECT COUNT(*) FROM leagues) AS rungs`,
)[0]

console.log(
  `seeded: ${counts?.rungs ?? 0} rungs, ${counts?.members ?? 0} members this week, ` +
    `${counts?.sessions ?? 0} ranked sessions`,
)
console.log(
  'open the app → Leaderboard → League. To exercise the weekly cut:\n' +
    '  curl "http://localhost:8788/__scheduled?cron=17+*/6+*+*+*"   (needs wrangler dev --test-scheduled)',
)
