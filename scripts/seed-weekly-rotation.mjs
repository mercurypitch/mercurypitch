#!/usr/bin/env node
// =====================================================================
// seed-weekly-rotation.mjs — five weeks of "Sing the Legend", in order
// =====================================================================
//
//   node scripts/seed-weekly-rotation.mjs --url <apiBase> --admin-key <key>
//   MP_API_BASE=http://localhost:8788 MP_ADMIN_KEY=dev-admin-key \
//     node scripts/seed-weekly-rotation.mjs --dry-run
//
// Supersedes seed-weekly-sample.mjs, which seeds a single week. Week one
// here is that same reviewed money-note melody, so a board already seeded
// from the sample keeps its content and its scores.
//
// Why five rows and not a cron: the worker resolves the current challenge
// lazily on every GET /api/weekly/active. It closes an `active` row once
// its window has passed (snapshotting the board into resultsJson), then
// promotes the `queued` row whose window contains now. Consecutive
// Monday-to-Monday windows therefore chain by themselves, with no
// scheduled job to fail quietly. Every row is `evergreen`, so once the
// five are spent the encore path re-runs a closed one rather than
// leaving the hero empty.
//
// hearItUrl is set only on week one, whose link shipped and was checked.
// The rest are deliberately null — a dead "Hear it" button is worse than
// no button. Fill them in from #/admin/weekly once you have picked the
// recordings you want to send people to.
//
// All five melodies are public-domain compositions. They are authored
// *shapes* built for the feat, not literal transcriptions — the same
// approach the shipped week-one melody already takes.
//
// `targetItems` are ABSOLUTE MIDI and are sung as written. See the
// tessitura note on WEEKS below: that is the design, not a gap.
// =====================================================================

import { accessHint, adminHeaders, hasAccessServiceToken, } from './admin-headers.mjs'

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
const withFounder = !flag('no-founder')

if (adminKey === '' && !dryRun) {
  console.error(
    'Usage: node scripts/seed-weekly-rotation.mjs --url <apiBase> --admin-key <key>\n' +
      '   or: MP_API_BASE=... MP_ADMIN_KEY=... node scripts/seed-weekly-rotation.mjs\n' +
      'Flags: --dry-run (print payloads, POST nothing), --no-founder,\n' +
      '       --start <ISO date> (first Monday; defaults to this week)',
  )
  process.exit(1)
}

// Sample content must never land on the production board by a pasted-URL
// accident. api-dev.* stays fine; only the bare prod API host is gated.
if (
  /(^|\/\/)api\.mercurypitch\.com/i.test(apiBase) &&
  process.env.MP_ALLOW_PROD !== '1'
) {
  console.error(
    `Refusing to seed against production (${apiBase}). Set MP_ALLOW_PROD=1 if you truly mean it.`,
  )
  process.exit(1)
}

// ── Melody helpers ───────────────────────────────────────────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/** MIDI list → MelodyItem[]. One beat per item, so a held note is the
 *  same note repeated — which is how the reviewed week-one melody spells
 *  its sustain, and keeps every note worth the same to the grader. */
const melody = (midis) =>
  midis.map((midi, i) => ({
    id: i + 1,
    note: {
      midi,
      name: NOTE_NAMES[midi % 12],
      octave: Math.floor(midi / 12) - 1,
      freq: 440 * Math.pow(2, (midi - 69) / 12),
    },
    duration: 1,
    startBeat: i,
  }))

