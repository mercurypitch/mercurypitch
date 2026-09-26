// Regenerate the install-sheet screenshots in public/screenshots/.
//
// Android's install sheet renders as a rich app card only when the manifest
// carries `screenshots`; without them it looks like a bookmark prompt. These
// are shot from the real built app rather than mocked up, so they cannot drift
// from what the user actually gets.
//
//   cross-env VITE_API_BASE_URL=https://api.mercurypitch.invalid \
//     VITE_GOOGLE_ADS_TAG_ID= VITE_GA4_MEASUREMENT_ID= \
//     VITE_JAM_MOCK_SIGNALING=1 pnpm run build
//   node scripts/gen-pwa-screenshots.mjs
//
// Every frame shows demo data and nothing else. The browser never leaves this
// machine: the app's API is answered here from the fixtures below (a demo
// singer, an invented weekly Legend, the synthetic Violet Light song), fonts
// come from the local @fontsource-variable copies, and every other request is
// refused and listed at the end of the run. The build still needs AN API base,
// because the Legend card and the synced practice history only exist in a
// build that has one — `.invalid` is a host that can never resolve, so even a
// request this script failed to route could not reach a real server.
//
// Sizes are baked into public/site.webmanifest — if you change a viewport
// here, update the matching `sizes` there. Exits non-zero if any shot fails.
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { optimizePngs } from './optimize-pwa-images.mjs'

const DIST = resolve('dist')
const OUT = resolve('public/screenshots')
// 0 = let the OS pick a free port, so this never collides with a dev server.
const PORT = Number(process.env.PWA_SHOT_PORT ?? 0)

/**
 * The `major.minor` the What's New panel announces at — mirrors
 * `releaseLine()` in src/features/whats-new/whats-new-release.ts. Duplicated
 * rather than imported because this script runs against the BUILT app in
 * dist/, with no bundler to resolve `@/` for it.
 */
function releaseLineOf(version) {
  const match = /^(\d+)\.(\d+)/.exec(String(version).trim())
  return match === null ? null : `${match[1]}.${match[2]}`
}

/**
 * Wall clock for every frame: a Sunday evening, in UTC, so a re-run
 * photographs the same greeting, the same date and the same week of practice
 * instead of whatever the machine's clock says. Timers run normally.
 */
const CLOCK = Date.parse('2026-09-20T19:40:00Z')

/**
 * The surfaces worth showing a first-time installer, in install-sheet order:
 * the daily hub, the two rooms that look like a night out (Karaoke Night and
 * the Jam room), the guided path, and one wide shot so desktop install sheets
 * have something to use. Truly canvas-driven surfaces stay absent —
 * requestAnimationFrame is throttled to a stop in headless Chromium, so they
 * photograph blank.
 */
const NARROW = { width: 540, height: 1170 }
// The Home card is the one place the weekly Legend shows, and it only exists
// in a build with an API base. Waiting for the fixture board by name makes a
// build without one fail loudly instead of shipping an empty panel.
const LEGEND_READY = {
  waitForText: 'Demo Aria',
  hint: 'the Legend card never showed the fixture board; build with VITE_API_BASE_URL set (see the top of this file)',
}
const SHOTS = [
  {
    file: 'home-narrow.png',
    tab: 'home',
    steps: [LEGEND_READY],
    formFactor: 'narrow',
    viewport: NARROW,
    scale: 1,
  },
  {
    file: 'karaoke-narrow.png',
    // The Karaoke Night surface, not the in-app upload panel — and not its
    // landing either: the picture is the stage itself, so walk into the
    // bundled demo song and wait for the lyric sheet.
    path: '/karaoke-night',
    readySelector: '.kn-app',
    steps: [
      { click: 'button:has-text("Sing this song")' },
      { waitFor: '[class*="lyrics"]' },
      {
        waitForText: 'The room wakes up in violet light',
        hint: 'the stage is not showing the Violet Light fixture',
      },
      { settle: 2500 },
    ],
    mic: true,
    formFactor: 'narrow',
    viewport: NARROW,
    scale: 1,
  },
  {
    file: 'jam-narrow.png',
    tab: 'jam',
    formFactor: 'narrow',
    viewport: NARROW,
    // The room asks for a mic the moment it exists; a denied prompt would be
    // the screenshot.
    mic: true,
    scale: 1,
  },
  {
    file: 'path-narrow.png',
    tab: 'path',
    // The page lands on the current week's orb, which leaves the hero's
    // "Week 4 of 7" line a sliver under the header. Hide the sliver rather
    // than scroll to it: the orb above the week guide is the picture.
    steps: [{ clearTopEdge: '[class*="progressLine"]' }],
    formFactor: 'narrow',
    viewport: NARROW,
    scale: 1,
  },
  {
    file: 'home-wide.png',
    tab: 'home',
    steps: [LEGEND_READY],
    formFactor: 'wide',
    viewport: { width: 1280, height: 800 },
    scale: 1,
  },
]

