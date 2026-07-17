// ============================================================
// Shared F0 frame stream over the mic (Voice Mirror + Glass).
//
// Bridges the app's capture chain (MicManager stream → AnalyserNode)
// and the YIN detector into pure pitch frames. Polls on
// requestAnimationFrame (~16 ms hop), which is sufficient for the
// mirror's 150 ms dwell/lock windows and the glass's resonance tick.
// Each frame also carries the buffer's RMS level (`rms`) — the glass
// fatigue model needs per-frame loudness; mirror consumers see the
// same frames through the narrower `F0Frame` contract.
//
// Deliberately uses only the 'yin' algorithm — no SwiftF0/ONNX —
// so the standalone entries ship no model weights (bundle rule).
// Lives in src/lib/ so it rides the `pitch-core` manualChunk.
// ============================================================

import type { F0Frame } from '@/lib/mirror/metrics'
import { PitchDetector } from '@/lib/pitch-detector'

const FFT_SIZE = 2048

/** An F0Frame plus the analysed buffer's RMS level (0..1). */
export interface PitchFrame extends F0Frame {
  rms: number
}

export interface F0Stream {
  /** Begin a task recording: clears frames and re-zeroes the clock. */
  startTask: () => void
  /** Frames captured since the last startTask(), time-relative to it. */
  takeFrames: () => PitchFrame[]
  /** The most recent frame, for live visual feedback (null before any). */
  latest: () => PitchFrame | null
  /**
   * The most recent frame with a display/gameplay smoothing pass on top of
   * the detector's own stability filter: a median over the last few VOICED
   * readings (kills residual octave flickers) and short-gap bridging (the
   * held pitch survives consonants and quick breaths for ~130 ms instead
   * of collapsing to unvoiced). Recorded `takeFrames()` stay RAW so
   * metrics remain honest — this view is for ribbons and resonance.
   */
  latestSmoothed: () => PitchFrame | null
  /** RMS input level of the most recent analysed buffer (0..1). */
  latestLevel: () => number
  /** Highest RMS level observed since the last startTask(). */
  maxLevel: () => number
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
  // Muted sink: some WebKit versions only reliably pull an analyser that is
  // (transitively) connected to the destination. Zero gain keeps it silent.
  const keepalive = audioContext.createGain()
  keepalive.gain.value = 0
  analyser.connect(keepalive)
  keepalive.connect(audioContext.destination)

  const detector = new PitchDetector({
    sampleRate: audioContext.sampleRate,
    bufferSize: FFT_SIZE,
    algorithm: 'yin',
    // Human singing range with headroom; keeps YIN off subharmonics.
    minFrequency: 60,
    maxFrequency: 1600,
    // The mirror captures with AGC off (required for honest pitch), so raw
    // mobile input is quiet — the detector's 0.02 default RMS gate would
    // reject normal singing at arm's length on a phone.
    minAmplitude: 0.005,
  })

  const buffer = new Float32Array(FFT_SIZE)
  let frames: PitchFrame[] = []
  let latestFrame: PitchFrame | null = null
  // Smoothed-view state (median window over voiced f0 + gap bridging).
  const MEDIAN_WINDOW = 5
  const BRIDGE_FRAMES = 8 // ~130 ms at 60 fps
  let voicedRing: number[] = []
  let bridgeLeft = 0
  let heldFrame: PitchFrame | null = null
  let smoothedFrame: PitchFrame | null = null

  function updateSmoothed(frame: PitchFrame): void {
    const voiced = frame.f0 > 0 && frame.conf >= 0.5
    if (voiced) {
      voicedRing.push(frame.f0)
      if (voicedRing.length > MEDIAN_WINDOW) voicedRing.shift()
      const sorted = [...voicedRing].sort((a, b) => a - b)
      const median = sorted[Math.floor(sorted.length / 2)]
      smoothedFrame = { ...frame, f0: median }
      heldFrame = smoothedFrame
      bridgeLeft = BRIDGE_FRAMES
    } else if (bridgeLeft > 0 && heldFrame !== null) {
      // Bridge consonants/quick breaths: hold the last voiced pitch.
      bridgeLeft--
      smoothedFrame = { ...heldFrame, t: frame.t, rms: frame.rms }
    } else {
      smoothedFrame = frame
      voicedRing = []
    }
  }
  let latestRms = 0
  let maxRms = 0
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

    let sumSquares = 0
    for (let i = 0; i < buffer.length; i++) {
      sumSquares += buffer[i] * buffer[i]
    }
    latestRms = Math.sqrt(sumSquares / buffer.length)
    if (latestRms > maxRms) maxRms = latestRms

    const detected = detector.detect(buffer)
    const frame: PitchFrame = {
      t: (performance.now() - taskStart) / 1000,
      f0: detected.frequency > 0 ? detected.frequency : 0,
      conf: detected.frequency > 0 ? detected.clarity : 0,
      rms: latestRms,
    }
    frames.push(frame)
    latestFrame = frame
    updateSmoothed(frame)
  }
  rafId = requestAnimationFrame(loop)

  return {
    startTask: () => {
      taskStart = performance.now()
      frames = []
      latestFrame = null
      latestRms = 0
      maxRms = 0
      recording = true
      voicedRing = []
      bridgeLeft = 0
      heldFrame = null
      smoothedFrame = null
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
    latestSmoothed: () => smoothedFrame,
    latestLevel: () => latestRms,
    maxLevel: () => maxRms,
    dispose: () => {
      disposed = true
      cancelAnimationFrame(rafId)
      source.disconnect()
      analyser.disconnect()
      keepalive.disconnect()
    },
  }
}
