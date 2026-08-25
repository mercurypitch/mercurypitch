// useDrumNightLoopRange — one authored-beat A/B draft over Drum Night's route transport.
// ============================================================
//
// The shared rail owns pointer previews and geometry. This controller owns the
// musical boundary: snapping, the minimum span, one transport commit, and the
// pause/seek/resume lifecycle for a scrub. It never creates a clock.

import type { Accessor } from 'solid-js'
import { batch, createMemo, createSignal, onCleanup } from 'solid-js'
import type { DrumLoopRange, DrumTransportPhase } from './drum-transport'
import { DRUM_LOOP_MINIMUM_LENGTH_BEATS } from './drum-transport'

/** Initial sixteenth-note editor grid in quarter-note beat units. */
export const DRUM_LOOP_MARK_STEP_BEATS = 0.25
/** Shortest authored A/B range offered by the Drum Night editor. */
export const DRUM_LOOP_MARK_GAP_BEATS = 0.25

const PRECISION = 1e9

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function positiveOption(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value ?? 0) > 0
    ? (value ?? fallback)
    : fallback
}

function finiteDuration(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

export function snapDrumLoopBeat(
  value: number,
  durationBeats: number,
  stepBeats = DRUM_LOOP_MARK_STEP_BEATS,
): number | null {
  if (!Number.isFinite(value)) return null
  const limit = finiteDuration(durationBeats)
  if (!(limit > 0)) return null
  const step = positiveOption(stepBeats, DRUM_LOOP_MARK_STEP_BEATS)
  const snapped = Math.round(clamp(value, 0, limit) / step) * step
  return clamp(Math.round(snapped * PRECISION) / PRECISION, 0, limit)
}

/** Normalize untrusted/crossed input into one half-open authored span. */
export function normalizeDrumLoopRange(
  firstBeat: number | null,
  secondBeat: number | null,
  durationBeats: number,
  stepBeats = DRUM_LOOP_MARK_STEP_BEATS,
  minimumGapBeats = DRUM_LOOP_MARK_GAP_BEATS,
): DrumLoopRange | null {
  if (firstBeat === null || secondBeat === null) return null
  const first = snapDrumLoopBeat(firstBeat, durationBeats, stepBeats)
  const second = snapDrumLoopBeat(secondBeat, durationBeats, stepBeats)
  if (first === null || second === null) return null
  const startBeat = Math.min(first, second)
  const endBeat = Math.max(first, second)
  const minimumGap = Math.max(
    DRUM_LOOP_MINIMUM_LENGTH_BEATS,
    positiveOption(minimumGapBeats, DRUM_LOOP_MARK_GAP_BEATS),
  )
  if (endBeat - startBeat + Number.EPSILON < minimumGap) return null
  return Object.freeze({ startBeat, endBeat })
}

export interface DrumNightLoopRangeOptions {
  durationBeats: Accessor<number>
  positionBeats: Accessor<number>
  phase: Accessor<DrumTransportPhase>
  currentLoop: Accessor<DrumLoopRange | null>
  setLoop(loop: DrumLoopRange | null): boolean
  seekSeconds(seconds: number): void
  pause(): void
  resume(): unknown
  markStepBeats?: Accessor<number>
  minimumGapBeats?: Accessor<number>
}

export function useDrumNightLoopRange(options: DrumNightLoopRangeOptions) {
  const [markA, setMarkA] = createSignal<number | null>(null)
  const [markB, setMarkB] = createSignal<number | null>(null)
  const [isScrubbing, setIsScrubbing] = createSignal(false)
  let resumeAfterScrub = false
  let disposed = false

  const markStepBeats = (): number =>
    positiveOption(options.markStepBeats?.(), DRUM_LOOP_MARK_STEP_BEATS)
  const minimumGapBeats = (): number =>
    Math.max(
      DRUM_LOOP_MINIMUM_LENGTH_BEATS,
      positiveOption(options.minimumGapBeats?.(), DRUM_LOOP_MARK_GAP_BEATS),
    )
  const span = createMemo<DrumLoopRange | null>(() =>
    normalizeDrumLoopRange(
      markA(),
      markB(),
      options.durationBeats(),
      markStepBeats(),
      minimumGapBeats(),
    ),
  )
  const isPending = createMemo(
    () => span() === null && (markA() !== null || markB() !== null),
  )
  const isActive = createMemo(() => options.currentLoop() !== null)

  const restoreMarks = (first: number | null, second: number | null): void => {
    batch(() => {
      setMarkA(first)
      setMarkB(second)
    })
  }

  const commitDraft = (): boolean => {
    const next = span()
    if (next === null) {
      if (options.currentLoop() !== null) options.setLoop(null)
      return false
    }
    const previousLoop = options.currentLoop()
    if (!options.setLoop(next)) {
      restoreMarks(
        previousLoop?.startBeat ?? null,
        previousLoop?.endBeat ?? null,
      )
      return false
    }
    restoreMarks(next.startBeat, next.endBeat)
    return true
  }

  const moveMark = (mark: 'A' | 'B', value: number): boolean => {
    const duration = finiteDuration(options.durationBeats())
    const snapped = snapDrumLoopBeat(value, duration, markStepBeats())
    if (snapped === null) return false
    const gap = minimumGapBeats()
    if (mark === 'A') {
      const end = markB()
      const maximum = end === null ? duration : Math.max(0, end - gap)
      setMarkA(clamp(snapped, 0, maximum))
      return true
    }
    const start = markA()
    const minimum = start === null ? 0 : Math.min(duration, start + gap)
    setMarkB(clamp(snapped, minimum, duration))
    return true
  }

  const setStart = (position = options.positionBeats()): boolean => {
    const next = snapDrumLoopBeat(
      position,
      options.durationBeats(),
      markStepBeats(),
    )
    if (next === null) return false
    const end = markB()
    batch(() => {
      setMarkA(next)
      if (end !== null && end - next < minimumGapBeats()) setMarkB(null)
    })
    commitDraft()
    return true
  }

  const setEnd = (position = options.positionBeats()): boolean => {
    const next = snapDrumLoopBeat(
      position,
      options.durationBeats(),
      markStepBeats(),
    )
    if (next === null) return false
    const start = markA()
    batch(() => {
      setMarkB(next)
      if (start !== null && next - start < minimumGapBeats()) setMarkA(null)
    })
    commitDraft()
    return true
  }

  /** Adopt a coach/editor range, or clear marks and transport as one action. */
  const setSpan = (next: DrumLoopRange | null): boolean => {
    if (next === null) {
      restoreMarks(null, null)
      return options.currentLoop() === null ? true : options.setLoop(null)
    }
    const normalized = normalizeDrumLoopRange(
      next.startBeat,
      next.endBeat,
      options.durationBeats(),
      markStepBeats(),
      minimumGapBeats(),
    )
    if (normalized === null) return false
    const previousLoop = options.currentLoop()
    restoreMarks(normalized.startBeat, normalized.endBeat)
    if (options.setLoop(normalized)) return true
    restoreMarks(previousLoop?.startBeat ?? null, previousLoop?.endBeat ?? null)
    return false
  }

  const clear = (): void => {
    setSpan(null)
  }

  const beginScrub = (): void => {
    if (disposed || isScrubbing()) return
    const phase = options.phase()
    resumeAfterScrub = phase === 'playing' || phase === 'count-in'
    setIsScrubbing(true)
    if (resumeAfterScrub) options.pause()
  }

  const endScrub = (): void => {
    if (disposed || !isScrubbing()) return
    const shouldResume = resumeAfterScrub
    resumeAfterScrub = false
    setIsScrubbing(false)
    if (!shouldResume) return
    try {
      void Promise.resolve(options.resume()).catch(() => undefined)
    } catch {
      // The runtime reports activation failures; scrubbing must still settle.
    }
  }

  onCleanup(() => {
    disposed = true
    resumeAfterScrub = false
  })

  return {
    markA,
    markB,
    span,
    isPending,
    isActive,
    isScrubbing,
    markStepBeats,
    minimumGapBeats,
    setStart,
    setEnd,
    moveMark,
    moveMarkA: (beat: number) => moveMark('A', beat),
    moveMarkB: (beat: number) => moveMark('B', beat),
    commitMark: (_mark?: 'A' | 'B') => commitDraft(),
    setSpan,
    clear,
    seekSeconds: options.seekSeconds,
    beginScrub,
    endScrub,
    snapMarkValue: (beat: number) =>
      snapDrumLoopBeat(beat, options.durationBeats(), markStepBeats()) ?? 0,
  }
}

export type DrumNightLoopRangeController = ReturnType<
  typeof useDrumNightLoopRange
>
