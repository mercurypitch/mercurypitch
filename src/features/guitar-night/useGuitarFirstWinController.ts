// Guitar first-win controller joins configurable tab, count-in, fallback input, and local progress.
// ============================================================

import type { Accessor } from 'solid-js'
import { createMemo, createSignal, onCleanup } from 'solid-js'
import type { GuitarRoomBand } from '@/features/guitar/backing/guitar-room-band'
import { createGuitarRoomBand } from '@/features/guitar/backing/guitar-room-band'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import type { GuitarFirstWinConfigV1, GuitarFirstWinInputKind, } from './first-win-config'
import { completeGuitarFirstWinProgress, readGuitarFirstWinProgress, recordGuitarFirstWinAttempt, skipGuitarFirstWinProgress, writeGuitarFirstWinProgress, } from './first-win-progress'

export type GuitarFirstWinGrooveStatus =
  | 'quiet'
  | 'starting'
  | 'count-in'
  | 'playing'
  | 'complete'
  | 'error'

interface GuitarFirstWinControllerOptions {
  config: Accessor<GuitarFirstWinConfigV1>
  createBand?: () => GuitarRoomBand
  now?: () => number
}

function exerciseNotes(config: GuitarFirstWinConfigV1): GuitarNote[] {
  const step = config.exerciseSteps[0]
  if (step === undefined) return []
  const openMidi = config.tuningMidiHighToLow[step.stringIndex] ?? 40
  return step.frets.map((fret, index) => {
    const midi = openMidi + fret
    return {
      id: `${step.id}-${index}`,
      midi,
      noteName: step.stringLabel,
      stringIndex: step.stringIndex,
      fret,
      startBeat: index,
      duration: 0.72,
      targetFreq: 440 * Math.pow(2, (midi - 69) / 12),
    }
  })
}