/**
 * Every tab offers its spotlight tour in a toast on first visit
 * (usePageTourOffer, keyed on the active tab), so the offer key is pre-set
 * for every tab id the app declares — otherwise the shot ships with a "Take a
 * quick tour" card on top, which is exactly what happened to v1 of these.
 * Read from the source rather than listed here: a hand-kept list had already
 * fallen behind the tabs it was meant to cover.
 */
function tabIds() {
  const source = readFileSync('src/features/tabs/constants.ts', 'utf8')
  const ids = [...source.matchAll(/export const TAB_[A-Z_]+ = '([a-z-]+)'/g)]
    .map((match) => match[1])
    .filter((id, index, all) => all.indexOf(id) === index)
  if (!ids.includes('home') || !ids.includes('jam')) {
    throw new Error(
      'could not read the tab ids from src/features/tabs/constants.ts',
    )
  }
  return ids
}

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json'],
  ['.webmanifest', 'application/manifest+json'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/vnd.microsoft.icon'],
  ['.woff2', 'font/woff2'],
  ['.wasm', 'application/wasm'],
])

// ─── Fixtures ────────────────────────────────────────────────────────────────
//
// Everything a frame can show that is not the product itself. All of it is
// invented; the names are ones nobody could mistake for a real account.

/** The demo singer. Every synced row hangs off this id. */
const DEMO_USER = 'pwa-demo-user'
const DEMO_NAME = 'Demo Singer'
const HOUR = 3_600_000
const DAY = 24 * HOUR

/**
 * The weekly Legend and its board, in place of the server's. The live board
 * carries real people's handles, which is how the previous set of these
 * shipped two of them on the install sheet.
 */
const LEGEND = {
  id: 'pwa-demo-legend',
  slug: 'the-violet-hour',
  title: 'The Violet Hour',
  description:
    'One breath, eight bars: carry the long line up through the lift and land the last note clean.',
  featType: 'sustain',
  voiceTypeSplit: null,
  difficulty: 'medium',
  targetItems: [],
  targetScore: 80,
  hearItUrl: null,
  startsAt: new Date(CLOCK - 60 * HOUR).toISOString(),
  endsAt: new Date(CLOCK + 4 * DAY + 7 * HOUR).toISOString(),
  rewardBadgeId: null,
  founderScore: 91,
  founderTrace: null,
  status: 'active',
}
const LEGEND_BOARD = {
  top: [
    { rank: 1, displayName: 'Demo Aria', best: 91, isFounder: true },
    { rank: 2, displayName: 'Demo Nova', best: 89, isFounder: false },
    { rank: 3, displayName: 'Demo Ada', best: 86, isFounder: false },
  ],
  attemptedCount: 1284,
  rankedCount: 902,
  completedCount: 617,
  targetScore: 80,
  founderScore: 91,
  frozen: false,
  you: {
    best: 84,
    rank: 97,
    percentile: 11,
    beatFounder: false,
    completed: true,
    ranked: true,
  },
}

/**
 * Violet Light, the app's synthetic capture song (the same words as
 * scripts/capture-marketing.mjs): original lyrics and silent stems, in place
 * of the shipped demo manifest, whose song is somebody else's recording.
 */
const VIOLET_LRC = `[00:00.00]The room wakes up in violet light
[00:08.00]A quiet count rolls through the air
[00:16.00]Ada takes the opening line
[00:24.00]Her melody rises through the room
[00:32.00]Bo answers from the other side
[00:40.00]The harmony settles into place
[00:48.00]Now the chorus turns toward you
[00:56.00]Every voice can find its lane
[01:04.00]Sing the moment into color
[01:12.00]Let the final note ring clear
[01:20.00]We leave the stage a little brighter
[01:28.00]And carry the music home
`
const VIOLET_SECONDS = 100
const VIOLET_ROOT = '/__pwa-screenshots/violet-light/'

