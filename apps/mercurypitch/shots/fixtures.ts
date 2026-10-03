// ============================================================
// Store-shot fixtures — a fictional singer's twelve weeks, in the app's own shapes
// ============================================================
//
// Everything here is invented: a singer called Mara (not a person), her
// account, her kept Sing takes, and twelve weeks of Ear Lab practice: readings,
// ratings, six calibrations, the misses each drill counted and a measured
// round trip. That is her progress as the native rooms keep it: the Sing take
// card reads the takes back ("Against your own history"), the Ear Lab bench
// reads the calibrations ("In September it was ..."), and the Ear Report
// traces all of it. The only gaps left are the ones a store frame forces:
// Drift, whose unit is a percentage, Leap and Stack's misses, which print as
// one, and the desk (see PRACTICE). Nothing is read from a real device or
// account.
//
// The shapes are the app's, imported as types, so a renamed field fails the
// type check rather than a screenshot. The storage KEYS are mirrored rather
// than imported, because importing the stores would pull Solid and the whole
// app into the Playwright process; a drifted key fails loudly anyway, since
// the screen then shows its empty state and the landmark wait times out.
//
// The Ear Lab's calibration marks are computed with the app's own
// Mercury Index (src/lib/ear/mercury-index.ts), the same function
// `completeCalibrationRun` calls, so the column and the dials agree.

import { IDENTIFICATION_DRILLS, THRESHOLD_DRILLS, } from '../../../src/lib/ear/drills'
import type { Rating } from '../../../src/lib/ear/elo'
import { PROVISIONAL_ATTEMPTS } from '../../../src/lib/ear/elo'
import type { FacultyReading } from '../../../src/lib/ear/mercury-index'
import { mercuryIndex } from '../../../src/lib/ear/mercury-index'
import type { CalibrationRunEntry, ThresholdReadingEntry, } from '../../../src/stores/ear-lab-store'
import type { SingTake } from '../../../src/stores/sing-takes-store'

/**
 * The page clock starts here: a Thursday evening. The projects run in UTC.
 * A date already past when the screens were made, and twelve seconds short
 * of 18:40, so a take sung right after it starts at 18:39 and ends at 18:40
 * rather than reading "18:40 to 18:40" (store review, 2026-10-02).
 */
export const SHOT_NOW = '2026-09-24T18:39:48.000Z'
const NOW_MS = Date.parse(SHOT_NOW)
const DAY_MS = 86_400_000

/** Epoch ms for HH:MM (UTC) on the day `days` before SHOT_NOW. */
function daysAgo(days: number, at: string): number {
  const [hours, minutes] = at.split(':').map(Number)
  const day = new Date(NOW_MS - days * DAY_MS)
  day.setUTCHours(hours, minutes, 0, 0)
  return day.getTime()
}

// ── The singer ──────────────────────────────────────────────

/** A fictional account. example.com is reserved for documentation. */
export const SINGER = {
  id: 'shots-singer-0001',
  name: 'Mara',
  email: 'mara@example.com',
  provider: 'apple',
} as const

/**
 * A token shaped like the worker's: three dot-separated parts whose middle
 * one the app decodes locally for the account id, the provider and the
 * expiry. It is not signed and could not be: only the stand-in ever sees it.
 */
function fictionalToken(): string {
  const part = (value: object): string =>
    Buffer.from(JSON.stringify(value)).toString('base64url')
  const issued = Math.floor(NOW_MS / 1000) - 3 * 86_400
  return [
    part({ alg: 'none', typ: 'JWT' }),
    part({
      sub: SINGER.id,
      provider: SINGER.provider,
      iat: issued,
      // Far enough ahead that the real clock of any later run is before it.
      exp: issued + 20 * 365 * 86_400,
    }),
    'store-shots',
  ].join('.')
}

// ── Sing: the takes this phone kept ─────────────────────────

interface TakeSeed {
  readonly days: number
  readonly at: string
  readonly seconds: number
  readonly low: string
  readonly high: string
  readonly within: number
}

