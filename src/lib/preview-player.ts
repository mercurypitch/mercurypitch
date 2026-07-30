// ============================================================
// Preview player — pop-free HTMLAudioElement playback
// ============================================================
// HOW TO NOT POP, the house rules (see .claude/memory/
// audio-pop-free-playback.md):
//
// A bare HTMLAudioElement slams from silence to full scale in a single
// sample on play(), truncates mid-waveform on pause(), and jumps across
// a discontinuity on seek. On a PA that's a very loud pop. Every audible
// start/stop/seek in this app therefore runs through a Web Audio
// GainNode envelope. Never use HTMLMediaElement.volume for this — it is
// not sample-accurate.
//
// SHAPE MATTERS as much as length. Loudness is logarithmic, so a linear
// ramp packs most of its perceived change into its last milliseconds —
// at a silence↔music boundary it reads as a "squeezed" pop even at
// 50 ms. Hence:
//
//   start:  exponential rise from the silence floor   (~90 ms default)
//   stop:   setTargetAtTime exponential decay, then pause the transport
//           only after the tail is below audibility    (~180 ms default)
//   seek:   short LINEAR dip around the jump           (~15 ms default)
//           — linear is fine here: the material is continuous on both
//           sides, which masks the ramp completely.
//
// Same family as the synth envelopes in audio-engine.ts
// (setTargetAtTime release) and tone-player.ts (exponential ramps); the
// stem-mixer transport uses the shorter linear pair for its own fades.
//
// This module wraps one media element + gain graph behind an imperative
// API so one-shot players (stem previews, sample auditioning) get the
// envelope for free — timings are per-instance configurable. The
// openEnvelope/closeEnvelope primitives are exported for surfaces that
// own their audio graph (e.g. OfflinePitchCanvas). Environments without
// a usable AudioContext (jsdom) degrade to direct element control.

export const ENVELOPE_DEFAULTS = {
  /** Exponential fade-in on play/resume. */
  attackMs: 90,
  /** Exponential decay before the transport pauses. */
  releaseMs: 180,
  /** Linear dip either side of a seek while playing. */
  seekFadeMs: 15,
} as const

/** −80 dB — where "silence" starts for exponential ramps (they cannot
 *  start from a true 0). */
const SILENCE_FLOOR = 0.0001
/** Wall-clock headroom after a release before the transport stops. */
const RAMP_SLACK_MS = 60

/** Open a gain envelope: exponential rise from the silence floor to 1.
 *  Perceptually even (constant dB/s), so starts swell instead of snap. */
export function openEnvelope(
  gain: GainNode,
  ctx: BaseAudioContext,
  seconds: number,
): void {
  const now = ctx.currentTime
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(Math.max(gain.gain.value, SILENCE_FLOOR), now)
  gain.gain.exponentialRampToValueAtTime(1, now + seconds)
}

/** Close a gain envelope: exponential decay toward 0. After `seconds`
 *  the residual is e^-5 ≈ −43 dB — only then may the transport stop.
 *  Callers wait `seconds` + RAMP_SLACK_MS before pausing. */
export function closeEnvelope(
  gain: GainNode,
  ctx: BaseAudioContext,
  seconds: number,
): void {
  const now = ctx.currentTime
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(gain.gain.value, now)
  // Time-constant τ = seconds/5: five time-constants ≈ fully settled.
  gain.gain.setTargetAtTime(0, now, seconds / 5)
}

/** Short linear dip for seeks — see the shape note in the header. */
export function dipEnvelope(
  gain: GainNode,
  ctx: BaseAudioContext,
  seconds: number,
  target: number,
): void {
  const now = ctx.currentTime
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(gain.gain.value, now)
  gain.gain.linearRampToValueAtTime(target, now + seconds)
}

export interface PreviewPlayerOptions {
  onEnded?: () => void
  /** Envelope timings (ms); see ENVELOPE_DEFAULTS. Longer = softer
   *  transitions at the cost of start/stop latency. */
  attackMs?: number
  releaseMs?: number
  seekFadeMs?: number
}

export interface PreviewPlayer {
  /** Load `url` (if it changed) and fade playback in. Safe to call while
   *  a fade-out is in flight — the pending pause is cancelled. */
  play(url: string): Promise<void>
  /** Fade out, then pause. Keeps the position. */
  pause(): void
  /** Fade out, pause and rewind to zero. */
  stop(): void
  /** Scrub to `fraction` (0..1) of the duration. While playing this dips
   *  the gain around the jump so the discontinuity is inaudible. */
  seekToFraction(fraction: number): void
  readonly currentTime: number
  readonly duration: number
  /** Logical state: true from play() until pause()/stop()/ended — the
   *  element itself keeps running slightly longer to finish the fade. */
  readonly playing: boolean
  dispose(): void
}

