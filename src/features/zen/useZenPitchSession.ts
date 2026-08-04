import type { Accessor } from 'solid-js'
import { createSignal, onCleanup, onMount } from 'solid-js'
import type { PracticeFrame } from '@/features/practice/usePracticeController'
import { SIGNAL_FLOOR_RMS } from '@/lib/input-health'
import { readMicLevel } from '@/lib/mic-level'
import { freqToMidiFloat } from '@/lib/pitch-pipeline/log-pitch'
import { getZenExercise } from './exercise-catalog'
import type { ResolvedZenTarget, ZenExerciseDefinition, ZenPitchPoint, ZenPitchRun, ZenProgressCue, ZenSessionStatus, ZenTargetVisibility, ZenViewport, } from './types'
import { DEFAULT_ZEN_LOOP_SECONDS, exerciseLoopDuration, fitZenViewport, pitchTargetMidis, resolveZenTargets, scoreZenRun, targetKind, } from './zen-model'

const MAX_SESSION_RUNS = 10
const MIN_SAMPLE_INTERVAL_MS = 1000 / 30
const MIN_VOICED_POINTS = 3

export interface UseZenPitchSessionOptions {
  initialExerciseId?: string
  initialExerciseVersion?: number
  /**
   * Load this definition directly instead of resolving initialExerciseId
   * from the catalog. Synthetic exercises (the weekly challenge stage builds
   * one from a challenge's melody) are never in the catalog, so id lookup
   * cannot find them. Takes precedence over initialExerciseId.
   */
  initialExerciseDefinition?: ZenExerciseDefinition
  /**
   * Definitions this session can switch between that the catalogue does not
   * hold. `initialExerciseDefinition` covers one synthetic exercise; a guided
   * warm-up is a *sequence* of them, so `selectExercise` has to be able to
   * resolve every step, not just the one it opened on.
   */
  exerciseDefinitions?: readonly ZenExerciseDefinition[]
  initialCenterMidi?: number
  subscribeFrames: (listener: (frame: PracticeFrame) => void) => () => void
  micActive: Accessor<boolean>
  startMic: () => Promise<boolean>
  stopMic: () => void
  onRunFinalized?: (run: ZenPitchRun) => void
  /**
   * Stop after this many loops instead of running until told to stop.
   *
   * The Zen stage was built for open-ended practice: start it and it loops
   * until the singer finishes. A guided warm-up is the opposite shape — one
   * authored exercise per step, run a fixed number of times, then control
   * back to whatever is sequencing the steps. That is the whole difference,
   * and this is it. Undefined keeps the endless loop.
   */
  loopLimit?: number
  /**
   * The loop limit was reached and the session stopped itself.
   *
   * Fired after the last run is finalized, so `runs()` already contains it.
   * Not fired when the singer stops early — `finish()` is their decision and
   * the caller already knows they made it.
   */
  onLoopLimitReached?: () => void
}

export interface ZenPitchSession {
  exerciseId: Accessor<string | null>
  exercise: Accessor<ZenExerciseDefinition | null>
  rootMidi: Accessor<number>
  targets: Accessor<ResolvedZenTarget[]>
  targetVisibility: Accessor<ZenTargetVisibility>
  progressCue: Accessor<ZenProgressCue>
  loopDurationSec: Accessor<number>
  status: Accessor<ZenSessionStatus>
  elapsedSec: Accessor<number>
  viewport: Accessor<ZenViewport>
  activePoints: Accessor<ZenPitchPoint[]>
  runs: Accessor<ZenPitchRun[]>
  selectedRunId: Accessor<string | null>
  selectedRun: Accessor<ZenPitchRun | null>
  takeNumber: Accessor<number>
  acquiredMic: Accessor<boolean>
  /** Loops finished since the current `start()`. Resets on every start. */
  loopsCompleted: Accessor<number>
  selectExercise: (exerciseId: string | null) => void
  setRootMidi: (midi: number) => void
  setTargetVisibility: (visibility: ZenTargetVisibility) => void
  setProgressCue: (cue: ZenProgressCue) => void
  setLoopDurationSec: (seconds: number) => void
  start: () => Promise<boolean>
  pause: () => void
  resume: () => void
  finish: () => void
  previousRun: () => void
  nextRun: () => void
  /** Delete a finished take from this session's strip. Returns true when
   *  the id was present. Persistence is the caller's job (the session
   *  doesn't know whether a run was ever saved). */
  removeRun: (runId: string) => boolean
  followLive: () => void
  hydrateRuns: (history: readonly ZenPitchRun[]) => void
}

