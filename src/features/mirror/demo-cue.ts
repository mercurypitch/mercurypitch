// ============================================================
// Voice Mirror — audible cues for the onboarding task demos.
//
// Ports Glass's "hear what to do, don't just read it" instruction
// audio (glass plan §17.4, decision 18) to the Voice Mirror's demo
// animations: as each looping TaskDemo plays, its matching guide
// sound plays too — a rising siren for glide-up, a falling one for
// glide-down, a steady tone for the held note.
//
// Planning is pure (derived straight from the demo timeline's gold
// guide path, so audio and animation share one source of truth) and
// unit-tested; playback is thin glue over the shared synthesizers in
// src/lib/demo-audio.ts. The `match` task keeps its own reference
// tone and gets no cue here.
// ============================================================

import type { DemoSound } from '@/lib/demo-audio'
import { playHoldTone, playSirenSweep } from '@/lib/demo-audio'
import type { DemoKind, DemoTimeline } from '@/lib/mirror/demo-timeline'

export type DemoCuePlan =
  | { type: 'sweep'; fromHz: number; toHz: number; seconds: number }
  | { type: 'hold'; hz: number; seconds: number }

/**
 * Decide the guide sound for a task demo, or `null` when there is none
 * (the `match` task, or a degenerate timeline). Pure — the frequencies
 * and duration come straight from the timeline's guide path and sing
 * window, so the cue always tracks what the animation draws.
 */
export function planDemoCue(
  kind: DemoKind,
  tl: DemoTimeline,
): DemoCuePlan | null {
  if (kind === 'match') return null
  const sing = tl.segments.find((s) => s.kind === 'sing')
  if (!sing) return null
  const seconds = sing.end - sing.start
  const fromHz = tl.guide[0]?.f0 ?? 0
  const toHz = tl.guide[tl.guide.length - 1]?.f0 ?? 0
  if (seconds <= 0 || fromHz <= 0 || toHz <= 0) return null
  if (kind === 'hold') return { type: 'hold', hz: fromHz, seconds }
  return { type: 'sweep', fromHz, toHz, seconds }
}

/** Play a planned cue on `ctx`, returning a stoppable handle. */
export function playDemoCue(ctx: AudioContext, plan: DemoCuePlan): DemoSound {
  if (plan.type === 'hold') return playHoldTone(ctx, plan.hz, plan.seconds)
  return playSirenSweep(ctx, {
    fromHz: plan.fromHz,
    toHz: plan.toHz,
    seconds: plan.seconds,
  })
}

export interface DemoCueController {
  /** Reconcile playback with whether the demo is currently on show. Plays the
   *  cue once on a false→true edge, stops it on true→false; idempotent. */
  sync: (shouldPlay: boolean) => void
  /** Stop and release the cue (idempotent) — call on unmount. */
  stop: () => void
}

/**
 * The playback state machine for a demo's guide cue, split out from the
 * animation component so it is testable without a DOM. Owns one live handle
 * at a time and treats "playing" as true only when a cue actually started —
 * so a bailed start (no/closed context) is retried on the next `sync`.
 */
export function createDemoCue(
  plan: DemoCuePlan | null,
  getAudioContext: () => AudioContext | null,
): DemoCueController {
  let active: DemoSound | null = null
  let playing = false

  function release(): void {
    active?.stop()
    active = null
  }

  function start(): boolean {
    release()
    if (!plan) return false
    const ctx = getAudioContext()
    if (!ctx || ctx.state === 'closed') return false
    // Autoplay-gated contexts (the onboarding overview) start suspended; nudge
    // them awake. Scheduling anchors to currentTime, which is where a resumed
    // context picks up, so the cue still plays from its start.
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
    active = playDemoCue(ctx, plan)
    return true
  }

  return {
    sync(shouldPlay) {
      if (shouldPlay && !playing) playing = start()
      else if (!shouldPlay && playing) {
        playing = false
        release()
      }
    },
    stop() {
      playing = false
      release()
    },
  }
}
