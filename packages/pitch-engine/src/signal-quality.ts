// ============================================================
// signal-quality — a rolling verdict on what the mic is hearing
// ============================================================
//
// Framework-free publish/read seam, modeled on mic-level.ts. A PitchDetector
// constructed with `telemetry: 'live'` publishes one DetectionFrameStats per
// detect() call; the signal-quality advisor polls readSignalQuality() and
// decides whether to speak up. Nothing here is reactive, and nothing
// allocates on the per-frame path — ten one-second buckets absorb the
// stream, so the cost of a frame is a handful of integer bumps.
//
// What "noisy environment" means here, concretely:
//   - blip runs: accepted-pitch runs of <= BLIP_MAX_FRAMES consecutive
//     frames. Real singing produces runs of dozens of frames (the detector's
//     own stability filter needs five to confirm a note); ambient noise that
//     slips the gates produces stutter.
//   - ambient floor: the mean RMS of REJECTED frames. Noise carries energy
//     without periodicity, so it is rejected by the confidence gate at full
//     loudness — in a genuinely quiet room the rejected frames are
//     near-silence instead, and this mean sits far below the RMS gate.
//   - clarity crowding: accepted frames whose confidence barely clears the
//     floor — detections that are one gust away from being noise themselves.

export interface DetectionFrameStats {
  rms: number
  /** Raw algorithm confidence — 0 when the RMS gate rejected the frame. */
  clarity: number
  accepted: boolean
  /** Detected frequency, 0 when rejected. */
  frequency: number
  /** The detector's RMS gate (minAmplitude) at frame time. */
  gateRms: number
  /** The effective confidence floor the frame was judged against. */
  confidenceFloor: number
  atMs: number
}

export interface SignalQualitySnapshot {
  /** How long the current window has been filling (capped at the window). */
  observedMs: number
  lastFrameAtMs: number
  blipRuns: number
  acceptedFrames: number
  rejectedFrames: number
  /** Mean RMS of rejected frames across the window (0 when none). */
  ambientFloorRms: number
  /** Share of accepted frames within CROWDED_MARGIN of the floor (0-1). */
  crowdedShare: number
  /** Latest RMS gate seen — the preset the window was measured under. */
  gateRms: number
}

export type SignalQualityVerdict = 'ok' | 'noisy-environment'

export const SIGNAL_WINDOW_MS = 10_000
export const SIGNAL_BUCKET_MS = 1_000
/** An accepted run this short is a blip, not a note. */
export const BLIP_MAX_FRAMES = 3
export const MIN_BLIP_RUNS = 6
/** The rejected-frame floor must crowd the gate by this factor to matter. */
export const GATE_HEADROOM = 1.5
/** Below this many rejected frames the floor estimate is not trusted. */
export const MIN_REJECTED_FRAMES = 20
export const CROWDED_MARGIN = 0.1
export const CROWDED_SHARE = 0.6
export const MIN_ACCEPTED_FOR_CROWDING = 5
/** This much continuous near-silence forgets the window early. */
export const CLEAN_RESET_MS = 3_000

const BUCKET_COUNT = SIGNAL_WINDOW_MS / SIGNAL_BUCKET_MS

interface Bucket {
  blipRuns: number
  accepted: number
  rejected: number
  rejectedRmsSum: number
  crowded: number
}

const buckets: Bucket[] = Array.from({ length: BUCKET_COUNT }, () => ({
  blipRuns: 0,
  accepted: 0,
  rejected: 0,
  rejectedRmsSum: 0,
  crowded: 0,
}))

let lastAbsBucket = -1
let firstFrameAtMs = 0
let lastFrameAtMs = 0
let currentRunFrames = 0
let cleanSinceMs: number | null = null
let latestGateRms = 0

function zeroBucket(b: Bucket): void {
  b.blipRuns = 0
  b.accepted = 0
  b.rejected = 0
  b.rejectedRmsSum = 0
  b.crowded = 0
}

export function resetSignalQuality(): void {
  for (const b of buckets) zeroBucket(b)
  lastAbsBucket = -1
  firstFrameAtMs = 0
  lastFrameAtMs = 0
  currentRunFrames = 0
  cleanSinceMs = null
  latestGateRms = 0
}

