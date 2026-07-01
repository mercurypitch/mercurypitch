// ============================================================
// Voice Mirror — F0 frame stream over the shared mic.
//
// Bridges the app's capture chain (MicManager stream → AnalyserNode)
// and the YIN detector into the pure `F0Frame` contract the mirror
// metrics consume. Polls on requestAnimationFrame (~16 ms hop),
// which is sufficient for the mirror's 150 ms dwell/lock windows.
//
// Deliberately uses only the 'yin' algorithm — no SwiftF0/ONNX —
// so the mirror bundle ships no model weights (spec bundle rule).
// ============================================================

import type { F0Frame } from '@/lib/mirror/metrics'
import { PitchDetector } from '@/lib/pitch-detector'

const FFT_SIZE = 2048

export interface F0Stream {
  /** Begin a task recording: clears frames and re-zeroes the clock. */
  startTask: () => void
  /** Frames captured since the last startTask(), time-relative to it. */
  takeFrames: () => F0Frame[]
  /** The most recent frame, for live visual feedback (null before any). */
  latest: () => F0Frame | null
  /** Tear down the audio graph (does not stop the MediaStream itself). */
  dispose: () => void
}

/**
 * Create the polling F0 stream. The caller owns the MediaStream (via
 * micManager) and the AudioContext (created inside a user gesture for iOS
 * Safari); this owns the analyser + detector + rAF loop.
 */
export function createF0Stream(
  audioContext: AudioContext,
  stream: MediaStream,
): F0Stream {
  const source = audioContext.createMediaStreamSource(stream)
  const analyser = audioContext.createAnalyser()
  analyser.fftSize = FFT_SIZE
  source.connect(analyser)

  const detector = new PitchDetector({
    sampleRate: audioContext.sampleRate,
    bufferSize: FFT_SIZE,
    algorithm: 'yin',
    // Human singing range with headroom; keeps YIN off subharmonics.
    minFrequency: 60,
    maxFrequency: 1600,
  })

  const buffer = new Float32Array(FFT_SIZE)
  let frames: F0Frame[] = []
  let latestFrame: F0Frame | null = null
  let taskStart = performance.now()
  let rafId = 0
  let disposed = false
  let recording = false

  const loop = (): void => {
    if (disposed) return
    rafId = requestAnimationFrame(loop)
    // Only run YIN while a take is actually recording — during briefs and
    // reference-tone playback the frames would be discarded anyway, and a
    // full 2048-sample pass 60×/s is real battery on mobile.
    if (!recording) return
    analyser.getFloatTimeDomainData(buffer)
    const detected = detector.detect(buffer)
    const frame: F0Frame = {
      t: (performance.now() - taskStart) / 1000,
      f0: detected.frequency > 0 ? detected.frequency : 0,
      conf: detected.frequency > 0 ? detected.clarity : 0,
    }
    frames.push(frame)
    latestFrame = frame
  }
  rafId = requestAnimationFrame(loop)

  return {
    startTask: () => {
      taskStart = performance.now()
      frames = []
      latestFrame = null
      recording = true
      // The detector's stability filter keeps a short pitch history that
      // would otherwise clamp the first frames of a new take toward the
      // previous task's trailing pitch.
      detector.resetHistory()
    },
    takeFrames: () => {
      recording = false
      const taken = frames
      frames = []
      return taken
    },
    latest: () => latestFrame,
    dispose: () => {
      disposed = true
      cancelAnimationFrame(rafId)
      source.disconnect()
    },
  }
}