const TAKES: readonly TakeSeed[] = [
  { days: 6, at: '18:12', seconds: 42, low: 'D4', high: 'A4', within: 31 },
  { days: 4, at: '19:05', seconds: 55, low: 'C4', high: 'B4', within: 27 },
  { days: 3, at: '18:31', seconds: 38, low: 'D4', high: 'C5', within: 24 },
  { days: 1, at: '20:10', seconds: 61, low: 'C4', high: 'C5', within: 22 },
  { days: 0, at: '17:55', seconds: 47, low: 'D4', high: 'D5', within: 19 },
]

/** Oldest first, as `keepSingTake` appends them: the newest is the last. */
export function singTakes(): SingTake[] {
  return TAKES.map((take, i) => {
    const startedAt = daysAgo(take.days, take.at)
    const endedAt = startedAt + take.seconds * 1000
    return {
      id: `${endedAt}-${i + 1}`,
      startedAt,
      endedAt,
      durationMs: take.seconds * 1000,
      takeNumber: 1,
      lowNote: take.low,
      highNote: take.high,
      heldWithinCents: take.within,
    }
  })
}

// ── Ear Lab: twelve weeks of readings, ratings and calibrations ──

interface ReadingSeed {
  readonly drillId: string
  readonly days: number
  readonly value: number
  readonly spread: number
}

/** A fixed wobble, so a trace reads as practice rather than a ruled line. */
const WOBBLE = [0, 0.07, -0.04, 0.05, -0.06, 0.03, 0.04, -0.03, 0.02, -0.02]

/**
 * One drill's practice estimates, oldest first: `from` easing towards `to`
 * over the given days, rounded to the drill's own step.
 */
function practiceRun(
  drillId: string,
  days: readonly number[],
  [from, to]: readonly [number, number],
  spread: number,
  step: number,
): ReadingSeed[] {
  const round = (v: number) => Math.max(step, Math.round(v / step) * step)
  return days.map((d, i) => {
    const t = i / (days.length - 1)
    const eased = from + (to - from) * (1 - (1 - t) ** 1.7)
    return {
      drillId,
      days: d,
      value: round(eased * (1 + WOBBLE[i % WOBBLE.length])),
      spread: round(spread * (1 - 0.45 * t)),
    }
  })
}

/**
 * Practice estimates over twelve weeks, a few a week, each drill a little
 * finer than when it started. No Drift: its unit is a percentage, which a
 * store frame must not carry, so its instrument stays unmeasured. No desk
 * reading either: one lights the Ear Path's last orb but one, and the next
 * line then reads "Thirty days of regulation — 0 of 30 days", a sentence
 * with an em dash, which a store frame must not carry.
 */
const PRACTICE: readonly ReadingSeed[] = [
  ...practiceRun(
    'hairline',
    [84, 80, 75, 69, 63, 57, 50, 44, 37, 31, 24, 17, 11, 4],
    [38, 18],
    7,
    0.5,
  ),
  ...practiceRun(
    'the-grid',
    [83, 76, 70, 62, 55, 48, 41, 34, 27, 20, 13, 6],
    [54, 28],
    9,
    1,
  ),
  ...practiceRun('beat-hunt', [81, 67, 53, 39, 29, 22, 9], [19, 10], 4, 0.5),
  ...practiceRun('colour', [78, 64, 50, 36, 28, 15, 7], [8.5, 5], 2, 0.5),
  ...practiceRun('span', [77, 61, 47, 33, 20, 6], [3, 5], 1, 1),
]

/**
 * Six calibration runs, one every two or three weeks from 2 July; the one
 * on 25 August is the "In September it was ..." the bench compares with.
 */
const CALIBRATIONS: readonly (readonly ReadingSeed[])[] = [
  [84, 36, 6, 48, 7],
  [63, 32, 5, 43, 6],
  [44, 29, 5, 38, 6],
  [30, 27, 4, 33, 5],
  [16, 21, 3, 30, 4],
  [2, 16, 2, 26, 3],
].map(([days, hairline, hairlineSpread, grid, gridSpread]) => [
  { drillId: 'hairline', days, value: hairline, spread: hairlineSpread },
  { drillId: 'the-grid', days, value: grid, spread: gridSpread },
])