function silentWav(durationSec, sampleRate = 8000) {
  const dataLength = Math.round(durationSec * sampleRate)
  const wav = Buffer.alloc(44 + dataLength, 128)
  wav.write('RIFF', 0, 'ascii')
  wav.writeUInt32LE(36 + dataLength, 4)
  wav.write('WAVE', 8, 'ascii')
  wav.write('fmt ', 12, 'ascii')
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(sampleRate, 24)
  wav.writeUInt32LE(sampleRate, 28)
  wav.writeUInt16LE(1, 32)
  wav.writeUInt16LE(8, 34)
  wav.write('data', 36, 'ascii')
  wav.writeUInt32LE(dataLength, 40)
  return wav
}

/**
 * Seventy-five days of plausible practice for the demo singer, ending at
 * CLOCK: a 23-day streak, drills whose scores climb the way a person's do,
 * today's five minutes banked, today's session under way and week four of The
 * Ascent. Deterministic — a seeded PRNG, not Math.random — so a re-run
 * produces the same frames. The session rows are served as the account's
 * synced history; the rest is device state, set before the app boots.
 */
function livedIn() {
  let seed = 0x5eed1e
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const ymd = (ms) => new Date(ms).toISOString().slice(0, 10)
  const at = (daysAgo, hour, minute) => {
    const day = new Date(CLOCK - daysAgo * DAY)
    day.setUTCHours(hour, minute, Math.floor(rand() * 60), 0)
    return day.getTime()
  }
  const iso = (ms) => new Date(ms).toISOString()

  // Days practised: the last 23 unbroken, before that most days.
  const practised = []
  for (let daysAgo = 74; daysAgo >= 0; daysAgo -= 1) {
    if (daysAgo <= 22 || rand() > 0.3) practised.push(daysAgo)
  }
  const DRILLS = [
    ['long-note', 'Long Note', 1, 62, 90],
    ['interval-trainer', 'Interval Trainer', 2, 55, 86],
    ['siren', 'Siren', 1, 60, 88],
    ['scale-runner', 'Scale Runner', 1, 58, 91],
    ['pitch-hold', 'Pitch Hold', 1, 64, 93],
    ['vibrato', 'Vibrato', 1, 48, 80],
  ]
  const PRACTICE = [
    'C Major Scale',
    'Ode to Joy',
    'Morning Warm-up',
    'Five-Note Climb',
    'Evening Legato',
  ]
  const records = []
  const practiceMs = new Map()
  for (const daysAgo of practised) {
    const progress = 1 - daysAgo / 74
    const runs = daysAgo === 0 ? 3 : 1 + Math.floor(rand() * 3.2)
    for (let run = 0; run < runs; run += 1) {
      const ended =
        daysAgo === 0
          ? at(0, 16 + run, 5 + run * 14)
          : at(daysAgo, 18 + Math.floor(rand() * 3), Math.floor(rand() * 50))
      const durationMs = 70_000 + Math.floor(rand() * 150_000)
      let row
      if (rand() < 0.6) {
        const [type, title, version, lo, hi] =
          DRILLS[Math.floor(rand() * DRILLS.length)]
        const score = Math.round(
          Math.min(98, lo + (hi - lo) * progress + (rand() - 0.5) * 9),
        )
        row = {
          melodyName: `Exercise: ${title}`,
          score,
          accuracy: score,
          notesHit: Math.round(score / 10),
          notesTotal: 10,
          source: 'exercise',
          sourceRef: type,
          sourceVersion: version,
          comparabilityKey: `voice:exercise:${type}:v${version}`,
        }
      } else {
        const score = Math.round(
          Math.min(97, 60 + 28 * progress + (rand() - 0.5) * 12),
        )
        row = {
          melodyName: PRACTICE[Math.floor(rand() * PRACTICE.length)],
          score,
          accuracy: score,
          notesHit: Math.round(score / 10),
          notesTotal: 10,
          source: 'practice',
        }
      }
      records.push({
        id: `pwa-demo-session-${String(records.length + 1).padStart(4, '0')}`,
        userId: DEMO_USER,
        startedAt: iso(ended - durationMs),
        endedAt: iso(ended),
        instrument: 'voice',
        durationMs,
        results: [],
        createdAt: iso(ended),
        updatedAt: iso(ended),
        ...row,
        // Longest run of landed notes inside the take, not the day streak.
        streak: Math.max(1, row.notesHit - Math.floor(rand() * 3)),
      })
      const day = ymd(ended)
      practiceMs.set(day, (practiceMs.get(day) ?? 0) + durationMs)
    }
  }

  const joined = iso(at(76, 19, 0))
  const profile = {
    id: DEMO_USER,
    displayName: DEMO_NAME,
    bio: null,
    joinDate: joined,
    lastPracticeDate: ymd(CLOCK),
    currentStreak: 23,
    longestStreak: 31,
    streakFreezes: 2,
    lastFreezeUsedDate: null,
    lastFreezeEarnedDate: ymd(CLOCK),
    previousStreak: 0,
    streakResetDate: null,
    lastRepairDate: null,
    createdAt: joined,
    updatedAt: iso(CLOCK),
  }

  const owner = encodeURIComponent(DEMO_USER)
  const storage = {}
  for (const [day, ms] of practiceMs) {
    // Today's five minutes are what keeps the streak; bank a little over.
    storage[`mp_practice_ms_${owner}_${day}`] = String(
      day === ymd(CLOCK) ? Math.max(ms, 420_000) : ms,
    )
  }
  // A returning singer has long since answered the "create an account" nudge.
  storage['mercurypitch.accountNudges.v1'] = JSON.stringify({
    'streak-day-2': { dismissedAt: null, satisfied: true },
  })
  storage.mp_daily_routine = JSON.stringify({
    templateId: 'daily-session',
    date: ymd(CLOCK),
    completedSegments: [0, 1],
    segmentRuns: 0,
    lastActiveAt: CLOCK - 2 * HOUR,
    template: {
      id: 'daily-session',
      name: "Today's Session",
      description:
        'Warm up, sharpen a weak spot, grow a skill, then sing Ode to Joy.',
      segments: [
        {
          type: 'warmup',
          durationSec: 60,
          reps: 1,
          config: { pattern: 'ascending-scale' },
        },
        {
          type: 'exercise',
          durationSec: 150,
          reps: 5,
          config: { exercise: 'long-note' },
        },
        {
          type: 'exercise',
          durationSec: 135,
          reps: 3,
          config: { exercise: 'interval-trainer' },
        },
        {
          type: 'exercise',
          durationSec: 120,
          reps: 2,
          config: {
            exercise: 'call-response',
            notes: ['E4', 'E4', 'F4', 'G4'],
          },
        },
      ],
    },
  })
  const weekDays = (from, count) =>
    Array.from({ length: count }, (_, i) => ymd(CLOCK - (from - i) * DAY))
  storage.mp_path_progress = JSON.stringify({
    pathId: 'ascent-foundations',
    startedAt: iso(at(24, 19, 0)),
    currentWeek: 4,
    weekDays: {
      1: ['endowed', ...weekDays(24, 6)],
      2: weekDays(17, 7),
      3: weekDays(10, 7),
      4: weekDays(2, 3),
    },
    completedWeeks: [1, 2, 3],
  })
  storage.mp_path_free_roam = 'false'

  return { records, profile, storage }
}

