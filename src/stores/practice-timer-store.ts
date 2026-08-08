// ============================================================
// Practice Timer Store — the voice-rest clock
// ============================================================
//
// Off by default. Once on, it counts SINGING time, not wall-clock time: the
// tick only advances while the mic is open, because a break reminder is about
// how long the voice has been working, not how long the tab has been up. The
// break counts the other way — it only runs down while the mic is closed, so a
// break you sing through is not a break.
//
// Distinct from db/services/practice-minutes.ts, which totals scored-run
// duration per DAY for the streak. That number cannot answer "how long has
// this person been singing without stopping", which is the whole question here.
//
// The ticker is device-level (micManager), not the page-facing micActive
// signal, so the clock keeps running across a move from Singing to Karaoke.

import { createSignal } from 'solid-js'
import { micManager } from '@/lib/mic-manager'
import { createPersistedSignal } from '@/lib/storage'
import { showNotification } from './notifications-store'

/** 'practice' counts singing; 'break' counts silence. */
export type PracticePhase = 'practice' | 'break'

export const PRACTICE_MIN_RANGE = { min: 5, max: 120 } as const
export const BREAK_MIN_RANGE = { min: 1, max: 30 } as const

/** One shared toast channel, so a phase change never stacks on the last one. */
export const PRACTICE_TIMER_CHANNEL = 'practice-timer'

const TICK_MS = 1000
const MS_PER_MIN = 60_000

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, Math.round(v)))

export const [practiceTimerEnabled, setPracticeTimerEnabledInternal] =
  createPersistedSignal<boolean>('pitchperfect_practice_timer', false)

export const [practiceIntervalMin, setPracticeIntervalMinInternal] =
  createPersistedSignal<number>('pitchperfect_practice_interval_min', 20)

export const [breakIntervalMin, setBreakIntervalMinInternal] =
  createPersistedSignal<number>('pitchperfect_break_interval_min', 5)

export const [practicePhase, setPracticePhase] =
  createSignal<PracticePhase>('practice')

export const [phaseElapsedMs, setPhaseElapsedMs] = createSignal(0)

/** How long the current phase runs for. */
export function phaseTotalMs(): number {
  return practicePhase() === 'practice'
    ? practiceIntervalMin() * MS_PER_MIN
    : breakIntervalMin() * MS_PER_MIN
}

/** Never negative — the tick that ends a phase also resets the elapsed count. */
export function phaseRemainingMs(): number {
  return Math.max(0, phaseTotalMs() - phaseElapsedMs())
}

/**
 * Whether the pill has anything worth showing. A practice phase that has not
 * accrued a second yet is nothing to report; a break always is.
 */
export function practiceTimerVisible(): boolean {
  if (!practiceTimerEnabled()) return false
  return practicePhase() === 'break' || phaseElapsedMs() > 0
}

function enterPhase(phase: PracticePhase): void {
  setPracticePhase(phase)
  setPhaseElapsedMs(0)
}

/** Clamped setter — see CONVENTIONS §4, clamp once in the store. */
export function setPracticeIntervalMin(minutes: number): void {
  setPracticeIntervalMinInternal(
    clamp(minutes, PRACTICE_MIN_RANGE.min, PRACTICE_MIN_RANGE.max),
  )
}

export function setBreakIntervalMin(minutes: number): void {
  setBreakIntervalMinInternal(
    clamp(minutes, BREAK_MIN_RANGE.min, BREAK_MIN_RANGE.max),
  )
}

/** Turning the timer off also throws away the phase in progress. */
export function setPracticeTimerEnabled(enabled: boolean): void {
  setPracticeTimerEnabledInternal(enabled)
  if (!enabled) enterPhase('practice')
}

/** Back to a fresh practice phase, whatever was running. */
export function resetPracticeTimer(): void {
  enterPhase('practice')
}

/**
 * End the current phase now — "I'll take that break early", or "I'm done
 * resting". Deliberately silent: the user just said what they wanted, so a
 * toast telling them it happened is noise.
 */
export function skipPracticeTimerPhase(): void {
  enterPhase(practicePhase() === 'practice' ? 'break' : 'practice')
}

function announceBreakDue(): void {
  const sung = practiceIntervalMin()
  const rest = breakIntervalMin()
  showNotification(
    `${sung} minutes of singing. Rest your voice for ${rest} — the timer resumes when you stop.`,
    'warning',
    { channel: PRACTICE_TIMER_CHANNEL },
  )
}

function announceBreakOver(): void {
  showNotification(
    `Break over — your voice has had ${breakIntervalMin()} minutes off. Ready when you are.`,
    'success',
    { channel: PRACTICE_TIMER_CHANNEL },
  )
}

/**
 * Advance one tick. Takes the mic state rather than reading it, which keeps
 * the phase machine a pure function of its inputs — and testable without a
 * device. The app feeds it from `startPracticeTimer`.
 */
export function practiceTimerTick(micOpen: boolean): void {
  if (!practiceTimerEnabled()) return

  const phase = practicePhase()
  // Practice accrues on singing, break accrues on silence. Either way the
  // phase that is not being fed simply stands still.
  if (phase === 'practice' ? !micOpen : micOpen) return

  const elapsed = phaseElapsedMs() + TICK_MS
  if (elapsed < phaseTotalMs()) {
    setPhaseElapsedMs(elapsed)
    return
  }

  if (phase === 'practice') {
    enterPhase('break')
    announceBreakDue()
  } else {
    enterPhase('practice')
    announceBreakOver()
  }
}

let ticking = false

/** Start the once-per-second clock and the mic subscription. Idempotent. */
export function startPracticeTimer(): void {
  if (ticking) return
  ticking = true
  let micOpen = false
  micManager.subscribe((state) => {
    micOpen = state.active
  })
  setInterval(() => {
    practiceTimerTick(micOpen)
  }, TICK_MS)
}