export function useGuitarFirstWinController(
  options: GuitarFirstWinControllerOptions,
) {
  const initialConfig = options.config()
  const [hits, setHits] = createSignal(0)
  const [status, setStatus] = createSignal<GuitarFirstWinGrooveStatus>('quiet')
  const [playheadBeat, setPlayheadBeat] = createSignal(0)
  const [countInRemaining, setCountInRemaining] = createSignal(0)
  const [lastFeedback, setLastFeedback] = createSignal(
    'Tap the notes freely, or start the count-in for timing.',
  )
  const [tempoBpm, setTempoBpmSignal] = createSignal(initialConfig.tempoBpm)
  const [countInBeats, setCountInBeatsSignal] = createSignal(
    initialConfig.countInBeats,
  )
  const [progress, setProgress] = createSignal(
    readGuitarFirstWinProgress(initialConfig),
  )
  const now = options.now ?? (() => performance.now())
  const band = options.createBand?.() ?? createGuitarRoomBand()
  const notes = createMemo(() => exerciseNotes(options.config()))
  let expectedHitTimesMs: readonly number[] = []
  const consumedTargets = new Set<number>()
  let startGeneration = 0

  const persist = (next: ReturnType<typeof progress>): void => {
    setProgress(next)
    writeGuitarFirstWinProgress(next)
  }

  const finish = (): void => {
    band.stop()
    setStatus('complete')
    setCountInRemaining(0)
    setLastFeedback(
      `${options.config().freshHitsRequested} open notes. You read your first bar of tab.`,
    )
    persist(completeGuitarFirstWinProgress(progress()))
  }

  const registerHit = (inputKind: GuitarFirstWinInputKind): boolean => {
    const config = options.config()
    const step = config.exerciseSteps[0]
    if (step === undefined || hits() >= config.freshHitsRequested) return false

    let absoluteTimingMs: number | null = null
    if (status() === 'starting' || status() === 'count-in') {
      setLastFeedback('Hold the note until the count-in finishes.')
      return false
    }
    if (status() === 'playing' && expectedHitTimesMs.length > 0) {
      const currentTime = now()
      let targetIndex = -1
      let targetDistance = Number.POSITIVE_INFINITY
      expectedHitTimesMs.forEach((target, index) => {
        if (consumedTargets.has(index)) return
        const distance = Math.abs(currentTime - target)
        if (distance < targetDistance) {
          targetDistance = distance
          targetIndex = index
        }
      })
      if (targetIndex < 0 || targetDistance > config.timingToleranceMs) {
        setLastFeedback('Listen for the next pulse, then play once.')
        return false
      }
      consumedTargets.add(targetIndex)
      absoluteTimingMs = targetDistance
      setLastFeedback(
        targetDistance <= config.timingToleranceMs * 0.45
          ? 'Right on the pulse.'
          : 'That note landed. Keep the same motion.',
      )
    } else {
      setLastFeedback('Note marked. Press Space or tap again for the next one.')
    }

    const nextProgress = recordGuitarFirstWinAttempt(
      progress(),
      step.id,
      inputKind,
      absoluteTimingMs,
    )
    persist(nextProgress)
    const nextHits = Math.min(hits() + 1, config.freshHitsRequested)
    setHits(nextHits)
    if (nextHits >= config.freshHitsRequested) finish()
    return true
  }

  const startGroove = async (): Promise<boolean> => {
    const config = options.config()
    startGeneration += 1
    const generation = startGeneration
    band.stop()
    consumedTargets.clear()
    expectedHitTimesMs = []
    setHits(0)
    setPlayheadBeat(0)
    setCountInRemaining(countInBeats())
    setStatus('starting')
    setLastFeedback('Setting the room clock…')
    try {
      const result = await band.start({
        tempoBpm: tempoBpm(),
        countInBeats: countInBeats(),
        exerciseBeats: config.freshHitsRequested,
        onBeat: (beatIndex, phase) => {
          if (generation !== startGeneration) return
          if (phase === 'count-in') {
            setStatus('count-in')
            setCountInRemaining(Math.max(1, countInBeats() - beatIndex))
            setLastFeedback(
              `Count in · ${Math.max(1, countInBeats() - beatIndex)}`,
            )
            return
          }
          setStatus('playing')
          setCountInRemaining(0)
          setPlayheadBeat(beatIndex)
          setLastFeedback('Play the open low E with this pulse.')
        },
        onComplete: () => {
          if (generation !== startGeneration || status() === 'complete') return
          setStatus('quiet')
          setCountInRemaining(0)
          setLastFeedback('Groove finished. Start it again when you are ready.')
        },
      })
      if (generation !== startGeneration) return false
      expectedHitTimesMs = result.expectedHitTimesMs
      return true
    } catch {
      if (generation !== startGeneration) return false
      setStatus('error')
      setLastFeedback(
        'The count-in could not start. Touch and Space still work without audio.',
      )
      return false
    }
  }

  const stopGroove = (): void => {
    startGeneration += 1
    band.stop()
    expectedHitTimesMs = []
    consumedTargets.clear()
    setStatus('quiet')
    setCountInRemaining(0)
    setPlayheadBeat(0)
    setLastFeedback('Groove stopped. Your marked notes are still here.')
  }

  const setTempoBpm = (value: number): void => {
    setTempoBpmSignal(Math.min(160, Math.max(40, Math.round(value))))
  }

  const setCountInBeats = (value: number): void => {
    setCountInBeatsSignal(Math.min(8, Math.max(0, Math.round(value))))
  }

  const skip = (): void => {
    stopGroove()
    persist(skipGuitarFirstWinProgress(progress()))
  }

  onCleanup(() => {
    startGeneration += 1
    void band.dispose()
  })

  return {
    hits,
    status,
    notes,
    playheadBeat,
    countInRemaining,
    lastFeedback,
    tempoBpm,
    countInBeats,
    progress,
    registerHit,
    startGroove,
    stopGroove,
    setTempoBpm,
    setCountInBeats,
    skip,
  }
}