const nowMs = (): number =>
  typeof performance === 'undefined' ? Date.now() : performance.now()

const createRunId = (): string => {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID()
  }
  return `zen-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function centredViewport(centreMidi: number): ZenViewport {
  const minMidi = Math.max(0, Math.min(103, Math.round(centreMidi) - 12))
  return { minMidi, maxMidi: minMidi + 24 }
}

function percentileRange(points: readonly ZenPitchPoint[]): number[] {
  const values = points
    .flatMap((point) => (point.midi === null ? [] : [point.midi]))
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
  if (values.length < 8) return values
  const lowIndex = Math.floor((values.length - 1) * 0.05)
  const highIndex = Math.ceil((values.length - 1) * 0.95)
  return values.slice(lowIndex, highIndex + 1)
}

export function useZenPitchSession(
  options: UseZenPitchSessionOptions,
): ZenPitchSession {
  const launchedExercise = options.initialExerciseDefinition
  const suppliedById = new Map(
    (options.exerciseDefinitions ?? []).map((exercise) => [
      exercise.id,
      exercise,
    ]),
  )
  const resolveExercise = (
    exerciseId: string | null | undefined,
  ): ZenExerciseDefinition | null => {
    if (launchedExercise !== undefined && exerciseId === launchedExercise.id) {
      return launchedExercise
    }
    if (exerciseId !== null && exerciseId !== undefined) {
      const supplied = suppliedById.get(exerciseId)
      if (supplied !== undefined) return supplied
    }
    return getZenExercise(exerciseId)
  }
  const initialExercise =
    launchedExercise ??
    resolveExercise(options.initialExerciseId) ??
    getZenExercise(options.initialExerciseId, options.initialExerciseVersion)
  const initialRoot = initialExercise?.defaultRootMidi ?? 60
  const initialTargets =
    initialExercise === null
      ? []
      : resolveZenTargets(initialExercise, initialRoot)
  const initialViewport =
    initialTargets.length === 0
      ? centredViewport(options.initialCenterMidi ?? 60)
      : fitZenViewport(pitchTargetMidis(initialTargets))

  const [exerciseId, setExerciseId] = createSignal<string | null>(
    initialExercise?.id ?? null,
  )
  const [exercise, setExercise] = createSignal<ZenExerciseDefinition | null>(
    initialExercise,
  )
  const [rootMidi, setRootMidiSignal] = createSignal(initialRoot)
  const [targets, setTargets] =
    createSignal<ResolvedZenTarget[]>(initialTargets)
  const [targetVisibility, setTargetVisibilitySignal] =
    createSignal<ZenTargetVisibility>(
      initialExercise?.defaultTargetVisibility ?? 'off',
    )
  const [progressCue, setProgressCueSignal] = createSignal<ZenProgressCue>(
    initialExercise?.defaultProgressCue ?? 'none',
  )
  const [loopDurationSec, setLoopDurationSecSignal] = createSignal(
    initialExercise === null
      ? DEFAULT_ZEN_LOOP_SECONDS
      : exerciseLoopDuration(initialExercise),
  )
  const [status, setStatus] = createSignal<ZenSessionStatus>('idle')
  const [elapsedSec, setElapsedSec] = createSignal(0)
  const [viewport, setViewport] = createSignal(initialViewport)
  const [activePoints, setActivePoints] = createSignal<ZenPitchPoint[]>([])
  const [runs, setRuns] = createSignal<ZenPitchRun[]>([])
  const [selectedRunId, setSelectedRunId] = createSignal<string | null>(null)
  const [takeNumber, setTakeNumber] = createSignal(1)
  const [acquiredMic, setAcquiredMic] = createSignal(false)
  const [loopsCompleted, setLoopsCompleted] = createSignal(0)

  // Plain mirrors are intentional. Pitch frames arrive from the app's
  // requestAnimationFrame callback; reading Solid memos there creates work
  // outside the component owner and can trigger Solid's root warning.
  let liveStatus: ZenSessionStatus = 'idle'
  let liveExercise = initialExercise
  let liveExerciseId = initialExercise?.id ?? null
  let liveRoot = initialRoot
  let liveTargets = initialTargets
  // Whether this exercise has anything to score from loudness. Gates level
  // capture: a number per sample on every take would grow every stored run
  // for the benefit of the handful of exercises that read it.
  let liveTracksLevel = initialTargets.some(
    (target) => targetKind(target) === 'amplitude',
  )
  let liveViewport = initialViewport
  let liveLoopDuration =
    initialExercise === null
      ? DEFAULT_ZEN_LOOP_SECONDS
      : exerciseLoopDuration(initialExercise)
  let livePoints: ZenPitchPoint[] = []
  let loopStartedAtMs = 0
  let pausedAtMs = 0
  let hiddenAtMs: number | null = null
  let lastSampleAtMs = Number.NEGATIVE_INFINITY
  let nextTakeNumber = 1
  let liveLoopsCompleted = 0
  let startRequest = 0
  let startPromise: Promise<boolean> | null = null
  let ownsMic = false
  let unsubscribeFrames: (() => void) | null = null

  const selectedRun = (): ZenPitchRun | null => {
    const id = selectedRunId()
    if (id === null) return null
    return runs().find((run) => run.id === id) ?? null
  }

  const updateViewportAfterRun = (points: readonly ZenPitchPoint[]): void => {
    const values = [
      ...pitchTargetMidis(liveTargets),
      ...percentileRange(points),
    ]
    const next = fitZenViewport(values, liveViewport)
    liveViewport = next
    setViewport(next)
  }

  const finalize = (durationSec: number): ZenPitchRun | null => {
    const voicedCount = livePoints.reduce(
      (count, point) => count + (point.midi === null ? 0 : 1),
      0,
    )
    const completedPoints = livePoints
    livePoints = []
    setActivePoints([])
    setElapsedSec(0)
    lastSampleAtMs = Number.NEGATIVE_INFINITY

    if (voicedCount < MIN_VOICED_POINTS) return null

    const run: ZenPitchRun = {
      id: createRunId(),
      takeNumber: nextTakeNumber,
      completedAt: Date.now(),
      mode: liveExercise === null ? 'monitor' : 'exercise',
      exerciseId: liveExerciseId ?? undefined,
      exerciseVersion: liveExercise?.version,
      rootMidi: liveExercise === null ? undefined : liveRoot,
      durationSec,
      points: completedPoints,
      viewport: liveViewport,
      score:
        liveExercise === null
          ? undefined
          : scoreZenRun(completedPoints, liveTargets, liveExercise.scoring),
    }

    nextTakeNumber += 1
    setTakeNumber(nextTakeNumber)
    setRuns((previous) => [...previous, run].slice(-MAX_SESSION_RUNS))
    updateViewportAfterRun(completedPoints)
    try {
      options.onRunFinalized?.(run)
    } catch (error) {
      console.error('[zen] could not persist completed take:', error)
    }
    return run
  }

  const consumeFrame = (frame: PracticeFrame): void => {
    if (
      liveStatus !== 'running' ||
      hiddenAtMs !== null ||
      frame.atMs - lastSampleAtMs < MIN_SAMPLE_INTERVAL_MS
    ) {
      return
    }

    let elapsed = (frame.atMs - loopStartedAtMs) / 1000
    if (elapsed >= liveLoopDuration) {
      finalize(liveLoopDuration)
      liveLoopsCompleted += 1
      setLoopsCompleted(liveLoopsCompleted)

      // A bounded session stops itself here rather than starting a loop the
      // caller did not ask for. The mic is deliberately left alone: whoever
      // is sequencing the steps owns it across the boundary, and closing it
      // between two steps of one warm-up is the reopen cost §1(a) removed.
      if (
        options.loopLimit !== undefined &&
        liveLoopsCompleted >= options.loopLimit
      ) {
        liveStatus = 'idle'
        setStatus('idle')
        try {
          options.onLoopLimitReached?.()
        } catch (error) {
          console.error('[zen] loop-limit handler threw:', error)
        }
        return
      }

      // Do not manufacture a stack of empty runs after background throttling.
      loopStartedAtMs =
        elapsed < liveLoopDuration + 1
          ? loopStartedAtMs + liveLoopDuration * 1000
          : frame.atMs
      elapsed = Math.max(0, (frame.atMs - loopStartedAtMs) / 1000)
    }

    lastSampleAtMs = frame.atMs
    const detected =
      frame.micActive &&
      frame.pitch !== null &&
      frame.pitch.frequency > 0 &&
      frame.pitch.clarity >= 0.2
    const level = liveTracksLevel ? readMicLevel(frame.atMs) : undefined
    const point: ZenPitchPoint = detected
      ? {
          timeSec: elapsed,
          midi: freqToMidiFloat(frame.pitch!.frequency),
          clarity: frame.pitch!.clarity,
          ...(level === undefined ? {} : { level }),
        }
      : {
          timeSec: elapsed,
          midi: null,
          ...(level === undefined ? {} : { level }),
        }

    // One gap marker per silence, not one per frame. But a hiss IS unpitched
    // and audible, so on an exercise that scores loudness "no pitch" is not
    // the same as "nothing there" — collapsing those would throw away the
    // only evidence the step produces.
    const isSilent = (candidate: ZenPitchPoint): boolean =>
      candidate.midi === null &&
      (!liveTracksLevel || (candidate.level ?? 0) < SIGNAL_FLOOR_RMS)
    const previous = livePoints[livePoints.length - 1]
    if (isSilent(point) && (previous === undefined || isSilent(previous))) {
      setElapsedSec(elapsed)
      return
    }

    livePoints = [...livePoints, point]
    setActivePoints(livePoints)
    setElapsedSec(elapsed)
  }

  const selectExercise = (nextId: string | null): void => {
    const nextExercise = resolveExercise(nextId)
    const nextRoot = nextExercise?.defaultRootMidi ?? 60
    const nextTargets =
      nextExercise === null ? [] : resolveZenTargets(nextExercise, nextRoot)
    const nextViewport =
      nextTargets.length === 0
        ? centredViewport(options.initialCenterMidi ?? 60)
        : fitZenViewport(pitchTargetMidis(nextTargets))

    liveExercise = nextExercise
    liveExerciseId = nextExercise?.id ?? null
    liveRoot = nextRoot
    liveTargets = nextTargets
    liveTracksLevel = nextTargets.some(
      (target) => targetKind(target) === 'amplitude',
    )
    liveViewport = nextViewport
    liveLoopDuration =
      nextExercise === null
        ? DEFAULT_ZEN_LOOP_SECONDS
        : exerciseLoopDuration(nextExercise)
    livePoints = []
    nextTakeNumber = 1
    liveLoopsCompleted = 0
    loopStartedAtMs = nowMs()
    lastSampleAtMs = Number.NEGATIVE_INFINITY

    setExerciseId(liveExerciseId)
    setExercise(nextExercise)
    setRootMidiSignal(nextRoot)
    setTargets(nextTargets)
    setViewport(nextViewport)
    setLoopDurationSecSignal(liveLoopDuration)
    setTargetVisibilitySignal(nextExercise?.defaultTargetVisibility ?? 'off')
    setProgressCueSignal(nextExercise?.defaultProgressCue ?? 'none')
    setElapsedSec(0)
    setActivePoints([])
    setRuns([])
    setSelectedRunId(null)
    setTakeNumber(1)
  }

  const setRootMidi = (midi: number): void => {
    const nextRoot = Math.max(24, Math.min(96, Math.round(midi)))
    const nextTargets =
      liveExercise === null ? [] : resolveZenTargets(liveExercise, nextRoot)
    const nextViewport =
      nextTargets.length === 0
        ? liveViewport
        : fitZenViewport(pitchTargetMidis(nextTargets))
    liveRoot = nextRoot
    liveTargets = nextTargets
    liveViewport = nextViewport
    setRootMidiSignal(nextRoot)
    setTargets(nextTargets)
    setViewport(nextViewport)
  }

  const setTargetVisibility = (visibility: ZenTargetVisibility): void => {
    setTargetVisibilitySignal(visibility)
  }

  const setProgressCue = (cue: ZenProgressCue): void => {
    setProgressCueSignal(cue)
  }

  const setLoopDurationSec = (seconds: number): void => {
    if (liveExercise !== null) return
    liveLoopDuration = Math.max(5, Math.min(30, Math.round(seconds)))
    setLoopDurationSecSignal(liveLoopDuration)
    livePoints = []
    setActivePoints([])
    setElapsedSec(0)
    loopStartedAtMs = nowMs()
  }

  const start = (): Promise<boolean> => {
    if (startPromise !== null) return startPromise

    const request = ++startRequest
    const pending = (async (): Promise<boolean> => {
      const micWasActive = options.micActive()
      let acquiredForRequest = false
      if (!micWasActive) {
        const started = await options.startMic().catch(() => false)
        if (!started) return false
        ownsMic = true
        acquiredForRequest = true
        setAcquiredMic(true)
      }

      // Permission prompts can resolve after the stage has closed. Release a
      // mic acquired by this request instead of leaving it running invisibly.
      if (request !== startRequest) {
        if (acquiredForRequest && ownsMic) {
          options.stopMic()
          ownsMic = false
          setAcquiredMic(false)
        }
        return false
      }

      livePoints = []
      setActivePoints([])
      setSelectedRunId(null)
      setElapsedSec(0)
      liveLoopsCompleted = 0
      setLoopsCompleted(0)
      loopStartedAtMs = nowMs()
      pausedAtMs = 0
      lastSampleAtMs = Number.NEGATIVE_INFINITY
      liveStatus = 'running'
      setStatus('running')
      return true
    })()
    startPromise = pending
    void pending.then(() => {
      if (startPromise === pending) startPromise = null
    })
    return pending
  }

  const pause = (): void => {
    if (liveStatus !== 'running') return
    pausedAtMs = nowMs()
    liveStatus = 'paused'
    setStatus('paused')
  }

  const resume = (): void => {
    if (liveStatus !== 'paused') return
    const resumedAt = nowMs()
    loopStartedAtMs += Math.max(0, resumedAt - pausedAtMs)
    pausedAtMs = 0
    liveStatus = 'running'
    setStatus('running')
  }

  const finish = (): void => {
    ++startRequest
    if (liveStatus === 'idle') return
    const finishedAt = nowMs()
    const activeUntil = liveStatus === 'paused' ? pausedAtMs : finishedAt
    const duration = Math.max(
      0,
      Math.min(liveLoopDuration, (activeUntil - loopStartedAtMs) / 1000),
    )
    finalize(duration)
    liveStatus = 'idle'
    setStatus('idle')
  }

  const previousRun = (): void => {
    const history = runs()
    if (history.length === 0) return
    const currentId = selectedRunId()
    if (currentId === null) {
      setSelectedRunId(history[history.length - 1]!.id)
      return
    }
    const index = history.findIndex((run) => run.id === currentId)
    if (index > 0) setSelectedRunId(history[index - 1]!.id)
  }

  const nextRun = (): void => {
    const history = runs()
    const currentId = selectedRunId()
    if (currentId === null) return
    const index = history.findIndex((run) => run.id === currentId)
    if (index < 0 || index >= history.length - 1) {
      setSelectedRunId(null)
      return
    }
    setSelectedRunId(history[index + 1]!.id)
  }

  const followLive = (): void => {
    setSelectedRunId(null)
  }

  const removeRun = (runId: string): boolean => {
    const history = runs()
    const index = history.findIndex((run) => run.id === runId)
    if (index < 0) return false
    // Selection moves to the neighbour so review flow keeps its place;
    // deleting the last one drops back to live.
    if (selectedRunId() === runId) {
      const neighbour = history[index + 1] ?? history[index - 1]
      setSelectedRunId(neighbour?.id ?? null)
    }
    setRuns((previous) => previous.filter((run) => run.id !== runId))
    return true
  }

  const hydrateRuns = (history: readonly ZenPitchRun[]): void => {
    if (liveStatus !== 'idle') return
    const relevant = history
      .filter((run) =>
        liveExerciseId === null
          ? run.mode === 'monitor'
          : run.mode === 'exercise' &&
            run.exerciseId === liveExerciseId &&
            (run.exerciseVersion === undefined ||
              run.exerciseVersion === liveExercise?.version),
      )
      .sort((left, right) => left.completedAt - right.completedAt)
      .slice(-MAX_SESSION_RUNS)
    nextTakeNumber =
      relevant.reduce((highest, run) => Math.max(highest, run.takeNumber), 0) +
      1
    setRuns(relevant)
    setTakeNumber(nextTakeNumber)
    setSelectedRunId(null)
  }

  const onVisibilityChange = (): void => {
    const changedAt = nowMs()
    if (document.hidden) {
      if (hiddenAtMs === null && liveStatus === 'running') {
        hiddenAtMs = changedAt
      }
      return
    }
    if (hiddenAtMs !== null) {
      loopStartedAtMs += Math.max(0, changedAt - hiddenAtMs)
      hiddenAtMs = null
    }
  }

  onMount(() => {
    unsubscribeFrames = options.subscribeFrames(consumeFrame)
    document.addEventListener('visibilitychange', onVisibilityChange)
  })

  onCleanup(() => {
    ++startRequest
    unsubscribeFrames?.()
    unsubscribeFrames = null
    document.removeEventListener('visibilitychange', onVisibilityChange)
    if (ownsMic) {
      options.stopMic()
      ownsMic = false
    }
  })

  return {
    exerciseId,
    exercise,
    rootMidi,
    targets,
    targetVisibility,
    progressCue,
    loopDurationSec,
    status,
    elapsedSec,
    viewport,
    activePoints,
    runs,
    selectedRunId,
    selectedRun,
    takeNumber,
    acquiredMic,
    loopsCompleted,
    selectExercise,
    setRootMidi,
    setTargetVisibility,
    setProgressCue,
    setLoopDurationSec,
    start,
    pause,
    resume,
    finish,
    previousRun,
    nextRun,
    removeRun,
    followLive,
    hydrateRuns,
  }
}
