import type { Accessor } from 'solid-js'
import { createEffect, createSignal, onCleanup } from 'solid-js'

/**
 * A single, debounced "what's happening with the mic" state, shared by every
 * tab that listens to the mic (Singing, Karaoke, Piano, Guitar, Jam):
 *
 * - `none`       — a pitch is being read (all good), or the mic is idle.
 * - `no-input`   — mic is on and playback is running, but we hear silence:
 *                  the user isn't singing / the mic isn't picking them up.
 * - `too-quiet`  — mic is on and we hear audible sound, but it's too faint for
 *                  the detector to read a pitch.
 */
export type MicInsight = 'none' | 'no-input' | 'too-quiet'

export interface MicInsightsOptions {
  /** Gate the monitor (e.g. only on the active tab). Default: always on. */
  enabled?: () => boolean
  /** Is the microphone currently on. */
  micActive: () => boolean
  /** Is playback running on this tab (so the user is meant to be singing). */
  isPlaying: () => boolean
  /** Current input level as RMS amplitude (0–1). */
  getLevel: () => number
  /** Is the detector currently producing a pitch (the live "green line"). */
  isDetecting: () => boolean
  /** Fired whenever the derived insight changes (event-style hook for consumers). */
  onChange?: (insight: MicInsight) => void
}

export interface MicInsights {
  /** The current debounced insight (reactive). */
  insight: Accessor<MicInsight>
  /** Human-readable message for the current insight ('' when `none`). */
  message: Accessor<string>
}

/** Below this RMS the signal is effectively silence (ambient room noise). */
const NOISE_FLOOR = 0.01
/** Sustained audible-but-undetected frames before warning (~0.75s @ 60fps). */
const TOO_QUIET_FRAMES = 45
/** Sustained silence-during-playback frames before warning (~1.5s @ 60fps),
 *  long enough not to fire in the gaps between sung notes. */
const NO_INPUT_FRAMES = 90
/** Keep a surfaced warning on screen at least this long so it's readable. */
const MIN_DISPLAY_MS = 1300

export const MIC_INSIGHT_MESSAGE: Record<MicInsight, string> = {
  none: '',
  'no-input':
    "Your mic is on but we can't hear you — sing up, or check your mic input.",
  'too-quiet':
    "We can hear you, but it's too quiet to read your pitch — move closer or lower the mic sensitivity.",
}

const now = (): number =>
  typeof performance !== 'undefined' ? performance.now() : 0

/**
 * Derives a debounced {@link MicInsight} from raw mic state. The detector is the
 * ground truth: while a pitch is read the insight is `none`. Otherwise we
 * distinguish audible-but-unreadable (`too-quiet`) from silence-while-playing
 * (`no-input`), each debounced, and hold a surfaced warning for a readable
 * minimum so messages don't flicker away before they can be read. Runs a single
 * rAF loop that lives only while the mic is on and the monitor is enabled.
 */
export function useMicInsights(opts: MicInsightsOptions): MicInsights {
  const [insight, setInsight] = createSignal<MicInsight>('none')
  const enabled = () => opts.enabled?.() ?? true
  const message = () => MIC_INSIGHT_MESSAGE[insight()]

  const emit = (next: MicInsight) => {
    if (next !== insight()) {
      setInsight(next)
      opts.onChange?.(next)
    }
  }

  createEffect(() => {
    if (!enabled() || !opts.micActive()) {
      emit('none')
      return
    }

    let raf = 0
    let smoothed = 0
    let tooQuietFrames = 0
    let silentFrames = 0
    let shownAt = 0 // when the current warning was first surfaced

    const tick = () => {
      smoothed = smoothed * 0.8 + opts.getLevel() * 0.2

      // 1) Debounced target insight from the raw signal.
      let target: MicInsight = 'none'
      if (opts.isDetecting()) {
        tooQuietFrames = 0
        silentFrames = 0
      } else if (smoothed > NOISE_FLOOR) {
        silentFrames = 0
        tooQuietFrames += 1
        if (tooQuietFrames >= TOO_QUIET_FRAMES) target = 'too-quiet'
      } else {
        tooQuietFrames = 0
        if (opts.isPlaying()) {
          silentFrames += 1
          if (silentFrames >= NO_INPUT_FRAMES) target = 'no-input'
        } else {
          silentFrames = 0
        }
      }

      // 2) Hold a surfaced warning for a readable minimum before clearing.
      const current = insight()
      const holding =
        target === 'none' &&
        current !== 'none' &&
        now() - shownAt < MIN_DISPLAY_MS
      if (!holding) {
        if (target !== 'none' && target !== current) shownAt = now()
        emit(target)
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    onCleanup(() => cancelAnimationFrame(raf))
  })

  return { insight, message }
}
