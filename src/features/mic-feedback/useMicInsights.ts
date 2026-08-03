import type { Accessor } from 'solid-js'
import { createEffect, createSignal, onCleanup } from 'solid-js'
import { createPersistedSignal } from '@/lib/storage'

/**
 * A single, debounced "what's happening with the mic" state, shared by every
 * tab that listens to the mic (Singing, Karaoke, Piano, Guitar, Jam):
 *
 * - `none`       — a pitch is being read (all good), or the mic is idle.
 * - `mic-off`    — playback is running but the mic is off, so nothing the
 *                  user sings is heard or scored. Dismissible for good.
 * - `no-input`   — mic is on and playback is running, but we hear silence:
 *                  the user isn't singing / the mic isn't picking them up.
 * - `too-quiet`  — mic is on during playback and we hear audible sound, but
 *                  it's too faint for the detector to read a pitch.
 */
export type MicInsight = 'none' | 'mic-off' | 'no-input' | 'too-quiet'

/** "Don't show again" for the playback-with-mic-off hint (all mic tabs). */
export const [micOffHintDismissed, setMicOffHintDismissed] =
  createPersistedSignal<boolean>('pitchperfect_mic_off_hint_dismissed', false)

export const dismissMicOffHint = (): void => {
  setMicOffHintDismissed(true)
}

export interface MicInsightsOptions {
  /** Gate the monitor (e.g. only on the active tab). Default: always on. */
  enabled?: () => boolean
  /** Is the microphone currently on. */
  micActive: () => boolean
  /** Is playback running on this tab (so the user is meant to be singing). */
  isPlaying: () => boolean
  /** Current input level as RMS amplitude (0–1). */
  getLevel: () => number
  /** The detector's current RMS amplitude gate. When omitted, the hook keeps
   *  the legacy audible-but-undetected warning policy for that consumer. */
  getMinAmplitude?: () => number
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

export const MIC_INSIGHT_MESSAGE: Record<MicInsight, string> = {
  none: '',
  'mic-off':
    'Your mic is off — turn it on to be heard and scored while you play along.',
  'no-input':
    'Your mic is on, but no usable input is reaching MercuryPitch. Check the selected input and close other tabs or apps using it.',
  'too-quiet':
    'Input is too weak for pitch tracking. Move closer, check the input gain, and close other tabs or apps using this mic.',
}

export interface MicSignalSample {
  isPlaying: boolean
  isDetecting: boolean
  level: number
  minAmplitude?: number
}

/**
 * Classify one already-smoothed active-mic sample before debounce. A strong
 * unpitched sound is not weak input: it may be breath, speech, percussion, or
 * a note outside the detector's range. Consumers that expose the detector's
 * real amplitude gate therefore produce `too-quiet` only below that gate;
 * older consumers retain their prior policy until they expose one.
 */
export function classifyMicSignal(
  sample: MicSignalSample,
): Exclude<MicInsight, 'mic-off'> {
  if (!sample.isPlaying || sample.isDetecting) return 'none'
  if (sample.level <= NOISE_FLOOR) return 'no-input'
  // Not every existing consumer exposes its detector yet. Preserve their
  // prior audible-but-undetected policy instead of guessing a threshold that
  // may disagree with their user-configured detector.
  if (sample.minAmplitude === undefined) return 'too-quiet'
  const minAmplitude = Math.max(NOISE_FLOOR, sample.minAmplitude)
  return sample.level < minAmplitude ? 'too-quiet' : 'none'
}

/**
 * Derives a debounced {@link MicInsight} from raw mic state. The detector is the
 * ground truth: while a pitch is read the insight is `none`. Otherwise we
 * distinguish low input (`too-quiet`) from silence-while-playing (`no-input`),
 * each debounced. Where supplied, the detector's active amplitude gate decides
 * whether input is actually low. Recovery clears immediately so a live pitch
 * or healthy level can never sit behind a stale warning. Runs a single rAF
 * loop that lives only while the mic is on and the monitor is enabled.
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
    if (!enabled()) {
      emit('none')
      return
    }

    // Mic fully off: no signal to monitor. While playback runs, surface the
    // persistent "you won't be heard" hint (unless dismissed for good).
    if (!opts.micActive()) {
      emit(opts.isPlaying() && !micOffHintDismissed() ? 'mic-off' : 'none')
      return
    }

    let raf = 0
    let smoothed = 0
    let tooQuietFrames = 0
    let silentFrames = 0

    const tick = () => {
      smoothed = smoothed * 0.8 + opts.getLevel() * 0.2

      const candidate = classifyMicSignal({
        isPlaying: opts.isPlaying(),
        isDetecting: opts.isDetecting(),
        level: smoothed,
        minAmplitude: opts.getMinAmplitude?.(),
      })
      let target: MicInsight = 'none'
      if (candidate === 'too-quiet') {
        silentFrames = 0
        tooQuietFrames += 1
        if (tooQuietFrames >= TOO_QUIET_FRAMES) target = 'too-quiet'
      } else if (candidate === 'no-input') {
        tooQuietFrames = 0
        silentFrames += 1
        if (silentFrames >= NO_INPUT_FRAMES) target = 'no-input'
      } else {
        tooQuietFrames = 0
        silentFrames = 0
      }

      emit(target)

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    onCleanup(() => cancelAnimationFrame(raf))
  })

  return { insight, message }
}