/**
 * The demo singer's session. An anonymous identity, the kind the app mints
 * for anybody who practises without signing up — so the frames show a
 * returning singer's synced history, not an empty account. The token is
 * unsigned and only ever presented to the fixture API below.
 */
function demoToken() {
  const part = (value) => Buffer.from(JSON.stringify(value)).toString('base64')
  const payload = {
    sub: DEMO_USER,
    provider: 'anonymous',
    iat: Math.floor(CLOCK / 1000) - 30 * 86_400,
    // Far past CLOCK: the app checks expiry against the page's clock.
    exp: Math.floor(CLOCK / 1000) + 365 * 86_400,
  }
  return `${part({ alg: 'none', typ: 'JWT' })}.${part(payload)}.pwa-screenshot-fixture`
}

const DEMO_ME = {
  user: {
    id: DEMO_USER,
    createdAt: new Date(CLOCK - 76 * DAY).toISOString(),
    updatedAt: new Date(CLOCK).toISOString(),
    authProvider: 'anonymous',
    email: null,
    emailVerified: false,
    lastLoginAt: null,
    isTestAccount: false,
    testAccountExpiresAt: null,
  },
  profile: { displayName: DEMO_NAME },
}

// ─── The network: loopback, fixtures, or nothing ─────────────────────────────

