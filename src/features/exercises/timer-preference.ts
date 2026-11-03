// ============================================================
// How long a held-note drill runs before it scores itself
// ============================================================
//
// The shell used to open on "Manual", which meant every long note ended when
// the singer remembered to press Stop. In a daily routine that is worse than
// it sounds: the segment does not tick off until they do, and a run that ends
// on a reflex is scored on a length nobody chose.
//
// So a duration is selected from the start, and the choice is remembered. The
// preference is one module-scope signal rather than one per mounted shell,
// because `createPersistedSignal` keys its cross-tab listener by storage key —
// two signals on the same key would fight over it.

import { createSignal } from 'solid-js'
import type { ExerciseResult } from '@/lib/domain/exercise-contracts'
import { stoppedEarlyMark } from '@/lib/domain/exercise-contracts'
import { createPersistedSignal } from '@/lib/storage'

/**
 * The ladder, in seconds.
 *
 * 5 and 30 were the old ends of it, with 15 in between, and the gap did the
 * damage: five seconds is over before a steady tone settles, and fifteen is a
 * long way to go without a rest. Ten is the rung that was missing.
 */
export const TIMER_PRESETS: readonly number[] = [5, 10, 15, 30]

export const CUSTOM_MIN_SEC = 5
export const CUSTOM_MAX_SEC = 120
export const CUSTOM_STEP_SEC = 5

/** A preset in seconds, the custom length, or no timer at all. */
export type TimerMode = 'manual' | 'custom' | number

interface TimerPreference {
  mode: TimerMode
  /** Kept even while a preset is selected, so Custom returns to its value. */
  customSec: number
}

// Ten, not five: by the time a singer settles onto the note, half of a
// five-second run is already gone — and a routine of five-second runs
// cannot reach the daily five sung minutes it plans (owner call,
// 2026-08-17). Existing devices keep whatever they chose; only a fresh
// preference opens on ten.
const DEFAULT_PREFERENCE: TimerPreference = { mode: 10, customSec: 45 }

const clampCustom = (seconds: number): number =>
  Math.min(
    CUSTOM_MAX_SEC,
    Math.max(
      CUSTOM_MIN_SEC,
      Math.round(seconds / CUSTOM_STEP_SEC) * CUSTOM_STEP_SEC,
    ),
  )

const isTimerPreference = (value: unknown): value is TimerPreference => {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<TimerPreference>
  const modeOk =
    candidate.mode === 'manual' ||
    candidate.mode === 'custom' ||
    (typeof candidate.mode === 'number' && Number.isFinite(candidate.mode))
  return modeOk && typeof candidate.customSec === 'number'
}

/**
 * The `pitchperfect_` prefix is not decoration: settings-service syncs exactly
 * the keys that carry it, so a key named anything else is silently
 * device-local, and the run length someone chose would not follow them to a
 * second device the way every other preference does.
 */
export const TIMER_STORAGE_KEY = 'pitchperfect_exercise_timer'

const [preference, setPreference] = createPersistedSignal<TimerPreference>(
  TIMER_STORAGE_KEY,
  DEFAULT_PREFERENCE,
  { validator: isTimerPreference },
)

export function timerMode(): TimerMode {
  return preference().mode
}

export function setTimerMode(mode: TimerMode): void {
  setPreference((current) => ({ ...current, mode }))
}

export function customTimerSeconds(): number {
  return clampCustom(preference().customSec)
}

export function setCustomTimerSeconds(seconds: number): void {
  setPreference((current) => ({ ...current, customSec: clampCustom(seconds) }))
}

/** The length the singer has chosen, or null for Manual. */
function chosenTimerSeconds(): number | null {
  const mode = timerMode()
  if (mode === 'manual') return null
  if (mode === 'custom') return customTimerSeconds()
  return mode
}

/**
 * The length of the run in progress, fixed as it starts.
 *
 * The timer is chosen between runs, but a settings sync can change it
 * during one. The shell used to re-arm its countdown on the change,
 * restarting the count, while the drill judged the run's end against the
 * new length, so the countdown and the mark could disagree. The pin holds
 * a run to the length it started with, for the countdown, the mark, the
 * grade and the Stop's name alike; a change applies from the next run.
 */
const [pinnedRun, setPinnedRun] = createSignal<{
  token: symbol
  seconds: number | null
} | null>(null)

/** Fix the length of the run starting now. The token releases it. */
export function pinTimerForRun(): symbol {
  const token = Symbol('timed run')
  setPinnedRun({ token, seconds: chosenTimerSeconds() })
  return token
}

/** Release a run's pin. A token a newer run has replaced releases nothing. */
export function releaseTimerPin(token: symbol): void {
  if (pinnedRun()?.token === token) setPinnedRun(null)
}

