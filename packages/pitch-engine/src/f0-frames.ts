// Turning detections into the stream's two views of the voice.
// ============================================================
//
// Everything the F0 stream does *after* the detector answers lives here,
// away from any clock: the recorded take, the raw latest frame, and the
// smoothed view that ribbons and the glass resonance actually read.
//
// It is separate because the stream now has two sources — an audio-clock
// worklet and a requestAnimationFrame fallback — and both must produce
// identical frames. A shared pure assembler is the only way to be sure
// of that, and it is the only way to test the smoothing at all: the
// median window and the gap bridge are the parts most likely to be
// broken by a change in hop rate, and neither is observable through a
// live microphone.
//
// The one deliberate behaviour change: the gap bridge is specified in
// milliseconds rather than in frames. It was eight frames, described in
// the code as "~130 ms at 60 fps" — true only while the hop happened to
// be a rendered frame. With a fixed audio-clock hop the time is the
// thing we mean, so the time is the thing we state.

import type { F0Frame } from './measurements'

/** An F0Frame plus the analysed buffer's RMS level (0..1). */
export interface PitchFrame extends F0Frame {
  rms: number
}

/** A detector answer, before it becomes part of a take. */
export interface Detection {
  /** Seconds since the current take began. */
  t: number
  /** Detected fundamental in Hz, or 0 for unvoiced. */
  f0: number
  /** Detector clarity 0..1, or 0 for unvoiced. */
  conf: number
  /** RMS of the analysed window, 0..1. */
  rms: number
}

/** How long a held pitch survives a consonant or a quick breath. */
export const BRIDGE_MS = 130

/** How many voiced readings the median runs over. */
export const MEDIAN_WINDOW = 5

/** A voiced reading is one the detector is at least half sure of. */
const VOICED_CONF = 0.5

export interface FrameAssembler {
  /** Begin a take: clears frames, re-zeroes the clock, drops smoothing. */
  startTake: () => void
  /** Fold one detection in. Ignored unless a take is recording. */
  ingest: (detection: Detection) => void
  /**
   * Re-derive the gap bridge for a new hop rate. The stream calls this
   * once, when it learns whether it got the audio-clock hop or the frame
   * loop; the bridge is a duration, so the frame count behind it has to
   * follow the hop rather than outlive it.
   */
  setHopSeconds: (hopSeconds: number) => void
  /** Frames captured since startTake(), and ends the recording. */
  takeFrames: () => PitchFrame[]
  latest: () => PitchFrame | null
  latestSmoothed: () => PitchFrame | null
  latestLevel: () => number
  maxLevel: () => number
  isRecording: () => boolean
}

/**
 * @param hopSeconds the interval between detections, which fixes how many
 *   frames the gap bridge spans. The caller knows it exactly for the
 *   worklet path and approximately for the frame-loop fallback.
 */
export const createFrameAssembler = (hopSeconds: number): FrameAssembler => {
  const framesForBridge = (hop: number): number =>
    Math.max(1, Math.round(BRIDGE_MS / 1000 / hop))

  let bridgeFrames = framesForBridge(hopSeconds)

  let frames: PitchFrame[] = []
  let latestFrame: PitchFrame | null = null
  let smoothedFrame: PitchFrame | null = null
  let heldFrame: PitchFrame | null = null
  let voicedRing: number[] = []
  let bridgeLeft = 0
  let latestRms = 0
  let maxRms = 0
  let recording = false

  const updateSmoothed = (frame: PitchFrame): void => {
    if (frame.f0 > 0 && frame.conf >= VOICED_CONF) {
      voicedRing.push(frame.f0)
      if (voicedRing.length > MEDIAN_WINDOW) voicedRing.shift()
      const sorted = [...voicedRing].sort((a, b) => a - b)
      smoothedFrame = { ...frame, f0: sorted[Math.floor(sorted.length / 2)] }
      heldFrame = smoothedFrame
      bridgeLeft = bridgeFrames
    } else if (bridgeLeft > 0 && heldFrame !== null) {
      bridgeLeft--
      smoothedFrame = { ...heldFrame, t: frame.t, rms: frame.rms }
    } else {
      smoothedFrame = frame
      voicedRing = []
    }
  }

  return {
    startTake: () => {
      frames = []
      latestFrame = null
      smoothedFrame = null
      heldFrame = null
      voicedRing = []
      bridgeLeft = 0
      latestRms = 0
      maxRms = 0
      recording = true
    },
    setHopSeconds: (hop) => {
      bridgeFrames = framesForBridge(hop)
    },
    ingest: (detection) => {
      if (!recording) return
      latestRms = detection.rms
      if (latestRms > maxRms) maxRms = latestRms
      const frame: PitchFrame = {
        t: detection.t,
        f0: detection.f0 > 0 ? detection.f0 : 0,
        conf: detection.f0 > 0 ? detection.conf : 0,
        rms: detection.rms,
      }
      frames.push(frame)
      latestFrame = frame
      updateSmoothed(frame)
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
    isRecording: () => recording,
  }
}
