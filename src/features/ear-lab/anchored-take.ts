// ============================================================
// Anchored take — a bar that stands still until the player starts it.
//
// The call ends and everything stops: no click, no lamp, no clock.
// The bar is not running and nothing is counting the player in — the
// first tap starts it, and that tap IS the pattern's first onset,
// exactly on time. From there the bar runs for real: the beat ticks
// softly under the remaining onsets, the lamps step, and a progress
// line fills left to right so the player can see where in the bar
// they are. The rest of the take is judged by its distance from the
// anchor, so a steady input delay cancels out entirely.
//
// Nothing sounds during the wait on purpose. A click there reads as
// "the app played your first note for you" and costs the player the
// downbeat they were about to place themselves.
//
// Owns its clicks and timers; `cancel` stops them all. The fill is
// handed to the drum as a start and a duration and animated in CSS,
// so nothing here runs a frame loop. The drill owns the signals and
// the ledger.
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
  /** The instant the bar becomes the player's, on the page clock. */
  openAtMs: number
  periodMs: number
  /** Beats the pattern spans — its bar, or two across the barline. */
  beats: number
  onsetsMs: readonly number[]
  toleranceMs: number
  tailMs: number
  /** Beats of silence held before an untouched take is judged. */
  waitBeats: number
  /** The soft beat under the anchored bar. Silent before the anchor. */
  rail: ClickSpec
  /** The voice a tap answers with. */
  tick: ClickSpec
  ledger: TapLedger
  /** A beat of the anchored bar, 1-based. Never fires during the wait. */
  onBeat: (beat: number) => void
  /** The bar has started. `from` is the fraction of the bar the anchor
   *  already stands at (a pattern beginning off the beat starts part
   *  way in) and `durationMs` is what is left to run — enough for the
   *  drum to animate the fill without a frame loop of its own. */
  onStart: (run: { from: number; durationMs: number }) => void
  onJudged: (outcome: TakeOutcome) => void
}

export interface AnchoredTake {
  /** Feed a tap; the first one starts the bar. Ignored once judged. */
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

  // The wait: silence, and a deadline. Nothing is scheduled and no
  // lamp moves — the bar has not started, because the player has not.
  ledger.arm(options.openAtMs)
  later(
    options.openAtMs + options.waitBeats * periodMs - performance.now(),
    () => judge(false),
  )

  /** The bar, from the tap that started it. */
  function anchor(): void {
    clear()
    // The anchor stands where the pattern's first onset stands, so a
    // pattern that begins off the beat starts part-way into the bar.
    const beatAt = (beat: number) => (beat - 1) * periodMs - firstOnsetMs
    options.onBeat(Math.floor(firstOnsetMs / periodMs) + 1)
    for (let beat = 1; beat <= options.beats; beat++) {
      const at = beatAt(beat)
      if (at <= 0) continue
      clicks.push(scheduleClick(ctx, ctx.currentTime + at / 1000, options.rail))
      later(at, () => options.onBeat(beat))
    }

    options.onStart({
      from: firstOnsetMs / barMs,
      durationMs: barMs - firstOnsetMs,
    })

    later(barMs - firstOnsetMs + options.toleranceMs + options.tailMs, () =>
      judge(true),
    )
  }

  return {
    tap: (atMs) => {
      if (judged || !ledger.armed()) return
      ledger.tap(atMs)
      if (!anchored) {
        anchored = true
        anchor()
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
