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

import { showNotification } from '@/stores/notifications-store'

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

export interface PreviewPlayerProcessing {
  input: AudioNode
  output: AudioNode
  dispose(): void
}

export interface PreviewPlayerOptions {
  onEnded?: () => void
  /** Borrow a route-owned context/output; the player never closes this context. */
  audioGraph?: { context: AudioContext; destination: AudioNode }
  /**
   * Created lazily on Play, before the final pop-free envelope. Explicit
   * processing is required: setup failure must not silently play dry audio.
   */
  createProcessing?: (context: AudioContext) => PreviewPlayerProcessing
  /** Product-specific recovery copy for failed media. */
  errorMessage?: string
  /** Envelope timings (ms); see ENVELOPE_DEFAULTS. Longer = softer
   *  transitions at the cost of start/stop latency. */
  attackMs?: number
  releaseMs?: number
  seekFadeMs?: number
}

export interface PreviewPlayer {
  /** Load `url` (if it changed) and fade playback in. Safe to call while
   *  a fade-out is in flight — the pending pause is cancelled. Resolves
   *  false (never rejects) when the source could not be played. */
  play(url: string, options?: { startSeconds?: number }): Promise<boolean>
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

// Every live player registers here so a vite hot-swap can never orphan a
// playing <audio> element — the swapped-in UI reads "stopped" while the
// old element plays on with no reachable handle, unstoppable short of a
// tab kill (2026-07-31: a leaked preview looped through an HMR-heavy
// session). When this module is hot-replaced, every surviving player is
// hard-stopped before the new module takes over.
/**
 * Ask for a cross-origin source with CORS, so the Web Audio graph can
 * actually hear it.
 *
 * A media element loaded from another origin without `crossOrigin` is
 * *tainted*, and a tainted element feeds a MediaElementAudioSourceNode
 * nothing but silence — every stem preview on this player is routed
 * through one. Same-origin sources and `blob:` object URLs (which is what
 * a visitor's own separation produces) are untouched: setting the
 * attribute on them changes nothing, and leaving it off keeps a host that
 * sends no `Access-Control-Allow-Origin` failing loudly rather than
 * silently.
 *
 * The remote case is the seeded example songs, whose stems are the R2
 * URLs themselves.
 */
function applyCrossOrigin(element: HTMLAudioElement, url: string): void {
  if (!/^https?:/i.test(url)) {
    element.removeAttribute('crossorigin')
    return
  }
  try {
    if (new URL(url, window.location.href).origin === window.location.origin) {
      element.removeAttribute('crossorigin')
      return
    }
  } catch {
    // An unparseable URL is not one we can reason about; leave it alone.
    return
  }
  element.crossOrigin = 'anonymous'
}

const livePlayers = new Set<() => void>()
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    for (const hardStop of livePlayers) hardStop()
    livePlayers.clear()
  })
}