/** Settled Elo ratings today: every one has more than the provisional attempts. */
const RATINGS: Readonly<Record<string, Rating>> = {
  home: { rating: 1180, attempts: 46 },
  gravity: { rating: 1090, attempts: 28 },
  'the-pull': { rating: 1010, attempts: 22 },
  echo: { rating: 1060, attempts: 24 },
  contour: { rating: 1120, attempts: 31 },
  leap: { rating: 985, attempts: 18 },
  stack: { rating: 940, attempts: 14 },
  cadence: { rating: 1030, attempts: 19 },
  bassline: { rating: 960, attempts: 15 },
  pulse: { rating: 1110, attempts: 27 },
  chart: { rating: 1045, attempts: 21 },
  subdivide: { rating: 995, attempts: 16 },
  // In The Wild: the Field Book's tracks, played on two of her own songs.
  'wild-home': { rating: 1050, attempts: 14 },
  'wild-echo': { rating: 1005, attempts: 12 },
}

/**
 * A rating as it stood `days` ago: about eight points a week lower and two
 * attempts a week fewer, so an early calibration counts fewer drills.
 */
function ratingAgo(rating: Rating, days: number): Rating {
  const weeks = days / 7
  return {
    rating: Math.round(rating.rating - 8 * weeks),
    attempts: Math.max(0, Math.round(rating.attempts - 2 * weeks)),
  }
}

/** The index `completeCalibrationRun` would have written for one run. */
function calibrationIndex(run: readonly ReadingSeed[]): CalibrationRunEntry {
  const readings: FacultyReading[] = []
  for (const drill of THRESHOLD_DRILLS) {
    const reading = run.find((r) => r.drillId === drill.id)
    if (reading !== undefined) {
      readings.push({
        faculty: drill.faculty,
        value: reading.value,
        scale: drill.scale,
      })
    }
  }
  for (const drill of IDENTIFICATION_DRILLS) {
    const now = RATINGS[drill.id]
    const rating = now === undefined ? undefined : ratingAgo(now, run[0].days)
    if (rating !== undefined && rating.attempts >= PROVISIONAL_ATTEMPTS) {
      readings.push({
        faculty: drill.faculty,
        value: rating.rating,
        scale: drill.scale,
      })
    }
  }
  const index = mercuryIndex(readings)
  return {
    at: daysAgo(run[0].days, '19:20'),
    index: index.value,
    parts: index.parts,
    readings: run.map(({ drillId, value, spread }) => ({
      drillId,
      value,
      spread,
    })),
  }
}

/**
 * The misses the drills counted, keyed as the store keys them. Home is
 * answered by singing, which books a miss without touching the item
 * (`updateItem: !isMic` in use-home-controller), and Contour keeps no
 * per-item count, so both maps read their misses as counts. Leap and Stack
 * are answered by tapping, which counts every attempt, so their misses
 * would print as a share of attempts: a percentage, which a store frame
 * must not carry. They carry none here.
 */
const CONFUSIONS: Readonly<Record<string, number>> = {
  'home|deg-4>deg-3': 7,
  'home|deg-7>deg-1': 5,
  'home|deg-6>deg-5': 4,
  'home|deg-2>deg-3': 3,
  'home|deg-3>deg-4': 2,
  'home|deg-5>deg-6': 2,
  'contour|same>up': 4,
  'contour|down>same': 3,
  'contour|up>down': 1,
}

interface EarLabSeed {
  readonly readings: ThresholdReadingEntry[]
  readonly calibrations: CalibrationRunEntry[]
  readonly ratings: Readonly<Record<string, Rating>>
  readonly confusions: Readonly<Record<string, number>>
}

/** Newest first, as the store keeps both lists. */
function earLab(): EarLabSeed {
  const practice: ThresholdReadingEntry[] = PRACTICE.map((r) => ({
    drillId: r.drillId,
    value: r.value,
    spread: r.spread,
    tracks: 1,
    source: 'practice',
    at: daysAgo(r.days, '18:50'),
  }))
  const calibrated: ThresholdReadingEntry[] = CALIBRATIONS.flat().map((r) => ({
    drillId: r.drillId,
    value: r.value,
    spread: r.spread,
    tracks: 3,
    source: 'calibration',
    at: daysAgo(r.days, '19:20'),
  }))
  return {
    readings: [...practice, ...calibrated].sort((a, b) => b.at - a.at),
    calibrations: CALIBRATIONS.map(calibrationIndex).sort(
      (a, b) => b.at - a.at,
    ),
    ratings: RATINGS,
    confusions: CONFUSIONS,
  }
}

