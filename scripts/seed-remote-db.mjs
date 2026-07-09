// ============================================================
// Seed remote D1 definitions via the db-worker admin API
// ============================================================
//
// Seeds challenge/badge/achievement definitions (from
// src/db/seed-data.json) into a running db-worker instance.
// Definitions only — no per-user mock data. Idempotent MERGE keyed
// by title/name: missing rows are created, rows whose seeded fields
// changed are updated (content updates), and rows keep their ids so
// per-user progress stays attached. Extra rows are left alone.
//
// Usage:
//   node scripts/seed-remote-db.mjs --url http://localhost:8788 --admin-key dev-admin-key
//   DB_API_URL=https://mercury-pitch-db-dev.<subdomain>.workers.dev \
//   DB_ADMIN_KEY=... node scripts/seed-remote-db.mjs

import seedData from '../src/db/seed-data.json' with { type: 'json' }

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 ? process.argv[i + 1] : undefined
}

const baseUrl = (arg('url') ?? process.env.DB_API_URL ?? '').replace(/\/$/, '')
const adminKey = arg('admin-key') ?? process.env.DB_ADMIN_KEY ?? ''

if (baseUrl === '' || adminKey === '') {
  console.error(
    'Usage: node scripts/seed-remote-db.mjs --url <worker-url> --admin-key <key>\n' +
      '   or: DB_API_URL=... DB_ADMIN_KEY=... node scripts/seed-remote-db.mjs',
  )
  process.exit(1)
}

const TABLES = [
  ['challengeDefinitions', seedData.challengeDefinitions, 'title'],
  ['badgeDefinitions', seedData.badgeDefinitions, 'name'],
  ['achievements', seedData.achievementDefinitions, 'name'],
]

async function request(path, init) {
  const res = await fetch(`${baseUrl}/api/${path}`, init)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${init?.method ?? 'GET'} /api/${path} → ${res.status} ${body}`)
  }
  return res.json()
}

function writeRow(method, path, row) {
  return request(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': adminKey,
    },
    body: JSON.stringify(row),
  })
}

for (const [table, rows, key] of TABLES) {
  const existing = await request(`${table}?limit=200`)
  const byKey = new Map(existing.map((row) => [row[key], row]))

  let created = 0
  let updated = 0
  for (const row of rows) {
    const found = byKey.get(row[key])
    if (found === undefined) {
      await writeRow('POST', table, row)
      created++
    } else if (Object.keys(row).some((field) => row[field] !== found[field])) {
      await writeRow('PATCH', `${table}/${found.id}`, row)
      updated++
    }
  }
  console.log(
    `${table}: ${created} created, ${updated} updated, ` +
      `${rows.length - created - updated} unchanged`,
  )
}

console.log(`Done — ${baseUrl} definitions are in place.`)
