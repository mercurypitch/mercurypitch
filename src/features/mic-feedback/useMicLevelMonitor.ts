import type { Accessor } from 'solid-js'
import { createEffect, createSignal, onCleanup } from 'solid-js'

interface MicLevelMonitorOptions {
  /** Is the microphone currently on. */
  micActive: () => boolean
  /** Current input level as RMS amplitude (0–1). */
  getLevel: () => number
  /** Is the detector currently producing a pitch (the live "green line"). */
  isDetecting: () => boolean
}

interface MicLevelMonitor {
  /**
   * True when the mic is picking up audible sound but NO pitch is being
   * detected for a sustained moment — i.e. "we hear you, but it's too quiet
   * to read your pitch". Clears immediately once a pitch is recognised or the
   * signal drops to silence.
   */
  tooQuiet: Accessor<boolean>
}

// Below this RMS we treat the signal as effectively silent (ambient noise),
// so we don't nag when the user simply isn't singing.
const NOISE_FLOOR = 0.01
// Sustained audible-but-undetected frames before we surface the hint
// (~0.75s @ 60fps), so it doesn't flash between notes.
const QUIET_FRAMES_TO_WARN = 45

/**
 * Monitors the live mic input (only while the mic is on) and derives a
 * debounced "too quiet to detect" state. The ground truth is the detector:
 * if a pitch is being recognised the hint is hidden; it only appears when
 * there is audible input the detector can't read. Runs a single rAF loop that
 * starts when the mic turns on and is cancelled when it turns off.
 */
export function useMicLevelMonitor(
  opts: MicLevelMonitorOptions,
): MicLevelMonitor {
  const [tooQuiet, setTooQuiet] = createSignal(false)

  createEffect(() => {
    if (!opts.micActive()) {
      setTooQuiet(false)
      return
    }

    let raf = 0
    let quietFrames = 0
    let smoothed = 0

    const tick = () => {
      smoothed = smoothed * 0.8 + opts.getLevel() * 0.2

      if (opts.isDetecting()) {
        // A pitch is being read — by definition not too quiet.
        quietFrames = 0
        setTooQuiet(false)
      } else if (smoothed > NOISE_FLOOR) {
        // Audible, but the detector isn't getting a pitch from it.
        quietFrames += 1
        if (quietFrames >= QUIET_FRAMES_TO_WARN) setTooQuiet(true)
      } else {
        // Effectively silent — not singing.
        quietFrames = 0
        setTooQuiet(false)
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    onCleanup(() => cancelAnimationFrame(raf))
  })

  return { tooQuiet }
}