/**
 * index.html asks Google Fonts for Inter, Outfit and Plus Jakarta Sans. The
 * same variable faces ship in the workspace as @fontsource-variable packages
 * (the native app bundles them), so the stylesheet is answered from those
 * files, with Google's family names and the packages' unicode ranges.
 */
const FONT_ORIGIN = 'https://fonts.gstatic.com/__local'
function localFonts() {
  const families = {
    Inter: 'inter',
    Outfit: 'outfit',
    'Plus Jakarta Sans': 'plus-jakarta-sans',
  }
  const requireFromApp = createRequire(
    resolve('apps/mercurypitch/package.json'),
  )
  const files = new Map()
  const css = Object.entries(families)
    .map(([family, pkg]) => {
      const entry = requireFromApp.resolve(`@fontsource-variable/${pkg}`)
      return readFileSync(entry, 'utf8')
        .replace(/font-family:\s*'[^']+'/g, `font-family: '${family}'`)
        .replace(/url\(\.\/files\/([^)]+)\)/g, (_, file) => {
          files.set(
            `/__local/${pkg}/${file}`,
            join(dirname(entry), 'files', file),
          )
          return `url(${FONT_ORIGIN}/${pkg}/${file})`
        })
    })
    .join('\n')
  return { css, files }
}

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]'])
/** What the run answered and what it refused, printed at the end. */
const ledger = { fixture: new Map(), refused: new Map() }
function note(kind, key) {
  ledger[kind].set(key, (ledger[kind].get(key) ?? 0) + 1)
}

/**
 * The app's API, answered from the fixtures. Reads of the two synced tables a
 * frame shows (the profile with the streak, and the session history) follow
 * the db-worker's query shape — `where[field]=value`, `orderBy`, `orderDir`,
 * `limit`, `offset`, `/count`, `/:id` — see src/db/adapters/server-adapter.ts.
 * Anything else is a 404 for a read and a 503 for a write, which the app
 * already treats as "nothing there" and "try later".
 */
function fixtureApi(request, url, tables) {
  const path = url.pathname
  const json = (body, status = 200) => ({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  })
  // Nothing a frame shows is written, so no write is answered.
  if (request.method() !== 'GET') return null
  if (path === '/api/weekly/active') return json({ challenge: LEGEND })
  if (path === '/api/weekly/board') return json(LEGEND_BOARD)
  if (path === '/api/auth/me') return json(DEMO_ME)
  // An empty studio list, so Karaoke Night falls back to the manifest that
  // ships with the build — which the loopback routes answer with Violet Light.
  if (path === '/api/demo-songs') return json({ songs: [] })
  const table = /^\/api\/([A-Za-z]+)(?:\/([^/]+))?$/.exec(path)
  const rows = table === null ? undefined : tables[table[1]]
  if (rows === undefined) return null
  const params = url.searchParams
  let found = rows.filter((row) =>
    [...params].every(([key, value]) => {
      const field = /^where\[(.+)\]$/.exec(key)
      return field === null || String(row[field[1]]) === value
    }),
  )
  if (table[2] === 'count') return json({ count: found.length })
  if (table[2] !== undefined) {
    const id = decodeURIComponent(table[2])
    const row = found.find((candidate) => candidate.id === id)
    return row === undefined ? json({ error: 'Not found' }, 404) : json(row)
  }
  const orderBy = params.get('orderBy')
  if (orderBy !== null) {
    const sign = params.get('orderDir') === 'desc' ? -1 : 1
    found = [...found].sort(
      (a, b) => sign * String(a[orderBy]).localeCompare(String(b[orderBy])),
    )
  }
  const offset = Number(params.get('offset') ?? 0)
  const limit = Number(params.get('limit') ?? found.length)
  return json(found.slice(offset, offset + limit))
}

