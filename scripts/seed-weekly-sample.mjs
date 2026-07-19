#!/usr/bin/env node
// =====================================================================
// seed-weekly-sample.mjs — insert one sample weekly "Sing the Legend"
// challenge via the admin API, so the Home hero has something to show
// before the authoring page (PR 3) exists.
//
//   node scripts/seed-weekly-sample.mjs <apiBase> <adminKey>
//   MP_API_BASE=http://localhost:8788 MP_ADMIN_KEY=dev-admin-key \
//     node scripts/seed-weekly-sample.mjs
//
// The window is set to the current week (status 'active') so it appears
// immediately. Content here is a placeholder; the real PD rotation is the
// PR 5 content deliverable. Public-domain composition (Puccini, EU-PD 1995).
// =====================================================================

const apiBase = process.argv[2] ?? process.env.MP_API_BASE ?? 'http://localhost:8788'
const adminKey = process.argv[3] ?? process.env.MP_ADMIN_KEY ?? ''
if (!adminKey) {
  console.error('Admin key required: node scripts/seed-weekly-sample.mjs <apiBase> <adminKey>')
  process.exit(1)
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const item = (midi, i) => ({
  id: i + 1,
  note: {
    midi,
    name: NOTE_NAMES[midi % 12],
    octave: Math.floor(midi / 12) - 1,
    freq: 440 * Math.pow(2, (midi - 69) / 12),
  },
  duration: 1,
  startBeat: i,
})

// "Vincerò" money-note shape rising to a sustained B4 (midi 71).
const targetItems = [67, 69, 71, 71, 71].map(item)

// Monday 00:00 UTC of the current week → +7d.
const now = Date.now()
const d = new Date(now)
const monday = Date.UTC(
  d.getUTCFullYear(),
  d.getUTCMonth(),
  d.getUTCDate() - ((d.getUTCDay() + 6) % 7),
)
const startsAt = new Date(monday).toISOString()
const endsAt = new Date(monday + 7 * 86_400_000).toISOString()

const payload = {
  slug: `nessun-dorma-money-note-${monday}`,
  title: 'The Impossible Note: Vincerò',
  description:
    "Hold Puccini's soaring B4 on “Vincerò” — the tenor money note. Match the rise and land it clean.",
  featType: 'money-note',
  difficulty: 'advanced',
  targetItems,
  targetScore: 70,
  hearItUrl: 'https://www.youtube.com/watch?v=cWc7vYjgnTs',
  startsAt,
  endsAt,
  evergreen: true,
  status: 'active',
}

const res = await fetch(`${apiBase}/api/weekly`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
  body: JSON.stringify(payload),
})
const text = await res.text()
console.log(`${res.status} ${text}`)
process.exit(res.ok ? 0 : 1)
