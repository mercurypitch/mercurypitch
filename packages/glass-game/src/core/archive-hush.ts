// Archive Hush — fresh aimed humming and one movable cover protect an authored chime.
import type { PitchObservation } from '../contracts'

export type ArchiveHushPhase =
  | 'preparing'
  | 'telegraph'
  | 'paused'
  | 'complete'
  | 'retry'

export interface ArchiveHushOptions {
  vesselIds: readonly string[]
  targetMidi: number
  curtainVesselIds?: readonly string[]
  holdSeconds?: number
  telegraphSeconds?: number
}

export interface ArchiveHushSnapshot {
  phase: ArchiveHushPhase
  aimedId: string | null
  coveredId: string | null
  curtainVesselIds: string[]
  curtainClosed: boolean
  protectedIds: string[]
  holdProgress: number
  telegraphRemainingSeconds: number
  missedIds: string[]
  attempt: number
  pausedFrom: 'preparing' | 'telegraph' | null
  captureReady: boolean
}

export interface ArchiveHush {
  snapshot(): ArchiveHushSnapshot
  aim(id: string | null): void
  moveCover(id: string | null): void
  setCurtainClosed(closed: boolean): void
  observe(frame: PitchObservation, nowMs: number): void
  /** Foreground clock; a long presentation gap pauses rather than skips the chime. */
  tick(nowMs: number, captureHealthy: boolean): void
  ring(nowMs: number): boolean
  pause(): void
  resume(nowMs: number): void
  /** Exclude captured app audio, including tails; the host owns the actual barrier. */
  fenceAudio(untilMs: number): void
  setTargetMidi(midi: number): void
  reset(nowMs?: number): void
}

const MAXIMUM_AGE_MS = 150
const MAXIMUM_CAPTURE_GAP_SECONDS = 0.15
const MAXIMUM_TICK_GAP_MS = 250
const CONFIDENCE_FLOOR = 0.8
const TOLERANCE_CENTS = 65
const MAXIMUM_SHIELDS = 2

function validTarget(midi: number): boolean {
  return Number.isFinite(midi) && midi >= 0 && midi <= 127
}