async function lockNetwork(context, { fonts, tables, wav }) {
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (LOOPBACK.has(url.hostname)) {
      // The shipped demo manifest points at a real recording on R2; this one
      // points back here.
      if (url.pathname === '/karaoke-demo-song.json') {
        return route.fulfill({
          json: {
            title: 'Violet Light',
            artist: 'MercuryPitch Demo',
            attribution: { text: '', url: '', license: '', licenseUrl: '' },
            stems: {
              vocal: `${url.origin}${VIOLET_ROOT}vocal.wav`,
              instrumental: `${url.origin}${VIOLET_ROOT}instrumental.wav`,
            },
            lyrics: `${url.origin}${VIOLET_ROOT}lyrics.lrc`,
            durationSec: VIOLET_SECONDS,
          },
        })
      }
      if (url.pathname.startsWith(VIOLET_ROOT)) {
        return url.pathname.endsWith('.lrc')
          ? route.fulfill({
              body: VIOLET_LRC,
              contentType: 'text/plain; charset=utf-8',
            })
          : route.fulfill({ body: wav, contentType: 'audio/wav' })
      }
      return route.continue()
    }
    if (url.hostname === 'fonts.googleapis.com') {
      note('fixture', 'fonts.googleapis.com (local @fontsource-variable)')
      return route.fulfill({
        body: fonts.css,
        contentType: 'text/css; charset=utf-8',
        headers: { 'access-control-allow-origin': '*' },
      })
    }
    if (url.hostname === 'fonts.gstatic.com' && fonts.files.has(url.pathname)) {
      return route.fulfill({
        body: readFileSync(fonts.files.get(url.pathname)),
        contentType: 'font/woff2',
        headers: { 'access-control-allow-origin': '*' },
      })
    }
    if (url.pathname.startsWith('/api/')) {
      const answer = fixtureApi(request, url, tables)
      const key = `${request.method()} ${url.pathname}`
      if (answer !== null) {
        note('fixture', key)
        return route.fulfill(answer)
      }
      note('refused', `${key} (${url.host})`)
      return route.fulfill({
        status: request.method() === 'GET' ? 404 : 503,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ error: 'Not part of the screenshot fixtures' }),
      })
    }
    note('refused', url.origin)
    return route.abort('blockedbyclient')
  })
  await context.routeWebSocket(/.*/, async (ws) => {
    const url = new URL(ws.url())
    if (LOOPBACK.has(url.hostname)) return ws.connectToServer()
    note('refused', `${url.origin} (websocket)`)
    return ws.close({ code: 1008, reason: 'screenshots are loopback-only' })
  })
}

// ─── Init scripts (run in the page, before any app code) ─────────────────────

/**
 * The state of a singer who has been here for weeks. First-run chrome
 * (welcome, onboarding, the survey, the release announcement, every per-tab
 * tour offer, the one-shot mic nudges, the cookie banner) would otherwise be
 * the whole picture.
 *
 * `pitchperfect_whats_new_seen_v2` holds a RELEASE LINE (`major.minor`), not a
 * full version — see src/features/whats-new/whats-new-release.ts. Without it
 * the What's New panel opens over every shot and photographs the changelog
 * instead of the app.
 */
function seedReturningSinger({ version, whatsNewLine, tourTabs, storage }) {
  const set = (key, value) => localStorage.setItem(key, value)
  // A choice already made, so the consent banner never renders. Declined,
  // which is also all the network here would allow.
  set(
    'mp.consent.v1',
    JSON.stringify({ status: 'denied', at: Date.now(), implicit: false }),
  )
  if (whatsNewLine !== null) set('pitchperfect_whats_new_seen_v2', whatsNewLine)
  set('pitchperfect_welcome_version', version)
  set('pitchperfect_onboarding_done', '1')
  set('pitchperfect_focus_mode', 'false')
  set('pitchperfect_survey_seen', '1')
  set('pitchperfect_survey_dismissed', '1')
  for (const tab of tourTabs) {
    set(`pitchperfect_page_tour_offered_${tab}`, 'true')
  }
  set('pitchperfect_mixer_tour_offered', 'true')
  set('pitchperfect_mic_practice_offered', 'true')
  set('pitchperfect_mic_off_hint_dismissed', 'true')
  set('pitchperfect_signal_advisor_last', '9999999999999')
  set('pitchperfect_returning_signin_dismissed', '1')
  for (const [key, value] of Object.entries(storage)) set(key, value)
}

/**
 * Request routing never sees ICE, STUN or TURN, so no frame may open a peer
 * connection at all (the jam lobby needs none): constructing one throws.
 */
function blockPeerConnections() {
  const refuse = function () {
    throw new DOMException(
      'Peer connections are disabled while shooting screenshots',
      'NotAllowedError',
    )
  }
  for (const name of ['RTCPeerConnection', 'webkitRTCPeerConnection']) {
    if (name in window) {
      Object.defineProperty(window, name, { configurable: true, value: refuse })
    }
  }
}

