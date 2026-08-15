// Guitar first-win controller joins configurable tab, count-in, fallback input, and local progress.
// ============================================================

import type { Accessor } from 'solid-js'
import { createMemo, createSignal, onCleanup } from 'solid-js'
import type { GuitarRoomBand } from '@/features/guitar/backing/guitar-room-band'
import { createGuitarRoomBand } from '@/features/guitar/backing/guitar-room-band'
import { nextGuitarRoomRhythmVariant, resolveGuitarRoomRhythmPreset, resolveGuitarRoomRhythmPresets, } from '@/features/guitar/backing/guitar-room-rhythm'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { GuitarFirstWinConfigV1, GuitarFirstWinExerciseStepV1, GuitarFirstWinInputKind, } from './first-win-config'
import { completeGuitarFirstWinStep, readGuitarFirstWinProgress, recordGuitarFirstWinAttempt, skipGuitarFirstWinProgress, writeGuitarFirstWinProgress, } from './first-win-progress'

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
  random?: () => number
}

interface GuitarFirstWinScheduledTarget {
  key: string
  iteration: number
  expectedAtMs: number
  consumed: boolean
}

function stepTargetCount(
  config: GuitarFirstWinConfigV1,
  step: GuitarFirstWinExerciseStepV1,
): number {
  return step.kind === 'open-string-groove'
    ? config.freshHitsRequested
    : step.frets.length
}

function stepFretAt(step: GuitarFirstWinExerciseStepV1, index: number): number {
  return step.frets[index % step.frets.length] ?? 0
}

/** Build the exact visible score for one configured beginner step. */
export function buildGuitarFirstWinNotes(
  config: GuitarFirstWinConfigV1,
  step: GuitarFirstWinExerciseStepV1,
): GuitarNote[] {
  const openMidi = config.tuningMidiHighToLow[step.stringIndex] ?? 40
  return Array.from({ length: stepTargetCount(config, step) }, (_, index) => {
    const fret = stepFretAt(step, index)
    const explicitMidi =
      step.expectedMidi === 'from-tuning-and-frets'
        ? undefined
        : step.expectedMidi[index % step.expectedMidi.length]
    const midi = explicitMidi ?? openMidi + fret
    return {
      id: `${step.id}-${index}`,
      midi,
      noteName: midiToNoteNameOctave(midi),
      stringIndex: step.stringIndex,
      fret,
      startBeat: index,
      duration: 0.72,
      targetFreq: 440 * Math.pow(2, (midi - 69) / 12),
    }
  })
}

function introFeedback(step: GuitarFirstWinExerciseStepV1): string {
  return step.kind === 'one-string-tab'
    ? 'Read left to right. Mark each fret with Space or the button.'
    : 'Mark the notes freely, or start the count-in for timing.'
}

function targetLabel(
  note: GuitarNote | undefined,
  stringLabel: string,
): string {
  if (note === undefined) return stringLabel
  return note.fret === 0
    ? `open ${stringLabel}`
    : `${stringLabel}, fret ${note.fret}`
}