export function publishDetectionFrame(f: DetectionFrameStats): void {
  const abs = Math.floor(f.atMs / SIGNAL_BUCKET_MS)
  if (lastAbsBucket === -1) {
    lastAbsBucket = abs
    firstFrameAtMs = f.atMs
  } else if (abs > lastAbsBucket) {
    // Rotate: every bucket between then and now is empty time.
    const steps = Math.min(abs - lastAbsBucket, BUCKET_COUNT)
    for (let i = 1; i <= steps; i++) {
      zeroBucket(buckets[(lastAbsBucket + i) % BUCKET_COUNT])
    }
    lastAbsBucket = abs
    // A gap longer than the window is a new observation, not a continuation.
    if (f.atMs - lastFrameAtMs > SIGNAL_WINDOW_MS) {
      firstFrameAtMs = f.atMs
      currentRunFrames = 0
      cleanSinceMs = null
    }
  }
  const bucket = buckets[abs % BUCKET_COUNT]
  lastFrameAtMs = f.atMs
  latestGateRms = f.gateRms

  if (f.accepted) {
    currentRunFrames++
    bucket.accepted++
    if (f.clarity < f.confidenceFloor + CROWDED_MARGIN) bucket.crowded++
  } else {
    if (currentRunFrames > 0 && currentRunFrames <= BLIP_MAX_FRAMES) {
      bucket.blipRuns++
    }
    currentRunFrames = 0
    bucket.rejected++
    bucket.rejectedRmsSum += f.rms
  }

  // Sustained near-silence means the disturbance passed — forget early
  // instead of letting a stale verdict ride the window for ten seconds.
  const clean = !f.accepted && f.rms < 0.5 * f.gateRms
  if (clean) {
    cleanSinceMs ??= f.atMs
    if (f.atMs - cleanSinceMs >= CLEAN_RESET_MS) {
      const at = f.atMs
      const gate = f.gateRms
      resetSignalQuality()
      lastAbsBucket = Math.floor(at / SIGNAL_BUCKET_MS)
      firstFrameAtMs = at
      lastFrameAtMs = at
      latestGateRms = gate
    }
  } else {
    cleanSinceMs = null
  }
}

export function readSignalQuality(): SignalQualitySnapshot {
  let blipRuns = 0
  let accepted = 0
  let rejected = 0
  let rejectedRmsSum = 0
  let crowded = 0
  for (const b of buckets) {
    blipRuns += b.blipRuns
    accepted += b.accepted
    rejected += b.rejected
    rejectedRmsSum += b.rejectedRmsSum
    crowded += b.crowded
  }
  return {
    observedMs:
      lastAbsBucket === -1
        ? 0
        : Math.min(lastFrameAtMs - firstFrameAtMs, SIGNAL_WINDOW_MS),
    lastFrameAtMs,
    blipRuns,
    acceptedFrames: accepted,
    rejectedFrames: rejected,
    ambientFloorRms: rejected === 0 ? 0 : rejectedRmsSum / rejected,
    crowdedShare: accepted === 0 ? 0 : crowded / accepted,
    gateRms: latestGateRms,
  }
}

/**
 * Pure verdict over a snapshot. The advisor supplies the one piece of
 * context the stream cannot know: whether the user is still on the most
 * permissive preset, where a raised gate is the obvious first remedy.
 */
export function classifySignalQuality(
  s: SignalQualitySnapshot,
  opts: { presetIsQuiet: boolean },
): SignalQualityVerdict {
  const floorCrowdsGate =
    s.rejectedFrames >= MIN_REJECTED_FRAMES &&
    s.gateRms > 0 &&
    s.ambientFloorRms > GATE_HEADROOM * s.gateRms
  const clarityCrowded =
    s.acceptedFrames >= MIN_ACCEPTED_FOR_CROWDING &&
    s.crowdedShare >= CROWDED_SHARE
  return s.blipRuns >= MIN_BLIP_RUNS &&
    floorCrowdsGate &&
    (clarityCrowded || opts.presetIsQuiet)
    ? 'noisy-environment'
    : 'ok'
}