// ─── The run ─────────────────────────────────────────────────────────────────

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(
    'gen-pwa-screenshots: dist/index.html is missing. Build first (see the top of this file).',
  )
  process.exit(1)
}

/**
 * Static server for dist with the same SPA fallback production uses
 * (wrangler's `assets.not_found_handling`), so the app boots the way it will
 * for a real visitor.
 */
const server = createServer((req, res) => {
  let requested = decodeURIComponent((req.url ?? '/').split('?')[0])
  // Mirror production's path routing (vite.config KARAOKE_PATHS): the
  // Karaoke Night surface is its own HTML entry, not the SPA fallback.
  if (requested === '/karaoke-night' || requested === '/karaoke') {
    requested = '/karaoke-night.html'
  }
  const candidate = join(
    DIST,
    normalize(requested).replace(/^(\.\.[/\\])+/, ''),
  )
  const file =
    candidate.startsWith(DIST) &&
    existsSync(candidate) &&
    statSync(candidate).isFile()
      ? candidate
      : join(DIST, 'index.html')
  res.writeHead(200, {
    'content-type': MIME.get(extname(file)) ?? 'application/octet-stream',
  })
  createReadStream(file).pipe(res)
})

await new Promise((done) => server.listen(PORT, '127.0.0.1', done))
const base = `http://127.0.0.1:${server.address().port}`
const appVersion = JSON.parse(readFileSync('package.json', 'utf8')).version
const history = livedIn()
const network = {
  fonts: localFonts(),
  tables: {
    userProfiles: [history.profile],
    sessionRecords: history.records,
  },
  wav: silentWav(VIOLET_SECONDS),
}
const seed = {
  version: appVersion,
  whatsNewLine: releaseLineOf(appVersion),
  tourTabs: tabIds(),
  storage: {
    'mp:userId': DEMO_USER,
    'mp:authToken': demoToken(),
    ...history.storage,
  },
}

mkdirSync(OUT, { recursive: true })
// Fake media devices: a mic-holding surface (the karaoke stage, a jam room)
// must get a silent fake stream, never a permission prompt.
const browser = await chromium.launch({
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
})
let failed = 0