export function useGuitarFirstWinController(
  options: GuitarFirstWinControllerOptions,
) {
  const initialConfig = options.config()
  const initialProgress = readGuitarFirstWinProgress(initialConfig)
  const [activeStepId, setActiveStepId] = createSignal(
    initialProgress.currentStepId ?? initialConfig.exerciseSteps[0]?.id ?? null,
  )
  const [hits, setHits] = createSignal(0)
  const [status, setStatus] = createSignal<GuitarFirstWinGrooveStatus>('quiet')
  const [playheadBeat, setPlayheadBeat] = createSignal(0)
  const [countInRemaining, setCountInRemaining] = createSignal(0)
  const initialStep =
    initialConfig.exerciseSteps.find(
      (step) => step.id === initialProgress.currentStepId,
    ) ?? initialConfig.exerciseSteps[0]
  const [lastFeedback, setLastFeedback] = createSignal(
    initialStep === undefined
      ? 'Choose a lesson to begin.'
      : introFeedback(initialStep),
  )
  const [tempoBpm, setTempoBpmSignal] = createSignal(initialConfig.tempoBpm)
  const [countInBeats, setCountInBeatsSignal] = createSignal(
    initialConfig.countInBeats,
  )
  const initialRhythmPreset = resolveGuitarRoomRhythmPreset(
    initialConfig.percussionPreset,
  )
  const [loopEnabled, setLoopEnabledSignal] = createSignal(false)
  const [shuffleBeats, setShuffleBeatsSignal] = createSignal(false)
  const [selectedRhythmPresetId, setSelectedRhythmPresetIdSignal] =
    createSignal(initialRhythmPreset.id)
  const [activeRhythmPresetId, setActiveRhythmPresetId] = createSignal(
    initialRhythmPreset.id,
  )
  const [loopIteration, setLoopIteration] = createSignal(0)
  const [progress, setProgress] = createSignal(initialProgress)
  const now = options.now ?? (() => performance.now())
  const random = options.random ?? Math.random
  const band = options.createBand?.() ?? createGuitarRoomBand()
  const currentStep = createMemo(() => {
    const config = options.config()
    return (
      config.exerciseSteps.find((step) => step.id === activeStepId()) ??
      config.exerciseSteps[0]
    )
  })
  const currentStepIndex = createMemo(() => {
    const step = currentStep()
    if (step === undefined) return 0
    return Math.max(
      0,
      options
        .config()
        .exerciseSteps.findIndex((candidate) => candidate.id === step.id),
    )
  })
  const stepCount = createMemo(() => options.config().exerciseSteps.length)
  const notes = createMemo(() => {
    const step = currentStep()
    return step === undefined
      ? []
      : buildGuitarFirstWinNotes(options.config(), step)
  })
  const targetHits = createMemo(() => notes().length)
  const passHits = createMemo(() => {
    const step = currentStep()
    if (step === undefined) return 0
    return step.kind === 'open-string-groove'
      ? Math.min(options.config().passHits, targetHits())
      : targetHits()
  })
  const stepAlreadyCompleted = createMemo(() => {
    const step = currentStep()
    return step !== undefined && progress().completedStepIds.includes(step.id)
  })
  const stepPassed = createMemo(
    () => stepAlreadyCompleted() || (passHits() > 0 && hits() >= passHits()),
  )
  const stepFinished = createMemo(
    () => targetHits() > 0 && hits() >= targetHits(),
  )
  const isFinalStep = createMemo(
    () => currentStepIndex() >= Math.max(0, stepCount() - 1),
  )
  const nextStep = createMemo(
    () => options.config().exerciseSteps[currentStepIndex() + 1],
  )
  const flowComplete = createMemo(
    () => progress().status === 'completed' && isFinalStep(),
  )
  const currentTarget = createMemo(() => {
    const exerciseNotes = notes()
    if (exerciseNotes.length === 0) return undefined
    return exerciseNotes[Math.min(hits(), exerciseNotes.length - 1)]
  })
  const currentChunkIndex = createMemo(() => {
    const step = currentStep()
    if (step === undefined || step.phraseChunks.length === 0) return 0
    if (step.kind === 'open-string-groove') {
      return Math.min(hits(), Math.max(0, targetHits() - 1))
    }
    const targetIndex = Math.min(hits(), Math.max(0, targetHits() - 1))
    let end = 0
    const index = step.phraseChunks.findIndex((chunk) => {
      end += chunk.frets.length
      return targetIndex < end
    })
    return index < 0 ? step.phraseChunks.length - 1 : index
  })
  const completedPhraseCount = createMemo(() => {
    const step = currentStep()
    if (step === undefined) return 0
    const currentHits = hits()
    let end = 0
    return step.phraseChunks.reduce((count, chunk) => {
      end += chunk.frets.length
      return currentHits >= end ? count + 1 : count
    }, 0)
  })
  const rhythmPresets = createMemo(() => {
    const config = options.config()
    const primaryPreset = resolveGuitarRoomRhythmPreset(config.percussionPreset)
    return resolveGuitarRoomRhythmPresets([
      primaryPreset.id,
      ...config.percussionVariantPresets,
    ])
  })
  const selectedRhythmPreset = createMemo(() =>
    resolveGuitarRoomRhythmPreset(selectedRhythmPresetId()),
  )
  const activeRhythmPreset = createMemo(() =>
    resolveGuitarRoomRhythmPreset(activeRhythmPresetId()),
  )
  let scheduledTargets: GuitarFirstWinScheduledTarget[] = []
  let startGeneration = 0
  let activeRunLoops = false

  const persist = (next: ReturnType<typeof progress>): void => {
    setProgress(next)
    writeGuitarFirstWinProgress(next)
  }

  const completeActiveStep = () => {
    const step = currentStep()
    if (step === undefined) return progress()
    const currentProgress = progress()
    if (currentProgress.completedStepIds.includes(step.id)) {
      return currentProgress
    }
    const next = completeGuitarFirstWinStep(
      currentProgress,
      options.config(),
      step.id,
    )
    persist(next)
    return next
  }

  const finish = (): void => {
    const step = currentStep()
    if (step === undefined) return
    completeActiveStep()
    if (activeRunLoops && status() === 'playing') {
      setLastFeedback(
        step.kind === 'one-string-tab'
          ? 'Phrase complete. The loop stays with you for another lap.'
          : `${targetHits()} targets marked. Keep playing; the loop stays on.`,
      )
      return
    }
    band.stop()
    activeRunLoops = false
    setStatus('complete')
    setCountInRemaining(0)
    setLastFeedback(
      step.kind === 'one-string-tab'
        ? 'You followed the full one-string phrase.'
        : `${targetHits()} open-string targets marked. The pulse is yours.`,
    )
  }

  const registerHit = (inputKind: GuitarFirstWinInputKind): boolean => {
    const config = options.config()
    const step = currentStep()
    const hitTarget = targetHits()
    if (step === undefined || hitTarget === 0) {
      return false
    }

    const currentHits = hits()
    const currentIteration = loopIteration()
    let absoluteTimingMs: number | null = null
    let timingFeedback: string | null = null
    let matchedIteration: number | null = null
    if (status() === 'starting' || status() === 'count-in') {
      setLastFeedback('Wait for the count-in to finish, then mark the note.')
      return false
    }
    if (status() === 'playing' && scheduledTargets.length > 0) {
      const currentTime = now()
      let target: GuitarFirstWinScheduledTarget | null = null
      let targetDistance = Number.POSITIVE_INFINITY
      for (const candidate of scheduledTargets) {
        if (
          candidate.consumed ||
          candidate.iteration < currentIteration ||
          candidate.iteration > currentIteration + (activeRunLoops ? 1 : 0)
        ) {
          continue
        }
        const distance = Math.abs(currentTime - candidate.expectedAtMs)
        if (distance < targetDistance) {
          targetDistance = distance
          target = candidate
        }
      }
      if (target === null || targetDistance > config.timingToleranceMs) {
        setLastFeedback('Listen for the next pulse, then mark once.')
        return false
      }
      if (target.iteration === currentIteration && currentHits >= hitTarget) {
        return false
      }
      target.consumed = true
      matchedIteration = target.iteration
      absoluteTimingMs = targetDistance
      timingFeedback =
        targetDistance <= config.timingToleranceMs * 0.45
          ? 'Marked on the pulse.'
          : 'Target marked. Keep the same motion.'
    } else if (currentHits >= hitTarget) {
      return false
    }

    persist(
      recordGuitarFirstWinAttempt(
        progress(),
        step.id,
        inputKind,
        absoluteTimingMs,
      ),
    )
    if (matchedIteration !== null && matchedIteration > currentIteration) {
      const carriedHits = Math.min(
        hitTarget,
        scheduledTargets.filter(
          (target) => target.iteration === matchedIteration && target.consumed,
        ).length,
      )
      setLastFeedback(`Next lap · ${carriedHits} of ${hitTarget} marked early.`)
      return true
    }

    const nextHits = Math.min(currentHits + 1, hitTarget)
    setHits(nextHits)
    if (nextHits >= passHits()) completeActiveStep()
    if (status() !== 'playing') {
      setPlayheadBeat(Math.min(nextHits, Math.max(0, notes().length - 1)))
    }
    if (nextHits >= hitTarget) {
      finish()
      return true
    }

    const nextTarget = notes()[nextHits]
    setLastFeedback(
      timingFeedback ??
        `Target marked. Next: ${targetLabel(nextTarget, step.stringLabel)}.`,
    )
    return true
  }

  const startGroove = async (): Promise<boolean> => {
    const step = currentStep()
    const exerciseNotes = notes()
    if (step === undefined || exerciseNotes.length === 0) return false

    startGeneration += 1
    const generation = startGeneration
    const activeStepAtStart = step.id
    band.stop()
    scheduledTargets = []
    activeRunLoops = loopEnabled()
    setHits(0)
    setPlayheadBeat(0)
    setCountInRemaining(countInBeats())
    setLoopIteration(0)
    setActiveRhythmPresetId(selectedRhythmPreset().id)
    setStatus('starting')
    setLastFeedback('Setting the room clock…')
    try {
      const result = await band.start({
        tempoBpm: tempoBpm(),
        countInBeats: countInBeats(),
        exerciseBeats: exerciseNotes.length,
        loop: activeRunLoops ? { start: 0, end: exerciseNotes.length } : null,
        feel: step.guide === 'percussion-only' ? 'groove' : 'click',
        exercisePulse: step.guide === 'percussion-only',
        inputTimingWindowMs: options.config().timingToleranceMs,
        rhythmPresetForIteration: (iteration, previousPreset) => {
          const selected = resolveGuitarRoomRhythmPreset(
            selectedRhythmPresetId(),
          )
          if (iteration === 0 || !shuffleBeats()) return selected
          return nextGuitarRoomRhythmVariant(
            rhythmPresets().map((preset) => preset.id),
            previousPreset?.id ?? selected.id,
            random,
          )
        },
        onRhythmPreset: (preset, iteration) => {
          if (
            generation !== startGeneration ||
            currentStep()?.id !== activeStepAtStart
          ) {
            return
          }
          setActiveRhythmPresetId(preset.id)
          setLoopIteration(iteration)
        },
        onLoopIteration: (iteration) => {
          if (
            iteration === 0 ||
            generation !== startGeneration ||
            currentStep()?.id !== activeStepAtStart
          ) {
            return
          }
          scheduledTargets = scheduledTargets.filter(
            (target) => target.iteration >= iteration,
          )
          const carriedHits = Math.min(
            targetHits(),
            scheduledTargets.filter(
              (target) => target.iteration === iteration && target.consumed,
            ).length,
          )
          setHits(carriedHits)
          setPlayheadBeat(0)
          setStatus('playing')
          setLoopIteration(iteration)
          if (carriedHits >= passHits()) completeActiveStep()
          if (carriedHits >= targetHits()) {
            finish()
            return
          }
          setLastFeedback(
            carriedHits > 0
              ? `Lap ${iteration + 1}. ${carriedHits} target${carriedHits === 1 ? '' : 's'} marked early.`
              : `Lap ${iteration + 1}. Settle back into the pulse.`,
          )
        },
        onExerciseBeatScheduled: (scheduledBeat) => {
          if (
            generation !== startGeneration ||
            currentStep()?.id !== activeStepAtStart
          ) {
            return
          }
          const key = `${scheduledBeat.iteration}:${scheduledBeat.beatIndex}`
          if (scheduledTargets.some((target) => target.key === key)) return
          scheduledTargets.push({
            key,
            iteration: scheduledBeat.iteration,
            expectedAtMs: scheduledBeat.expectedAtPerformanceMs,
            consumed: false,
          })
          if (scheduledTargets.length > 64) {
            scheduledTargets = scheduledTargets.slice(-64)
          }
        },
        onBeat: (beatIndex, phase) => {
          if (
            generation !== startGeneration ||
            currentStep()?.id !== activeStepAtStart
          ) {
            return
          }
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
          setLastFeedback(
            `Mark ${targetLabel(exerciseNotes[beatIndex], step.stringLabel)} with this pulse.`,
          )
        },
        onComplete: () => {
          if (
            generation !== startGeneration ||
            currentStep()?.id !== activeStepAtStart ||
            status() === 'complete'
          ) {
            return
          }
          setStatus('quiet')
          setCountInRemaining(0)
          setLastFeedback('Groove finished. Start it again when you are ready.')
        },
      })
      if (
        generation !== startGeneration ||
        currentStep()?.id !== activeStepAtStart
      ) {
        return false
      }
      if (scheduledTargets.length === 0) {
        scheduledTargets = result.expectedHitTimesMs.map(
          (expectedAtMs, index) => ({
            key: `0:${index}`,
            iteration: 0,
            expectedAtMs,
            consumed: false,
          }),
        )
      }
      return true
    } catch {
      if (generation !== startGeneration) return false
      activeRunLoops = false
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
    activeRunLoops = false
    scheduledTargets = []
    setStatus('quiet')
    setCountInRemaining(0)
    setPlayheadBeat(0)
    setLastFeedback('Groove stopped. Your marked targets are still here.')
  }

  const resetStepSignals = (step: GuitarFirstWinExerciseStepV1): void => {
    setHits(0)
    setPlayheadBeat(0)
    setCountInRemaining(0)
    setStatus('quiet')
    setLastFeedback(introFeedback(step))
  }

  const advanceStep = (): boolean => {
    const step = currentStep()
    if (step === undefined || !stepPassed()) return false
    const config = options.config()
    const currentProgress = progress()
    const stepAlreadyComplete = currentProgress.completedStepIds.includes(
      step.id,
    )
    const nextProgress = stepAlreadyComplete
      ? currentProgress
      : completeActiveStep()
    const nextStep = stepAlreadyComplete
      ? config.exerciseSteps[currentStepIndex() + 1]
      : config.exerciseSteps.find(
          (candidate) => candidate.id === nextProgress.currentStepId,
        )
    if (nextStep === undefined || nextStep.id === step.id) return false

    stopGroove()
    setActiveStepId(nextStep.id)
    resetStepSignals(nextStep)
    return true
  }

  const restartStep = (): void => {
    const step = currentStep()
    if (step === undefined) return
    stopGroove()
    resetStepSignals(step)
  }

  /** Replay keeps earned completion while returning the lesson to step one. */
  const replayFlow = (): void => {
    const firstStep = options.config().exerciseSteps[0]
    if (firstStep === undefined) return
    stopGroove()
    setActiveStepId(firstStep.id)
    resetStepSignals(firstStep)
  }

  const grooveRunning = (): boolean =>
    status() === 'starting' || status() === 'count-in' || status() === 'playing'

  const setTempoBpm = (value: number): void => {
    if (grooveRunning()) return
    setTempoBpmSignal(Math.min(160, Math.max(40, Math.round(value))))
  }

  const setCountInBeats = (value: number): void => {
    if (grooveRunning()) return
    setCountInBeatsSignal(Math.min(8, Math.max(0, Math.round(value))))
  }

  const setLoopEnabled = (enabled: boolean): boolean => {
    const wasRunning = grooveRunning()
    if (wasRunning && (enabled || !loopEnabled())) return false
    if (wasRunning) stopGroove()
    setLoopEnabledSignal(enabled)
    if (!enabled) setShuffleBeatsSignal(false)
    setLastFeedback(
      enabled
        ? 'Loop on. The next count-in will keep this practice moving.'
        : wasRunning
          ? 'Loop off. The groove stopped at your marked targets.'
          : 'Loop off. The next count-in will play once.',
    )
    return true
  }

  const setShuffleBeats = (enabled: boolean): void => {
    if (enabled && !loopEnabled()) setLoopEnabledSignal(true)
    setShuffleBeatsSignal(enabled)
    setLastFeedback(
      enabled
        ? 'Beat shuffle on. A different feel can arrive at each lap.'
        : 'Beat shuffle off. This feel will stay steady.',
    )
  }

  const setRhythmPresetId = (presetId: string): void => {
    const available = rhythmPresets().find((preset) => preset.id === presetId)
    if (available === undefined) return
    setSelectedRhythmPresetIdSignal(available.id)
    setShuffleBeatsSignal(false)
    if (!grooveRunning()) setActiveRhythmPresetId(available.id)
    setLastFeedback(
      grooveRunning()
        ? activeRunLoops
          ? `${available.label} is queued for an upcoming lap.`
          : `${available.label} is ready for the next count-in.`
        : `${available.label} beat ready for the next count-in.`,
    )
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
    currentStep,
    currentStepIndex,
    stepCount,
    notes,
    currentTarget,
    currentChunkIndex,
    completedPhraseCount,
    targetHits,
    passHits,
    stepPassed,
    stepFinished,
    isFinalStep,
    nextStep,
    flowComplete,
    playheadBeat,
    countInRemaining,
    lastFeedback,
    tempoBpm,
    countInBeats,
    loopEnabled,
    shuffleBeats,
    loopIteration,
    rhythmPresets,
    selectedRhythmPreset,
    activeRhythmPreset,
    progress,
    registerHit,
    startGroove,
    stopGroove,
    advanceStep,
    restartStep,
    replayFlow,
    setTempoBpm,
    setCountInBeats,
    setLoopEnabled,
    setShuffleBeats,
    setRhythmPresetId,
    skip,
  }
}