const label = (midi) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`

// ── The rotation ─────────────────────────────────────────────────────
//
// Ordered deliberately: the money note leads because it is the hook the
// whole feature is named for. Everything after it steps back down to
// something a first-week singer can finish, and the feats spread across
// sustain, range, agility and the bottom of the voice so five weeks do
// not all test the same muscle.
//
// TESSITURA — deliberate, do not "fix" this. `targetItems` are absolute
// MIDI and the challenge is sung at written pitch, with no per-voice
// transposition. A weekly Legend is a shared feat: everyone attempts the
// same notes, so the board compares like with like and "I hit the B4"
// means one thing. Transposing to each singer's comfort would make the
// leaderboard meaningless.
//
// The corollary is that a week is not equally reachable by every voice,
// and that is accepted. Weeks 2-5 are therefore authored inside G3-C5,
// which nearly everyone can reach; week one's B4 is the exception, on
// purpose, because being out of reach IS the challenge.

const WEEKS = [
  {
    key: 'nessun-dorma-money-note',
    title: 'The Impossible Note: Vincerò',
    description:
      'Hold Puccini’s soaring B4 on “Vincerò” — the tenor money note. Match the rise and land it clean.',
    featType: 'money-note',
    difficulty: 'advanced',
    notes: [67, 69, 71, 71, 71],
    targetScore: 70,
    // Week one is the only board anyone sees on launch day, so it is the
    // only week that needs a mark to beat. Weeks 2-5 are filled in from
    // #/admin/weekly before each goes live.
    founderScore: 92,
    hearItUrl: 'https://www.youtube.com/watch?v=cWc7vYjgnTs',
  },
  {
    key: 'ave-maria-long-calm',
    title: 'The Long Calm',
    description:
      'Schubert’s Ave Maria opens on stillness. Rise by step and hold the top steady — one breath, one unbroken line.',
    featType: 'sustain',
    difficulty: 'beginner',
    notes: [60, 62, 64, 64, 64, 64],
    targetScore: 75,
    hearItUrl: null,
  },
  {
    key: 'amazing-grace-full-sweep',
    title: 'The Full Sweep',
    description:
      'An octave up and back down on one vowel. Amazing Grace’s arc wants the same even tone at the bottom as at the top.',
    featType: 'range',
    difficulty: 'intermediate',
    notes: [60, 64, 67, 72, 67, 64, 60],
    targetScore: 72,
    hearItUrl: null,
  },
  {
    key: 'greensleeves-the-run',
    title: 'The Run',
    description:
      'Greensleeves’ stepwise fall, sung as one connected line. Every step lands on its own pitch — no scooping between them.',
    featType: 'melisma-run',
    difficulty: 'intermediate',
    notes: [69, 71, 72, 71, 69, 67, 65, 64],
    targetScore: 72,
    hearItUrl: null,
  },
  {
    key: 'swing-low-deep-end',
    title: 'The Deep End',
    description:
      'Swing Low’s descent, down to a held G3. Keep the tone alive as it drops — quiet is fine, breathy is not.',
    featType: 'low-note',
    difficulty: 'beginner',
    notes: [64, 62, 60, 59, 57, 55, 55],
    targetScore: 75,
    hearItUrl: null,
  },
]

// ── Windows ──────────────────────────────────────────────────────────

const WEEK_MS = 7 * 86_400_000

/** Monday 00:00 UTC of the week containing `ms`. */
function mondayUtc(ms) {
  const d = new Date(ms)
  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() - ((d.getUTCDay() + 6) % 7),
  )
}

const startArg = arg('start')
if (startArg !== undefined && !Number.isFinite(Date.parse(startArg))) {
  console.error(`--start is not a parseable date: ${startArg}`)
  process.exit(1)
}
const firstMonday = mondayUtc(
  startArg !== undefined ? Date.parse(startArg) : Date.now(),
)

const payloads = WEEKS.map((w, i) => {
  const startMs = firstMonday + i * WEEK_MS
  return {
    slug: `${w.key}-${Math.floor(startMs / 86_400_000)}`,
    title: w.title,
    description: w.description,
    featType: w.featType,
    difficulty: w.difficulty,
    targetItems: melody(w.notes),
    targetScore: w.targetScore,
    hearItUrl: w.hearItUrl,
    startsAt: new Date(startMs).toISOString(),
    endsAt: new Date(startMs + WEEK_MS).toISOString(),
    // Only the first week opens now; the worker promotes the rest as
    // their windows arrive.
    status: i === 0 ? 'active' : 'queued',
    // Every week can be re-run as an Encore once the queue is spent.
    evergreen: true,
    // Only weeks that declare a founder mark send one; the rest are left
    // null for the admin page to fill before they go live.
    ...(withFounder && typeof w.founderScore === 'number'
      ? { founderScore: w.founderScore }
      : {}),
  }
})

// ── Run ──────────────────────────────────────────────────────────────

const day = (iso) => iso.slice(0, 10)

console.log(
  `${dryRun ? 'Would seed' : 'Seeding'} ${payloads.length} weeks into ${apiBase}` +
    (withFounder ? '' : ' (no founder scores)') +
    (hasAccessServiceToken() ? ' [Access service token]' : ''),
)
console.log('')

for (const [i, p] of payloads.entries()) {
  const w = WEEKS[i]
  const range = `${label(Math.min(...w.notes))}–${label(Math.max(...w.notes))}`
  const founder =
    p.founderScore === undefined ? 'founder —' : `founder ${p.founderScore}%`
  console.log(
    `  ${i + 1}. ${day(p.startsAt)} → ${day(p.endsAt)}  ${p.status.padEnd(6)} ` +
      `${w.featType}/${w.difficulty}  ${range}  ${founder}  ${w.title}`,
  )
}
console.log('')

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
    console.error(`  week ${i + 1}: request failed — ${err}`)
    failed += 1
    continue
  }
  const text = await res.text()
  if (res.ok) {
    console.log(`  week ${i + 1}: ok — ${p.slug}`)
  } else {
    // A taken slug means this exact week is already seeded. Say so and
    // keep going rather than aborting a partly-applied rotation.
    console.error(`  week ${i + 1}: ${res.status} ${text} — ${p.slug}`)
    failed += 1
  }
}

console.log('')
if (failed > 0) {
  console.error(
    `${failed} of ${payloads.length} weeks did not seed. A "slug taken?" 400 means that week already exists — harmless on a re-run.`,
  )
} else {
  console.log(
    'Done. Check the hero with: curl -s "' + apiBase + '/api/weekly/active"',
  )
}
process.exit(failed > 0 ? 1 : 0)