/**
 * The microphone's measured round trip, in ms, and its spread: the shared
 * measurement every room reads, keyed to the default input.
 */
const ROUND_TRIP = { ms: 41, spread: 5 } as const

// ── The account, answered by the stand-in ───────────────────

/** What GET /api/auth/me answers for the fictional account. */
export function me(): Record<string, unknown> {
  return {
    user: {
      id: SINGER.id,
      email: SINGER.email,
      authProvider: SINGER.provider,
      newsletterOptIn: false,
    },
    profile: { displayName: SINGER.name },
  }
}

// ── What the device holds before the app starts ─────────────

interface DeviceSeed {
  /** Written to localStorage before the app's first script runs. */
  readonly localStorage: Readonly<Record<string, string>>
}

const json = (value: unknown): string => JSON.stringify(value)

/** Keys the app owns, mirrored from its stores (see the header). */
const KEYS = {
  welcomeSeen: 'pitchperfect_native_welcome_seen',
  singCoachSeen: 'pitchperfect_sing_coach_seen',
  singMicGranted: 'pitchperfect_sing_mic_granted',
  singTakes: 'pitchperfect_sing_takes',
  earReadings: 'mercurypitch_ear_readings',
  earCalibrations: 'mercurypitch_ear_calibrations',
  earRatings: 'mercurypitch_ear_ratings',
  earConfusions: 'mercurypitch_ear_confusions',
  micLatency: 'pitchperfect_mic_latency',
  micLatencySpread: 'pitchperfect_mic_latency_spread',
  authToken: 'mp:authToken',
  userId: 'mp:userId',
  accountCard: 'mp:account-card',
  portableConsole: 'mp:portableConsole',
} as const

/** The web's first-run chrome, which the native shell must never show. */
const WEB_CHROME_SEEN: Record<string, string> = Object.fromEntries([
  ['pitchperfect_welcome_version', 'store-shots'],
  ['pitchperfect_survey_seen', 'store-shots'],
  ['pitchperfect_survey_dismissed', '1'],
  ...[
    'home',
    'singing',
    'ear-lab',
    'progress',
    'settings',
    'karaoke',
    'piano',
    'guitar',
  ].map((tab) => [`pitchperfect_page_tour_offered_${tab}`, 'true']),
])

interface SeedOptions {
  /** The first run: the alley still owes its welcome headline. */
  readonly firstRun?: boolean
}

/**
 * Mara's phone: signed in, a week of kept takes, twelve weeks of Ear Lab,
 * the microphone granted once before and its round trip measured. `firstRun` turns it back into a fresh
 * install, which has none of that.
 */
export function marasPhone(options: SeedOptions = {}): DeviceSeed {
  if (options.firstRun === true) {
    return { localStorage: { ...WEB_CHROME_SEEN, [KEYS.portableConsole]: '0' } }
  }
  const ear = earLab()
  const card = { ...SINGER, newsletter: false }
  return {
    localStorage: {
      ...WEB_CHROME_SEEN,
      [KEYS.portableConsole]: '0',
      [KEYS.welcomeSeen]: json(true),
      [KEYS.singCoachSeen]: json(true),
      [KEYS.singMicGranted]: json(true),
      [KEYS.singTakes]: json(singTakes()),
      [KEYS.earReadings]: json(ear.readings),
      [KEYS.earCalibrations]: json(ear.calibrations),
      [KEYS.earRatings]: json(ear.ratings),
      [KEYS.earConfusions]: json(ear.confusions),
      [KEYS.micLatency]: json({ default: ROUND_TRIP.ms }),
      [KEYS.micLatencySpread]: json({ default: ROUND_TRIP.spread }),
      [KEYS.authToken]: fictionalToken(),
      [KEYS.userId]: SINGER.id,
      [KEYS.accountCard]: json({
        id: card.id,
        name: card.name,
        email: card.email,
        provider: card.provider,
        newsletter: card.newsletter,
      }),
    },
  }
}