for (const shot of SHOTS) {
  const context = await browser.newContext({
    viewport: shot.viewport,
    deviceScaleFactor: shot.scale,
    isMobile: shot.formFactor === 'narrow',
    hasTouch: shot.formFactor === 'narrow',
    colorScheme: 'dark',
    locale: 'en-US',
    timezoneId: 'UTC',
    // A service worker would answer requests the routes above never see.
    serviceWorkers: 'block',
    // Screenshots are marketing surfaces: no half-played transitions.
    reducedMotion: 'reduce',
    ...(shot.mic ? { permissions: ['microphone'] } : {}),
  })
  await lockNetwork(context, network)
  await context.addInitScript(seedReturningSinger, seed)
  await context.addInitScript(blockPeerConnections)

  const page = await context.newPage()
  await page.clock.setSystemTime(CLOCK)
  try {
    // The tab is chosen by hash route (src/lib/hash-router.ts), not by
    // clicking: on a narrow viewport the top tab bar unmounts in favour of
    // BottomTabBar, whose overflow tabs sit behind a sheet. Shots with a
    // `path` are standalone HTML entries with their own ready signal.
    const target = shot.path ?? `/#/${shot.tab}`
    await page.goto(`${base}${target}`, { waitUntil: 'load' })
    // `#root.loaded` is set by src/index.tsx once App has mounted.
    await page.waitForSelector(shot.readySelector ?? '#root.loaded', {
      timeout: 20_000,
    })
    await page.waitForTimeout(1800)
    // A screenshot of the error boundary would ship to the install sheet and
    // nobody would notice until it was live.
    if (
      (await page.getByRole('dialog', { name: 'Application error' }).count()) >
      0
    ) {
      throw new Error('the app rendered its error boundary')
    }
    // Any tab button will do: the top bar and BottomTabBar share the `tab-*`
    // ids, and which one is mounted depends on the viewport. Standalone
    // entries have no app navigation — their readySelector already vouched.
    if (
      shot.path === undefined &&
      (await page.locator('[id^="tab-"]').count()) === 0
    ) {
      throw new Error('no navigation rendered — the app did not finish booting')
    }
    // Optional staging: walk the page into the state worth photographing.
    for (const step of shot.steps ?? []) {
      if (step.click !== undefined) {
        await page.click(step.click, { timeout: 15_000 })
      }
      if (step.waitFor !== undefined) {
        await page.waitForSelector(step.waitFor, { timeout: 30_000 })
      }
      if (step.waitForText !== undefined) {
        await page
          .getByText(step.waitForText, { exact: false })
          .first()
          .waitFor({ timeout: 20_000 })
          .catch(() => {
            throw new Error(step.hint ?? `"${step.waitForText}" never showed`)
          })
      }
      if (step.clearTopEdge !== undefined) {
        // Scroll the element's scroller just far enough that none of it
        // shows, when its top edge would otherwise cut it in half.
        await page.evaluate((selector) => {
          const element = document.querySelector(selector)
          let scroller = element?.parentElement ?? null
          while (
            scroller !== null &&
            !(
              /(auto|scroll)/.test(getComputedStyle(scroller).overflowY) &&
              scroller.scrollHeight > scroller.clientHeight
            )
          ) {
            scroller = scroller.parentElement
          }
          if (element === null || scroller === null) return
          const edge = scroller.getBoundingClientRect().top
          const box = element.getBoundingClientRect()
          if (box.top < edge && box.bottom > edge) {
            scroller.scrollTop += Math.ceil(box.bottom - edge)
          }
        }, step.clearTopEdge)
      }
      if (step.settle !== undefined) {
        await page.waitForTimeout(step.settle)
      }
    }
    // The real faces, not the fallback: a font the routes failed to serve
    // would otherwise photograph as system sans without anyone noticing.
    // (Karaoke Night links no web fonts at all, by design.)
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready
      const faces = [...document.fonts]
      return {
        linked:
          document.querySelector('link[href*="fonts.googleapis.com"]') !== null,
        loaded: faces.filter((face) => face.status === 'loaded').length,
        failed: faces
          .filter((face) => face.status === 'error')
          .map((face) => `${face.family} ${face.weight} ${face.unicodeRange}`),
      }
    })
    if ((fonts.linked && fonts.loaded === 0) || fonts.failed.length > 0) {
      throw new Error(
        `the web fonts did not load (${fonts.loaded} loaded; failed: ${fonts.failed.join(', ') || 'none'})`,
      )
    }
    // Belt for whatever toast the init keys did not predict (an update
    // notice, a future tour channel): no transient card belongs in a
    // product screenshot. The header's launch-promo pill goes too: it is a
    // campaign with an end date (src/components/billing/launch-promo.ts),
    // and the install sheet outlives it.
    await page.addStyleTag({
      content: `[class*="notificationContainer"],
        [data-testid="header-promo-pill"] { display: none !important; }`,
    })
    const path = join(OUT, shot.file)
    await page.screenshot({ path })
    const { size } = statSync(path)
    console.log(
      `ok    ${shot.file}  ${shot.viewport.width * shot.scale}x${shot.viewport.height * shot.scale}  ${Math.round(size / 1024)} KiB  (${shot.formFactor})`,
    )
  } catch (error) {
    failed += 1
    console.error(
      `FAIL  ${shot.file}: ${error instanceof Error ? error.message : error}`,
    )
  } finally {
    await context.close()
  }
}

await browser.close()
server.close()

// What the frames were built from, and what they were denied. A refused entry
// is not an error — the app copes without it — but it is where to look if a
// frame shows an empty panel.
for (const [kind, label] of [
  ['fixture', 'answered from fixtures'],
  ['refused', 'refused (never left this machine)'],
]) {
  console.log(`\n${label}:`)
  for (const [key, count] of [...ledger[kind]].sort()) {
    console.log(`  ${key}${count > 1 ? `  x${count}` : ''}`)
  }
  if (ledger[kind].size === 0) console.log('  (none)')
}

if (failed > 0) {
  console.error(`gen-pwa-screenshots: ${failed} shot(s) failed`)
  process.exit(1)
}
// The install sheet downloads every screenshot before it can render; keep
// them light. Quantization never changes dimensions, so the manifest's
// `sizes` stay valid.
await optimizePngs(SHOTS.map((shot) => join(OUT, shot.file)))
console.log(
  'gen-pwa-screenshots: done. Update `screenshots` in public/site.webmanifest if sizes changed.',
)
