// ============================================================
// Store-shot fixtures — a fictional singer's month, in the app's own shapes
// ============================================================
//
// Everything here is invented: a singer called Mara (not a person), her
// account, her kept Sing takes, and five weeks of Ear Lab readings with two
// calibrations. That is her progress as the native rooms keep it: the Sing
// take card reads the takes back ("Against your own history"), and the Ear
// Lab bench reads the calibrations ("In September it was ..."). Nothing is
// read from a real device or account.
//
// The shapes are the app's, imported as types, so a renamed field fails the
// type check rather than a screenshot. The storage KEYS are mirrored rather
// than imported, because importing the stores would pull Solid and the whole
// app into the Playwright process; a drifted key fails loudly anyway, since
// the screen then shows its empty state and the landmark wait times out.
//
// The Ear Lab's two calibration marks are computed with the app's own
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

// ── Ear Lab: readings, ratings, two calibrations ────────────

interface ReadingSeed {
  readonly drillId: string
  readonly days: number
  readonly value: number
  readonly spread: number
}

/** Practice estimates over five weeks. No Drift: its unit is a percentage. */
const PRACTICE: readonly ReadingSeed[] = [
  { drillId: 'hairline', days: 35, value: 34, spread: 6 },
  { drillId: 'the-grid', days: 34, value: 42, spread: 8 },
  { drillId: 'hairline', days: 31, value: 29, spread: 5 },
  { drillId: 'beat-hunt', days: 29, value: 14, spread: 3 },
  { drillId: 'colour', days: 28, value: 6.5, spread: 1.5 },
  { drillId: 'the-grid', days: 27, value: 35, spread: 6 },
  { drillId: 'hairline', days: 21, value: 24, spread: 4 },
  { drillId: 'span', days: 20, value: 4, spread: 1 },
  { drillId: 'hairline', days: 12, value: 21, spread: 4 },
  { drillId: 'the-grid', days: 11, value: 29, spread: 5 },
  { drillId: 'beat-hunt', days: 9, value: 10, spread: 2 },
  { drillId: 'colour', days: 7, value: 5, spread: 1 },
  { drillId: 'span', days: 6, value: 5, spread: 1 },
  { drillId: 'hairline', days: 4, value: 18, spread: 3 },
]

/**
 * The two calibration runs: a first reading in September, and one this
 * week, so the bench can say "In September it was ..." of the earlier one.
 */
const CALIBRATIONS: readonly (readonly ReadingSeed[])[] = [
  [
    { drillId: 'hairline', days: 30, value: 27, spread: 4 },
    { drillId: 'the-grid', days: 30, value: 33, spread: 5 },
  ],
  [
    { drillId: 'hairline', days: 2, value: 16, spread: 2 },
    { drillId: 'the-grid', days: 2, value: 26, spread: 3 },
  ],
]

/** Settled Elo ratings: every one has more than the provisional attempts. */
const RATINGS: Readonly<Record<string, Rating>> = {
  home: { rating: 1180, attempts: 46 },
  gravity: { rating: 1090, attempts: 28 },
  'the-pull': { rating: 1010, attempts: 22 },
  contour: { rating: 1120, attempts: 31 },
  leap: { rating: 985, attempts: 18 },
  stack: { rating: 940, attempts: 14 },
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
    const rating = RATINGS[drill.id]
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

interface EarLabSeed {
  readonly readings: ThresholdReadingEntry[]
  readonly calibrations: CalibrationRunEntry[]
  readonly ratings: Readonly<Record<string, Rating>>
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
  }
}

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
 * Mara's phone: signed in, a week of kept takes, three weeks of Ear Lab,
 * the microphone granted once before. `firstRun` turns it back into a fresh
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
