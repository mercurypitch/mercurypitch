// ============================================================
// Anchored take — an open bar that starts on the player's first tap.
//
// The old response bar opened on the clock and the player had to hit
// its first beat cold; the established rhythm trainers (Perfect Ear,
// Complete Rhythm Trainer) never do that. Here the beat keeps
// ticking softly after the call and the bar waits: the first tap
// anchors it — that tap IS the first onset, exactly on time — the
// soft rail restarts from the anchor, every tap answers with its own
// tick, and the take is judged one bar past the anchor. A take
// nobody starts inside the wait is judged as never begun.
//
// Owns its clicks and timers; `cancel` silences and clears them all.
// The drill owns the signals and the ledger.
// ============================================================

import type { TakeVerdict } from '@/lib/ear/rhythm-take'
import { anchorTaps, judgeTake } from '@/lib/ear/rhythm-take'
import type { TapLedger } from '@/lib/ear/tap-input'
import type { ScheduledClick } from './click-synth'
import { scheduleClick } from './click-synth'

export interface TakeOutcome {
  verdict: TakeVerdict
  /** Met taps as beats of the bar, for the drum. */
  tapsBeats: number[]
  /** Extra taps as beats of the bar. */
  extrasBeats: number[]
  /** False when the wait ran out with nothing tapped. */
  begun: boolean
}

interface ClickSpec {
  voice: 'tick' | 'wood' | 'soft'
  gainLevel: number
}

export interface AnchoredTakeOptions {
  ctx: AudioContext
  /** The downbeat after the call, on the audio clock. */
  openAtS: number
  /** The same instant on the page clock. */
  openAtMs: number
  periodMs: number
  /** Beats the pattern spans — its bar, or two across the barline. */
  beats: number
  onsetsMs: readonly number[]
  toleranceMs: number
  tailMs: number
  /** Beats the soft rail holds before an untouched take is judged. */
  waitBeats: number
  /** The soft beat under the wait and under the anchored bar. */
  rail: ClickSpec
  /** The voice a tap answers with. */
  tick: ClickSpec
  ledger: TapLedger
  /** A beat of the wait rail or the anchored bar, 1-based, cycling. */
  onBeat: (beat: number, anchored: boolean) => void
  onJudged: (outcome: TakeOutcome) => void
}

export interface AnchoredTake {
  /** Feed a tap; the first one anchors the bar. Ignored once judged. */
  tap: (atMs: number) => void
  cancel: () => void
}

export function startAnchoredTake(options: AnchoredTakeOptions): AnchoredTake {
  const { ctx, ledger, periodMs, onsetsMs } = options
  const barMs = options.beats * periodMs
  const firstOnsetMs = onsetsMs[0] ?? 0
  let clicks: ScheduledClick[] = []
  let timers: Array<ReturnType<typeof setTimeout>> = []
  let judged = false
  let anchored = false

  const clear = (): void => {
    for (const timer of timers) clearTimeout(timer)
    timers = []
    for (const click of clicks) click.cancel()
    clicks = []
  }

  const later = (ms: number, fn: () => void): void => {
    timers.push(
      setTimeout(
        () => {
          if (!judged) fn()
        },
        Math.max(0, ms),
      ),
    )
  }

  const judge = (begun: boolean): void => {
    if (judged) return
    judged = true
    clear()
    const taps = anchorTaps(ledger.taps(), firstOnsetMs)
    const verdict = judgeTake(taps, onsetsMs, options.toleranceMs, barMs)
    options.onJudged({
      verdict,
      tapsBeats: verdict.deviations
        .map((d, i) => (d === null ? null : (onsetsMs[i] + d) / periodMs))
        .filter((b): b is number => b !== null),
      extrasBeats: verdict.extras.map((t) => t / periodMs),
      begun,
    })
  }

  // The wait: the rail keeps the beat, the lamps keep stepping, and
  // the bar belongs to whichever beat the player picks up.
  ledger.arm(options.openAtMs)
  const nowMs = performance.now()
  for (let k = 0; k < options.waitBeats; k++) {
    clicks.push(
      scheduleClick(ctx, options.openAtS + (k * periodMs) / 1000, options.rail),
    )
    later(options.openAtMs + k * periodMs - nowMs, () =>
      options.onBeat((k % options.beats) + 1, false),
    )
  }
  later(options.openAtMs + options.waitBeats * periodMs - nowMs, () =>
    judge(false),
  )

  return {
    tap: (atMs) => {
      if (judged || !ledger.armed()) return
      ledger.tap(atMs)
      if (!anchored) {
        anchored = true
        // The anchor: the wait rail stops, the bar restarts from this
        // tap — beat one is now — and the verdict waits a bar plus the
        // grace, measured from where the anchor stands in the pattern.
        clear()
        options.onBeat(1, true)
        for (let k = 1; k < options.beats; k++) {
          clicks.push(
            scheduleClick(
              ctx,
              ctx.currentTime + (k * periodMs) / 1000,
              options.rail,
            ),
          )
          later(k * periodMs, () => options.onBeat(k + 1, true))
        }
        later(barMs - firstOnsetMs + options.toleranceMs + options.tailMs, () =>
          judge(true),
        )
      }
      clicks.push(scheduleClick(ctx, ctx.currentTime, options.tick))
    },
    cancel: () => {
      judged = true
      clear()
      ledger.disarm()
    },
  }
}
