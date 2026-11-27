#!/usr/bin/env node
// =====================================================================
// seed-legends.mjs: queue the next Legend Attempts from legend-queue.mjs
// =====================================================================
//
//   pnpm db:seed:legends -- --dry-run
//   MP_API_BASE=https://api-dev.mercurypitch.com MP_ADMIN_KEY=... \
//     node scripts/seed-legends.mjs
//   MP_ALLOW_PROD=1 MP_API_BASE=https://api.mercurypitch.com MP_ADMIN_KEY=... \
//     node scripts/seed-legends.mjs
//
// Every row goes in as `queued`. Nothing here sets a Legend live: the worker
// promotes a queued row on the first GET /api/weekly/active inside its
// window, once the outgoing one has closed. That is also why the admin
// page's "New challenge" is not the way to add these: a row saved `active`
// with a future date goes live at once and hides the current one.
//
// Safe to run twice: the server refuses a slug it already has, and the
// script reports that row as already queued and carries on.
//
// Unlike seed-weekly-rotation.mjs (which builds the original five from
// scratch, first one active, for an empty database), this one only adds to
// a schedule that is already running.
// =====================================================================

import { accessHint, adminHeaders, hasAccessServiceToken, } from './admin-headers.mjs'
import { LEGENDS, legendQueueProblems, legendSlug, noteLabel, } from './legend-queue.mjs'

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const arg = (name) => {
  const i = argv.indexOf(`--${name}`)
  return i !== -1 ? argv[i + 1] : undefined
}

const apiBase = (
  arg('url') ??
  process.env.MP_API_BASE ??
  'http://localhost:8788'
).replace(/\/$/, '')
const adminKey = arg('admin-key') ?? process.env.MP_ADMIN_KEY ?? ''
const dryRun = flag('dry-run')

const problems = legendQueueProblems(LEGENDS)
if (problems.length > 0) {
  console.error('legend-queue.mjs has problems; nothing was posted:')
  for (const line of problems) console.error(`  ${line}`)
  process.exit(1)
}

if (adminKey === '' && !dryRun) {
  console.error(
    'Usage: node scripts/seed-legends.mjs --url <apiBase> --admin-key <key>\n' +
      '   or: MP_API_BASE=... MP_ADMIN_KEY=... node scripts/seed-legends.mjs\n' +
      'Flags: --dry-run (print the rows and payloads, post nothing)',
  )
  process.exit(1)
}

if (
  /(^|\/\/)api\.mercurypitch\.com/i.test(apiBase) &&
  process.env.MP_ALLOW_PROD !== '1' &&
  !dryRun
) {
  console.error(
    `Refusing to post to production (${apiBase}). Set MP_ALLOW_PROD=1 when you mean it.`,
  )
  process.exit(1)
}

const melody = (midis) =>
  midis.map((midi, i) => ({
    id: i + 1,
    note: {
      midi,
      name: noteLabel(midi).replace(/-?\d+$/, ''),
      octave: Math.floor(midi / 12) - 1,
      freq: 440 * Math.pow(2, (midi - 69) / 12),
    },
    duration: 1,
    startBeat: i,
  }))

const payloads = LEGENDS.map((row) => ({
  slug: legendSlug(row),
  title: row.title,
  description: row.description,
  featType: row.featType,
  difficulty: row.difficulty,
  targetItems: melody(row.notes),
  targetScore: row.targetScore,
  hearItUrl: row.hearItUrl,
  startsAt: row.startsAt,
  endsAt: row.endsAt,
  status: 'queued',
  evergreen: row.evergreen,
  ...(row.founderScore === null ? {} : { founderScore: row.founderScore }),
}))

const day = (iso) => iso.slice(0, 10)
console.log(
  `${dryRun ? 'Would queue' : 'Queueing'} ${payloads.length} Legends into ${apiBase}` +
    (hasAccessServiceToken() ? ' [Access service token]' : ''),
)
console.log('')
for (const [i, p] of payloads.entries()) {
  const row = LEGENDS[i]
  const range = `${noteLabel(Math.min(...row.notes))}-${noteLabel(Math.max(...row.notes))}`
  const notes = row.notes.map(noteLabel).join(' ')
  const extras = [
    p.hearItUrl === null ? 'no Hear it link' : 'Hear it set',
    row.founderScore === null
      ? 'no founder score'
      : `founder ${row.founderScore}%`,
    row.evergreen ? 'evergreen' : 'not evergreen',
  ].join(', ')
  console.log(
    `  ${i + 1}. ${day(p.startsAt)} to ${day(p.endsAt)}  ${row.featType}/${row.difficulty}  ${range}  ${row.title}`,
  )
  console.log(`     ${notes}`)
  console.log(`     ${extras}`)
}
console.log('')

// What is live now, so a window that overlaps it is caught before posting.
try {
  const res = await fetch(`${apiBase}/api/weekly/active`)
  if (res.ok) {
    const { challenge } = await res.json()
    if (challenge) {
      console.log(
        `Live now: "${challenge.title}", ${day(challenge.startsAt)} to ${day(challenge.endsAt)}`,
      )
      if (Date.parse(challenge.endsAt) > Date.parse(LEGENDS[0].startsAt)) {
        console.error(
          `The first queued Legend starts ${day(LEGENDS[0].startsAt)}, before the live one ends. Move the queue or the live row first.`,
        )
        if (!dryRun) process.exit(1)
      }
    } else {
      console.log('Nothing is live right now.')
    }
    console.log('')
  }
} catch (err) {
  console.error(`Could not read the live Legend (${err}). Carrying on.`)
}

if (dryRun) {
  console.log(JSON.stringify(payloads, null, 2))
  process.exit(0)
}

let failed = 0
for (const [i, p] of payloads.entries()) {
  let res
  try {
    res = await fetch(`${apiBase}/api/weekly`, {
      method: 'POST',
      headers: adminHeaders(adminKey),
      body: JSON.stringify(p),
    })
  } catch (err) {
    console.error(`  ${i + 1}: request failed (${err}) ${p.slug}`)
    failed += 1
    continue
  }
  const text = await res.text()
  if (res.ok) {
    console.log(`  ${i + 1}: queued ${p.slug}`)
  } else if (res.status === 400 && /slug taken/i.test(text)) {
    console.log(`  ${i + 1}: already queued ${p.slug}`)
  } else {
    console.error(`  ${i + 1}: ${res.status} ${text} ${p.slug}`)
    if (res.status === 401 || res.status === 403)
      console.error(accessHint(apiBase))
    failed += 1
  }
}
console.log('')
if (failed > 0) {
  console.error(`${failed} of ${payloads.length} did not queue.`)
} else {
  console.log(
    `Done. Add the Hear it links and founder scores in #/admin/weekly, and leave each row queued.`,
  )
}
process.exit(failed > 0 ? 1 : 0)