export function createPreviewPlayer(
  options: PreviewPlayerOptions = {},
): PreviewPlayer {
  const attackS = (options.attackMs ?? ENVELOPE_DEFAULTS.attackMs) / 1000
  const releaseS = (options.releaseMs ?? ENVELOPE_DEFAULTS.releaseMs) / 1000
  const seekFadeS = (options.seekFadeMs ?? ENVELOPE_DEFAULTS.seekFadeMs) / 1000

  let el: HTMLAudioElement | null = null
  let ctx: AudioContext | null = null
  let gain: GainNode | null = null
  let enveloped = false
  let wantPlaying = false
  let currentUrl: string | null = null
  let pauseTimer: ReturnType<typeof setTimeout> | undefined
  let seekTimer: ReturnType<typeof setTimeout> | undefined

  const ensureGraph = (): HTMLAudioElement => {
    if (el) return el
    el = new Audio()
    el.preload = 'auto'
    el.onended = () => {
      wantPlaying = false
      options.onEnded?.()
    }
    try {
      ctx = new AudioContext()
      const source = ctx.createMediaElementSource(el)
      gain = ctx.createGain()
      gain.gain.value = 0
      source.connect(gain)
      gain.connect(ctx.destination)
      enveloped = true
    } catch {
      // No Web Audio (tests, exotic embeds): direct element control. The
      // envelope is lost but playback still works.
      enveloped = false
    }
    return el
  }

  const clearTimers = () => {
    clearTimeout(pauseTimer)
    clearTimeout(seekTimer)
    pauseTimer = undefined
    seekTimer = undefined
  }

  /** Fade out and run `after` once the tail is inaudible. */
  const fadeOutThen = (after: () => void) => {
    if (!enveloped || !ctx || !gain) {
      after()
      return
    }
    closeEnvelope(gain, ctx, releaseS)
    clearTimeout(pauseTimer)
    pauseTimer = setTimeout(
      () => {
        // The tail sits ≤ −43 dB now; a hard zero is inaudible and gives
        // the next attack a clean floor.
        gain?.gain.cancelScheduledValues(ctx?.currentTime ?? 0)
        if (gain) gain.gain.value = 0
        after()
      },
      releaseS * 1000 + RAMP_SLACK_MS,
    )
  }

  const play = async (url: string): Promise<void> => {
    const element = ensureGraph()
    // A play during a fade-out must win over the queued pause.
    clearTimeout(pauseTimer)
    pauseTimer = undefined
    wantPlaying = true
    if (ctx && ctx.state === 'suspended') void ctx.resume()
    if (url !== currentUrl) {
      // Silence the swap itself: the old signal must not bleed one full-
      // scale frame while the new source loads.
      if (enveloped && gain && ctx) {
        gain.gain.cancelScheduledValues(ctx.currentTime)
        gain.gain.value = 0
      }
      element.src = url
      currentUrl = url
    }
    // Gain sits at (or is ramping toward) 0 here; start the transport
    // first, then open the envelope — the swell begins from real silence.
    await element.play()
    if (enveloped && ctx && gain) openEnvelope(gain, ctx, attackS)
  }

  const pause = () => {
    if (!el) return
    wantPlaying = false
    fadeOutThen(() => el?.pause())
  }

  const stop = () => {
    if (!el) return
    wantPlaying = false
    fadeOutThen(() => {
      if (el) {
        el.pause()
        el.currentTime = 0
      }
    })
  }

  const seekToFraction = (fraction: number) => {
    if (!el) return
    const d = el.duration
    if (!Number.isFinite(d) || d <= 0) return
    const target = Math.min(d - 0.05, Math.max(0, fraction * d))
    // Paused (or un-enveloped): no signal is flowing, move directly.
    if (!enveloped || !wantPlaying || !ctx || !gain) {
      el.currentTime = target
      return
    }
    // Dip around the jump: down, move, back up. Re-scrubbing mid-dip just
    // restarts the sequence.
    clearTimeout(seekTimer)
    dipEnvelope(gain, ctx, seekFadeS, 0)
    seekTimer = setTimeout(
      () => {
        if (!el || !ctx || !gain) return
        el.currentTime = target
        dipEnvelope(gain, ctx, seekFadeS, 1)
      },
      seekFadeS * 1000 + 5,
    )
  }

  return {
    play,
    pause,
    stop,
    seekToFraction,
    get currentTime() {
      return el?.currentTime ?? 0
    },
    get duration() {
      const d = el?.duration
      return d !== undefined && Number.isFinite(d) ? d : 0
    },
    get playing() {
      return wantPlaying
    },
    dispose() {
      clearTimers()
      wantPlaying = false
      el?.pause()
      try {
        gain?.disconnect()
      } catch {
        /* already disconnected */
      }
      void ctx?.close().catch(() => {})
      el = null
      ctx = null
      gain = null
      currentUrl = null
    },
  }
}