/**
 * The length a run will actually get, or null when the singer stops it:
 * the pinned length while a run is in progress (`pinTimerForRun`).
 */
export function activeTimerSeconds(): number | null {
  const pinned = pinnedRun()
  return pinned !== null ? pinned.seconds : chosenTimerSeconds()
}

/** What ended a timed drill's run: the singer's Stop, or its timer. */
export type RunEnd = 'stop' | 'timer'

/**
 * How near its length a Stop may land and still end a whole run: within
 * the countdown's last second. The countdown rounds up, so the last number
 * it shows is "1s", and it shows it for that whole second. A Stop while it
 * reads "1s" is pressed at what the singer sees as the end, and with a
 * quarter second's grace three in four such Stops marked the run. The
 * shell also checks the timer only every 100 ms, so a Stop can land after
 * the length has run out but before the shell ends the run.
 */
export const TIMER_END_GRACE_MS = 1000

/**
 * Whether a run ended short of the length the singer chose: stopped
 * `elapsedMs` into it, while its timer still ran. Graded on the seconds it
 * reached, one second of Long Note held in tune scored 86 against the
 * ten-second default and cleared every basics challenge, so such a run is
 * practice, not a result (`stoppedEarlyMark`). Which control ended the run
 * is not enough: a Stop once the length has run out ends a whole run. On
 * Manual there is no length to fall short of, and the Stop is the run's
 * end, though a run that sang too little is not scored either
 * (`tooShortToScore`).
 */
export function endedBeforeTimer(end: RunEnd, elapsedMs: number): boolean {
  if (end === 'timer') return false
  const seconds = activeTimerSeconds()
  if (seconds === null) return false
  return elapsedMs < seconds * 1000 - TIMER_END_GRACE_MS
}

/**
 * The least singing a Manual run needs for a score: the shortest length a
 * timer offers. On Manual the Stop is the run's end, so nothing else held a
 * run to any length, and one second of Long Note held in tune scored about
 * 85, because its grade gives length 15% of its weight. That cleared the
 * basics challenges. A Manual run is now never a cheaper result than the
 * shortest timed run.
 */
export const MIN_SCORED_SECONDS = CUSTOM_MIN_SEC

/** Whether a Manual run sang too little to be scored (`MIN_SCORED_SECONDS`). */
export function tooShortToScore(sungSeconds: number): boolean {
  return activeTimerSeconds() === null && sungSeconds < MIN_SCORED_SECONDS
}

/**
 * The most a whole run its timer did not end can score: its share of the
 * length, in whole points. A Stop in the countdown's last second ends a
 * whole run (`TIMER_END_GRACE_MS`), and at the five-second preset that
 * second is a fifth of the run: a steady four-second Long Note scored 97,
 * over Immaculate's 95 and the level's step-up at 90. Now it scores at most
 * 80. A run its timer ended, one stopped once its length had run out, and
 * any Manual run keep their grade.
 */
export function scoreCapForEnd(end: RunEnd, elapsedMs: number): number {
  if (end === 'timer') return 100
  const seconds = activeTimerSeconds()
  if (seconds === null) return 100
  return Math.min(100, Math.floor((elapsedMs / (seconds * 1000)) * 100))
}

/**
 * A timed drill's graded run, settled for how it ended. It is marked when
 * it was stopped short of its timer (`endedBeforeTimer`) or sang too little
 * on Manual (`tooShortToScore`, which also sets `tooShort` so the card can
 * say why). A marked run is not scored and keeps the grade of what it sang;
 * a whole run scores at most its share of the length (`scoreCapForEnd`).
 * `elapsedMs` is how far into the run the end came; `sungSeconds` is how
 * much of it had a voice.
 */
export function settleTimedRun(
  graded: ExerciseResult,
  end: RunEnd,
  elapsedMs: number,
  sungSeconds: number,
): ExerciseResult {
  const tooShort = tooShortToScore(sungSeconds)
  const stopped = endedBeforeTimer(end, elapsedMs) || tooShort
  return {
    ...graded,
    score: stopped
      ? graded.score
      : Math.min(graded.score, scoreCapForEnd(end, elapsedMs)),
    metrics: {
      ...graded.metrics,
      ...stoppedEarlyMark(stopped),
      ...(tooShort ? { tooShort: 1 } : {}),
    },
  }
}

/**
 * The name of a timed drill's Stop. On Manual it ends and scores the run;
 * with a timer the timer scores it, and a Stop before then ends it unscored.
 */
export function stopLabelForTimer(): string {
  return activeTimerSeconds() === null ? 'Stop & Score' : 'Stop'
}

/** Reset to the shipped default. Exists for tests, which share module state. */
export function resetTimerPreference(): void {
  setPreference({ ...DEFAULT_PREFERENCE })
  setPinnedRun(null)
}