export function createPreviewPlayer(
  options: PreviewPlayerOptions = {},
): PreviewPlayer {
  const attackS = (options.attackMs ?? ENVELOPE_DEFAULTS.attackMs) / 1000
  const releaseS = (options.releaseMs ?? ENVELOPE_DEFAULTS.releaseMs) / 1000
  const seekFadeS = (options.seekFadeMs ?? ENVELOPE_DEFAULTS.seekFadeMs) / 1000

  let el: HTMLAudioElement | null = null
  let ctx: AudioContext | null = null
  let source: MediaElementAudioSourceNode | null = null
  let processing: PreviewPlayerProcessing | null = null
  let gain: GainNode | null = null
  let ownsContext = false
  let enveloped = false
  let wantPlaying = false
  let playIntent = 0
  let disposed = false
  let currentUrl: string | null = null
  let pauseTimer: ReturnType<typeof setTimeout> | undefined
  let seekTimer: ReturnType<typeof setTimeout> | undefined
  // A queued position is logical immediately, but is only applied after the
  // output is silent. In particular, Pause still has an audible release tail.
  let queuedPosition: number | null = null
  let starting = false
  let seekRevision = 0
  let cancelTransition: (() => void) | null = null

  const cancelSeek = () => {
    seekRevision++
    clearTimeout(seekTimer)
    seekTimer = undefined
    cancelTransition?.()
  }

  /** Both startup and scrubbing must leave the envelope closed until the
   * decoder has actually reached the requested position. Cancellation resolves
   * the wait too, so repeated scrubs cannot leave orphaned promises/listeners. */
  const waitForSeek = (element: HTMLAudioElement): Promise<boolean> => {
    if (!element.seeking) return Promise.resolve(true)
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer)
        element.removeEventListener('seeked', ready)
        element.removeEventListener('error', failed)
        if (cancelTransition === cancel) cancelTransition = null
      }
      const ready = () => {
        cleanup()
        resolve(true)
      }
      const failed = () => {
        cleanup()
        reject(new Error('Audio seeking failed.'))
      }
      const cancel = () => {
        cleanup()
        resolve(false)
      }
      const timer = setTimeout(failed, 5_000)
      element.addEventListener('seeked', ready)
      element.addEventListener('error', failed)
      cancelTransition = cancel
    })
  }

  const waitForDip = (): Promise<boolean> =>
    new Promise((resolve) => {
      const finish = (completed: boolean) => {
        clearTimeout(timer)
        if (cancelTransition === cancel) cancelTransition = null
        resolve(completed)
      }
      const cancel = () => finish(false)
      const timer = setTimeout(() => finish(true), seekFadeS * 1000 + 5)
      cancelTransition = cancel
    })

  const applyPosition = (element: HTMLAudioElement, seconds: number) => {
    element.currentTime = Number.isFinite(element.duration)
      ? Math.min(Math.max(0, element.duration), Math.max(0, seconds))
      : Math.max(0, seconds)
  }

  const releaseGraph = (): void => {
    source?.disconnect()
    processing?.dispose()
    gain?.disconnect()
    if (ownsContext) void ctx?.close().catch(() => {})
    source = null
    processing = null
    gain = null
    ctx = null
    ownsContext = false
    enveloped = false
  }

  const ensureGraph = (): HTMLAudioElement => {
    if (el) return el
    el = new Audio()
    el.preload = 'auto'
    el.onended = () => {
      playIntent++
      cancelSeek()
      starting = false
      queuedPosition = null
      wantPlaying = false
      options.onEnded?.()
    }
    try {
      ownsContext = options.audioGraph === undefined
      ctx = options.audioGraph?.context ?? new AudioContext()
      source = ctx.createMediaElementSource(el)
      gain = ctx.createGain()
      gain.gain.value = 0
      processing = options.createProcessing?.(ctx) ?? null
      source.connect(processing?.input ?? gain)
      processing?.output.connect(gain)
      gain.connect(options.audioGraph?.destination ?? ctx.destination)
      enveloped = true
    } catch (error) {
      releaseGraph()
      if (
        options.audioGraph !== undefined ||
        options.createProcessing !== undefined
      ) {
        // The element may already be bound to a failed MediaElementSource.
        // Retire it so retry can construct a fresh graph, never a dry fallback.
        el.onended = null
        el = null
        throw error
      }
      // No Web Audio (tests, exotic embeds): direct element control. The
      // envelope is lost but playback still works.
    }
    return el
  }

  const clearTimers = () => {
    clearTimeout(pauseTimer)
    cancelSeek()
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
        pauseTimer = undefined
        // The tail sits ≤ −43 dB now; a hard zero is inaudible and gives
        // the next attack a clean floor.
        gain?.gain.cancelScheduledValues(ctx?.currentTime ?? 0)
        if (gain) gain.gain.value = 0
        after()
      },
      releaseS * 1000 + RAMP_SLACK_MS,
    )
  }

  /**
   * Start (or resume) playback of `url`. Returns false when the source
   * could not be played — a failed play must never escape as an
   * unhandled rejection: most callers fire-and-forget, and the global
   * error handler treats unhandled rejections as an app crash. An
   * expired presigned URL or a CSP-blocked host is a playback problem,
   * not an application error (owner hit exactly this: a blocked R2
   * stem source took the whole app down with the crash overlay).
   */
  const play = async (
    url: string,
    startOptions?: { startSeconds?: number },
  ): Promise<boolean> => {
    if (disposed) return false
    const intent = ++playIntent
    cancelSeek()
    starting = true
    const startSeconds = startOptions?.startSeconds
    if (startSeconds !== undefined && Number.isFinite(startSeconds))
      queuedPosition = Math.max(0, startSeconds)
    let element: HTMLAudioElement
    try {
      element = ensureGraph()
    } catch {
      starting = false
      wantPlaying = false
      showNotification(
        options.errorMessage ?? "Couldn't prepare audio playback. Try again.",
        'error',
      )
      return false
    }
    // A play during a fade-out must win over the queued pause.
    clearTimeout(pauseTimer)
    pauseTimer = undefined
    wantPlaying = true
    if (ctx && ctx.state === 'suspended') void ctx.resume()
    const changedSource = url !== currentUrl
    if (changedSource) {
      // A pending seek belongs to its source; an explicit startup offset is
      // the only position carried across a URL replacement.
      if (!Number.isFinite(startOptions?.startSeconds)) queuedPosition = null
      // Silence the swap itself: the old signal must not bleed one full-
      // scale frame while the new source loads.
      if (enveloped && gain && ctx) {
        gain.gain.cancelScheduledValues(ctx.currentTime)
        gain.gain.value = 0
      }
      applyCrossOrigin(element, url)
      element.src = url
      currentUrl = url
    }
    // Gain sits at (or is ramping toward) 0 here; start the transport
    // first, then open the envelope — the swell begins from real silence.
    try {
      await element.play()
      while (
        !disposed &&
        intent === playIntent &&
        wantPlaying &&
        element === el &&
        queuedPosition !== null
      ) {
        const target = queuedPosition
        // A resumed element can still be in its old release. Do not jump
        // across that audible tail, even when Play follows Stop immediately.
        if (!changedSource && enveloped && ctx && gain) {
          dipEnvelope(gain, ctx, seekFadeS, 0)
          if (!(await waitForDip())) continue
        }
        if (disposed || intent !== playIntent || !wantPlaying) return false
        if (queuedPosition !== target) continue
        applyPosition(element, target)
        if (!(await waitForSeek(element))) continue
        if (disposed || intent !== playIntent || !wantPlaying) return false
        if (queuedPosition === target) queuedPosition = null
      }
    } catch (err) {
      if (disposed || intent !== playIntent || element !== el) return false
      wantPlaying = false
      starting = false
      fadeOutThen(() => element.pause())
      // Forget the failed source so a retry re-assigns src cleanly.
      currentUrl = null
      const aborted = err instanceof DOMException && err.name === 'AbortError'
      // AbortError is a play() interrupted by our own pause/new-load —
      // routine, not worth a toast.
      if (!aborted) {
        showNotification(
          options.errorMessage ??
            "Couldn't play this audio — the source may have expired or isn't supported here. Re-open the song to refresh it.",
          'error',
        )
      }
      return false
    }
    // A permission/load promise may settle after Pause, disposal, or another
    // Play. Only its own still-current intent may open this graph's envelope.
    if (disposed || intent !== playIntent || !wantPlaying || element !== el)
      return false
    starting = false
    if (enveloped && ctx && gain) openEnvelope(gain, ctx, attackS)
    return true
  }

  const pause = () => {
    playIntent++
    cancelSeek()
    starting = false
    if (!el) return
    wantPlaying = false
    fadeOutThen(() => {
      el?.pause()
      if (el && queuedPosition !== null) {
        applyPosition(el, queuedPosition)
        queuedPosition = null
      }
    })
  }

  const stop = () => {
    playIntent++
    cancelSeek()
    starting = false
    queuedPosition = 0
    if (!el) return
    wantPlaying = false
    fadeOutThen(() => {
      if (el) {
        el.pause()
        applyPosition(el, queuedPosition ?? 0)
        queuedPosition = null
      }
    })
  }

  const seekToFraction = (fraction: number) => {
    if (disposed || !el || !Number.isFinite(fraction)) return
    const d = el.duration
    if (!Number.isFinite(d) || d <= 0) return
    const target = Math.min(d, Math.max(0, fraction * d))
    queuedPosition = target
    cancelSeek()
    if (starting) return
    // Pause is logical immediately, but the media continues during its fade.
    // The pending pause applies this target once the tail has retired.
    if (!wantPlaying && pauseTimer !== undefined) return
    // Paused (or un-enveloped): no signal is flowing, move directly.
    if (!enveloped || !wantPlaying || !ctx || !gain) {
      el.currentTime = target
      queuedPosition = null
      return
    }
    // Dip around the jump: down, move, back up. Re-scrubbing mid-dip just
    // restarts the sequence.
    const intent = playIntent
    const revision = seekRevision
    dipEnvelope(gain, ctx, seekFadeS, 0)
    seekTimer = setTimeout(
      () => {
        seekTimer = undefined
        const element = el
        if (!element || !ctx || !gain || !wantPlaying) return
        applyPosition(element, target)
        void waitForSeek(element)
          .then((ready) => {
            if (
              !ready ||
              disposed ||
              intent !== playIntent ||
              revision !== seekRevision ||
              !wantPlaying ||
              queuedPosition !== target ||
              !ctx ||
              !gain
            )
              return
            queuedPosition = null
            dipEnvelope(gain, ctx, seekFadeS, 1)
          })
          .catch(() => {
            if (disposed || intent !== playIntent || revision !== seekRevision)
              return
            pause()
            showNotification(
              options.errorMessage ??
                "Couldn't seek this audio. Try Play again.",
              'error',
            )
          })
      },
      seekFadeS * 1000 + 5,
    )
  }

  // Immediate, envelope-free teardown — dispose() and the module's HMR
  // guard both land here. Detaching src tears down the element's fetch/
  // decode pipeline so nothing can keep producing audio.
  const hardStop = () => {
    disposed = true
    playIntent++
    clearTimers()
    wantPlaying = false
    starting = false
    queuedPosition = null
    if (el) {
      el.onended = null
      el.pause()
      el.removeAttribute('src')
      el.load()
    }
    releaseGraph()
    el = null
    currentUrl = null
  }
  livePlayers.add(hardStop)

  return {
    play,
    pause,
    stop,
    seekToFraction,
    get currentTime() {
      return queuedPosition ?? el?.currentTime ?? 0
    },
    get duration() {
      const d = el?.duration
      return d !== undefined && Number.isFinite(d) ? d : 0
    },
    get playing() {
      return wantPlaying
    },
    dispose() {
      livePlayers.delete(hardStop)
      hardStop()
    },
  }
}