/** No microphone, audio, timers, persistence, glass damage or movement lives here. */
export function createArchiveHush(options: ArchiveHushOptions): ArchiveHush {
  const ids = [...options.vesselIds]
  const curtainIds = [...(options.curtainVesselIds ?? [])]
  const holdSeconds = options.holdSeconds ?? 1
  const telegraphSeconds = options.telegraphSeconds ?? 3
  if (
    ids.length < 3 ||
    ids.length > 5 ||
    curtainIds.length > 2 ||
    new Set(curtainIds).size !== curtainIds.length ||
    curtainIds.some((id) => !ids.includes(id)) ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => id.length === 0) ||
    !validTarget(options.targetMidi) ||
    !Number.isFinite(holdSeconds) ||
    holdSeconds <= 0 ||
    !Number.isFinite(telegraphSeconds) ||
    telegraphSeconds <= 0
  )
    throw new Error(
      'Archive Hush needs 3–5 unique displays, up to two curtain displays and finite positive timing',
    )

  let targetMidi = options.targetMidi
  let phase: ArchiveHushPhase = 'preparing'
  let pausedFrom: ArchiveHushSnapshot['pausedFrom'] = null
  let aimedId: string | null = ids[0]
  let coveredId: string | null = ids.at(-1)!
  let curtainClosed = false
  const protectedIds = new Set<string>()
  let missedIds: string[] = []
  let holdProgress = 0
  let remaining = telegraphSeconds
  let attempt = 1
  let lastSequence = -Infinity
  let lastCaptureSeconds = -Infinity
  let lastCapturedAtMs = -Infinity
  let lastObservedAtMs = -Infinity
  let previousPitched = false
  let capturedAfterMs = -Infinity
  let audioFencedUntilMs = -Infinity
  let captureReady = false
  let awaitingFreshCapture = true
  let lastTickMs: number | null = null

  const clearHold = (): void => {
    holdProgress = 0
    previousPitched = false
  }
  const freshBaseline = (nowMs: number): void => {
    clearHold()
    captureReady = false
    awaitingFreshCapture = true
    lastTickMs = null
    lastSequence = -Infinity
    lastCaptureSeconds = -Infinity
    lastCapturedAtMs = -Infinity
    lastObservedAtMs = -Infinity
    capturedAfterMs = Math.max(capturedAfterMs, nowMs)
  }
  const editable = (): boolean => phase === 'preparing' || phase === 'telegraph'
  const pause = (): void => {
    if (!editable()) return
    pausedFrom = phase as 'preparing' | 'telegraph'
    phase = 'paused'
    clearHold()
    captureReady = false
    lastTickMs = null
    if (pausedFrom === 'telegraph') remaining = telegraphSeconds
  }
  const fresh = (nowMs: number): boolean => {
    const age = nowMs - lastCapturedAtMs
    return (
      captureReady && Number.isFinite(age) && age >= -5 && age <= MAXIMUM_AGE_MS
    )
  }

  return {
    snapshot: () => ({
      phase,
      aimedId,
      coveredId,
      curtainVesselIds: [...curtainIds],
      curtainClosed,
      protectedIds: [...protectedIds],
      holdProgress,
      telegraphRemainingSeconds: remaining,
      missedIds: [...missedIds],
      attempt,
      pausedFrom,
      captureReady,
    }),
    aim(id) {
      if (!editable() || (id !== null && !ids.includes(id)) || id === aimedId)
        return
      aimedId = id
      clearHold()
    },
    moveCover(id) {
      if (
        phase !== 'preparing' ||
        (id !== null && !ids.includes(id)) ||
        id === coveredId
      )
        return
      coveredId = id
      clearHold()
    },
    setCurtainClosed(closed) {
      if (
        phase !== 'preparing' ||
        curtainIds.length === 0 ||
        closed === curtainClosed
      )
        return
      curtainClosed = closed
      clearHold()
    },
    observe(frame, nowMs) {
      if (
        !editable() ||
        !Number.isFinite(nowMs) ||
        nowMs < lastObservedAtMs ||
        !Number.isSafeInteger(frame.sequence) ||
        frame.sequence < 0 ||
        !Number.isFinite(frame.captureSeconds) ||
        !Number.isFinite(frame.capturedAtMs) ||
        frame.capturedAtMs <= capturedAfterMs ||
        frame.sequence <= lastSequence ||
        frame.captureSeconds <= lastCaptureSeconds ||
        frame.capturedAtMs <= lastCapturedAtMs
      )
        return

      // An impossible future timestamp must not poison the monotonic watermark.
      if (nowMs - frame.capturedAtMs < -5) {
        clearHold()
        captureReady = false
        return
      }

      const elapsed = Math.min(
        frame.captureSeconds - lastCaptureSeconds,
        (frame.capturedAtMs - lastCapturedAtMs) / 1000,
      )
      const captureGap = frame.captureSeconds - lastCaptureSeconds
      const wallGap = (frame.capturedAtMs - lastCapturedAtMs) / 1000
      lastSequence = frame.sequence
      lastCaptureSeconds = frame.captureSeconds
      lastCapturedAtMs = frame.capturedAtMs
      lastObservedAtMs = nowMs
      const age = nowMs - frame.capturedAtMs
      captureReady = age >= -5 && age <= MAXIMUM_AGE_MS
      if (captureReady && awaitingFreshCapture) {
        awaitingFreshCapture = false
        lastTickMs = nowMs
      }
      const pitched =
        captureReady &&
        frame.capturedAtMs > audioFencedUntilMs &&
        frame.midi !== null &&
        Number.isFinite(frame.midi) &&
        Number.isFinite(frame.confidence) &&
        frame.confidence >= CONFIDENCE_FLOOR &&
        Math.abs(frame.midi - targetMidi) * 100 <= TOLERANCE_CENTS
      const canProtect =
        aimedId !== null &&
        aimedId !== coveredId &&
        !(curtainClosed && curtainIds.includes(aimedId)) &&
        !protectedIds.has(aimedId) &&
        protectedIds.size < MAXIMUM_SHIELDS
      if (!pitched || !canProtect) {
        clearHold()
        return
      }
      if (
        captureGap > MAXIMUM_CAPTURE_GAP_SECONDS + 1e-9 ||
        wallGap > MAXIMUM_CAPTURE_GAP_SECONDS + 1e-9
      )
        clearHold()
      if (previousPitched)
        holdProgress = Math.min(1, holdProgress + elapsed / holdSeconds)
      previousPitched = true
      if (holdProgress >= 1 - 1e-9 && aimedId !== null) {
        protectedIds.add(aimedId)
        clearHold()
      }
    },
    tick(nowMs, captureHealthy) {
      if (
        !editable() ||
        !Number.isFinite(nowMs) ||
        (lastTickMs !== null && nowMs < lastTickMs)
      )
        return
      if (awaitingFreshCapture) return
      const elapsedMs = lastTickMs === null ? 0 : nowMs - lastTickMs
      if (!captureHealthy || !fresh(nowMs) || elapsedMs > MAXIMUM_TICK_GAP_MS) {
        clearHold()
        captureReady = false
        if (phase === 'telegraph') pause()
        else {
          awaitingFreshCapture = true
          lastTickMs = null
        }
        return
      }
      lastTickMs = nowMs
      if (phase !== 'telegraph') return
      remaining = Math.max(0, remaining - elapsedMs / 1000)
      if (remaining > 1e-9) return
      remaining = 0
      missedIds = ids.filter(
        (id) =>
          id !== coveredId &&
          !protectedIds.has(id) &&
          !(curtainClosed && curtainIds.includes(id)),
      )
      phase = missedIds.length === 0 ? 'complete' : 'retry'
      clearHold()
    },
    ring(nowMs) {
      if (
        phase !== 'preparing' ||
        !Number.isFinite(nowMs) ||
        nowMs < lastObservedAtMs ||
        !fresh(nowMs)
      )
        return false
      phase = 'telegraph'
      remaining = telegraphSeconds
      lastTickMs = nowMs
      clearHold()
      return true
    },
    pause,
    resume(nowMs) {
      if (
        phase !== 'paused' ||
        !Number.isFinite(nowMs) ||
        nowMs < lastObservedAtMs
      )
        return
      phase = pausedFrom ?? 'preparing'
      pausedFrom = null
      freshBaseline(nowMs)
    },
    fenceAudio(untilMs) {
      if (!Number.isFinite(untilMs)) return
      audioFencedUntilMs = Math.max(audioFencedUntilMs, untilMs)
      clearHold()
    },
    setTargetMidi(midi) {
      if (!validTarget(midi) || midi === targetMidi) return
      targetMidi = midi
      clearHold()
    },
    reset(nowMs = Math.max(0, lastObservedAtMs)) {
      if (!Number.isFinite(nowMs) || nowMs < lastObservedAtMs) return
      phase = 'preparing'
      pausedFrom = null
      protectedIds.clear()
      missedIds = []
      aimedId = ids[0]
      coveredId = ids.at(-1)!
      curtainClosed = false
      remaining = telegraphSeconds
      attempt += 1
      freshBaseline(nowMs)
    },
  }
}
