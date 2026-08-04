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

const DEFAULT_PREFERENCE: TimerPreference = { mode: 5, customSec: 45 }

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

const [preference, setPreference] = createPersistedSignal<TimerPreference>(
  'mp_exercise_timer',
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

/** The length a run will actually get, or null when the singer stops it. */
export function activeTimerSeconds(): number | null {
  const mode = timerMode()
  if (mode === 'manual') return null
  if (mode === 'custom') return customTimerSeconds()
  return mode
}

/** Reset to the shipped default. Exists for tests, which share module state. */
export function resetTimerPreference(): void {
  setPreference({ ...DEFAULT_PREFERENCE })
}
