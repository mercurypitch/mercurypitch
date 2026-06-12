// ============================================================
// Seed remote D1 definitions via the db-worker admin API
// ============================================================
//
// Seeds challenge/badge/achievement definitions (from
// src/db/seed-data.json) into a running db-worker instance.
// Definitions only — no per-user mock data. Idempotent: a table
// that already has rows is skipped.
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
  ['challengeDefinitions', seedData.challengeDefinitions],
  ['badgeDefinitions', seedData.badgeDefinitions],
  ['achievements', seedData.achievementDefinitions],
]

async function request(path, init) {
  const res = await fetch(`${baseUrl}/api/${path}`, init)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${init?.method ?? 'GET'} /api/${path} → ${res.status} ${body}`)
  }
  return res.json()
}

for (const [table, rows] of TABLES) {
  const { count } = await request(`${table}/count`)
  if (count > 0) {
    console.log(`${table}: ${count} rows already present — skipped`)
    continue
  }
  for (const row of rows) {
    await request(table, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': adminKey,
      },
      body: JSON.stringify(row),
    })
  }
  console.log(`${table}: seeded ${rows.length} rows`)
}

console.log(`Done — ${baseUrl} definitions are in place.`)
