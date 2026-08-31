// Guitar Night live score binds one exact score-room run to local input evidence.
// ============================================================
//
// This controller is deliberately independent from Jam Doctor. It owns the
// small score latch shown during ordinary rehearsal, while phrase diagnosis,
// history, and recovery remain an explicit Review action.

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal } from 'solid-js'
import type { GuitarInputProfileKind } from '@/lib/guitar/guitar-input-profile'
import type { GuitarLiveScoreDisplay, GuitarLiveScoreEngine, GuitarLiveScoreGrade, } from '@/lib/guitar/guitar-live-score'
import { createGuitarLiveScoreEngine } from '@/lib/guitar/guitar-live-score'
import type { GuitarScoreDebugModel } from '@/lib/guitar/guitar-score-debug'
import { buildGuitarScoreDebugModel } from '@/lib/guitar/guitar-score-debug'
import type { GuitarTakeEvent, GuitarTakeSnapshot, } from '@/lib/guitar/guitar-take-recorder'
import type { GuitarInputHealthReading } from '@/lib/guitar/input-events'
import type { LoopSpan } from '@/lib/guitar/loop-span'
import { guitarScoreEngineTuning } from './guitar-score-tuning'
import type { GuitarListeningStatus } from './useGuitarListeningController'
import type { GuitarNightScoreLiveBoundary, GuitarNightScoreRoomStatus, } from './useGuitarNightScoreRoomController'

export type GuitarNightLiveScoreState =
  | 'needs-input'
  | 'ready'
  | 'count-in'
  | 'warming'
  | 'active'
  | 'paused'
  | 'complete'
  | 'unavailable'

interface GuitarNightLiveScoreControllerOptions {
  listeningStatus: Accessor<GuitarListeningStatus>
  inputKind: Accessor<GuitarInputProfileKind>
  take: Accessor<GuitarTakeSnapshot | null>
  health: Accessor<GuitarInputHealthReading | null>
  roomStatus: Accessor<GuitarNightScoreRoomStatus>
  countInRemaining: Accessor<number>
  playheadBeat: Accessor<number | null>
  startRoom(range: LoopSpan): Promise<GuitarNightScoreLiveBoundary | null>
  stopRoom(): void
  pauseRoom(): void
  stopInput(): void
  armTakeAt(startedAtSeconds: number): boolean
  completeTakeAt(endedAtSeconds: number): boolean
  completeTakeNow(): boolean
}

function compactBeat(beat: number | null): string {
  if (beat === null || !Number.isFinite(beat)) return 'the playhead'
  const counted = Math.max(0, beat) + 1
  return `beat ${Number.isInteger(counted) ? counted : counted.toFixed(1)}`
}

function retainedHealth(
  take: GuitarTakeSnapshot,
  live: GuitarInputHealthReading | null,
): GuitarInputHealthReading | null {
  const observed = take.inputHealth
  // Prevalence, not presence. These counters accumulate for the whole take, so
  // testing `> 0` made one transient peak — trivially reached with AGC off —
  // skip every remaining target for the rest of the run. `noisy` and
  // `uncertain` already used a ratio and recovered on their own; `clipping`
  // never did, which is why a take could stop scoring halfway through and
  // report "this input could not prove these notes".
  if (
    observed.states.clipping >= 3 &&
    observed.states.clipping / Math.max(1, observed.readings) >= 0.2
  ) {
    return { state: 'clipping', hint: 'The input clipped during this take.' }
  }
  if (
    observed.states.noisy >= 3 &&
    observed.states.noisy / Math.max(1, observed.readings) >= 0.2
  ) {
    return { state: 'noisy', hint: 'The room competed with the guitar.' }
  }
  if (
    observed.states.uncertain >= 3 &&
    observed.states.uncertain / Math.max(1, observed.readings) >= 0.2
  ) {
    return { state: 'uncertain', hint: 'Pitch was often unclear.' }
  }
  return live
}

function unavailableDetail(display: GuitarLiveScoreDisplay): string {
  if (display.evidenceStatus === 'event-gap') {
    return 'Some input evidence left the live window'
  }
  if (display.totals.skippedTargets > 0) {
    return 'This input could not prove these notes'
  }
  return 'Not enough notes to grade'
}

const GRADE_FLOORS: Readonly<Record<GuitarLiveScoreGrade, number>> = {
  S: 95,
  A: 85,
  B: 70,
  C: 50,
  D: 0,
}
const GRADE_ORDER: readonly GuitarLiveScoreGrade[] = ['S', 'A', 'B', 'C', 'D']
const GRADE_HYSTERESIS_POINTS = 2

/** Keep a rolling score near one threshold from chattering between letters. */
export function liveGradeWithHysteresis(
  score: number,
  rawGrade: GuitarLiveScoreGrade,
  previous: GuitarLiveScoreGrade | null,
): GuitarLiveScoreGrade {
  if (previous === null || previous === rawGrade) return rawGrade
  const rawRank = GRADE_ORDER.indexOf(rawGrade)
  const previousRank = GRADE_ORDER.indexOf(previous)
  if (rawRank < previousRank) {
    return score >= GRADE_FLOORS[rawGrade] + GRADE_HYSTERESIS_POINTS
      ? rawGrade
      : previous
  }
  return score < GRADE_FLOORS[previous] - GRADE_HYSTERESIS_POINTS
    ? rawGrade
    : previous
}

export function useGuitarNightLiveScoreController(
  options: GuitarNightLiveScoreControllerOptions,
) {
  const [boundary, setBoundary] =
    createSignal<GuitarNightScoreLiveBoundary | null>(null)
  const [display, setDisplay] = createSignal<GuitarLiveScoreDisplay | null>(
    null,
  )
  const [starting, setStarting] = createSignal(false)
  const [holdReason, setHoldReason] = createSignal<
    'paused' | 'input-lost' | null
  >(null)
  const [announcement, setAnnouncement] = createSignal('')
  const [presentedGrade, setPresentedGrade] =
    createSignal<GuitarLiveScoreGrade | null>(null)
  const [startedAt, setStartedAt] = createSignal<number | null>(null)
  const [scoringInputKind, setScoringInputKind] =
    createSignal<GuitarInputProfileKind | null>(null)
  const [finishing, setFinishing] = createSignal(false)
  // Development only. The engine keeps no judgment log unless asked, so this
  // stays null — and costs nothing — in a production build.
  const [debugModel, setDebugModel] =
    createSignal<GuitarScoreDebugModel | null>(null)
  // The recorder's page is bounded and, on a dense passage, fills with
  // pitch-change frames — so reading the current page alone shows a keyhole
  // rather than the take. Keep every event the overlay has ever seen.
  const observedDebugEvents = new Map<string, GuitarTakeEvent>()
  let engine: GuitarLiveScoreEngine | null = null
  let takeId: string | null = null
  let finishingTakeId: string | null = null
  let generation = 0
  let lastSampledFrame = 0

  const transportFrame = createMemo(() => {
    const run = boundary()
    const beat = options.playheadBeat()
    if (run === null || beat === null) return 0
    const startSeconds = run.beatToSeconds(run.range.start)
    const currentSeconds = run.beatToSeconds(
      Math.min(run.range.end, Math.max(run.range.start, beat)),
    )
    return Math.max(
      0,
      Math.round((currentSeconds - startSeconds) * run.sampleRate),
    )
  })

  // Sampling at roughly 30 Hz is responsive enough for a note latch without
  // turning the stage's animation clock into a second scoring clock.
  const sampledTransportFrame = createMemo(() => {
    const run = boundary()
    if (run === null) return 0
    const quantum = Math.max(1, Math.round(run.sampleRate / 30))
    return Math.floor(transportFrame() / quantum) * quantum
  })

  /**
   * Least time between overlay rebuilds while a take is running.
   *
   * The rebuild copies the judgment log, re-sorts every event seen so far and
   * rebuilds a row per target. Driving that from the sample effect ran it on
   * every animation frame -- work nobody can read at 60 Hz, and enough of it
   * on a dense score to miss frames, which is what demotes the device tier for
   * the rest of the session. The settled result is never throttled.
   */
  const DEBUG_MODEL_MIN_INTERVAL_MS = 100
  let lastDebugModelAtMs = 0

  const refreshDebugModel = (
    currentEngine: GuitarLiveScoreEngine,
    currentTake: GuitarTakeSnapshot,
    immediate = false,
  ): void => {
    if (!import.meta.env.DEV) return
    const nowMs = performance.now()
    if (
      !immediate &&
      nowMs - lastDebugModelAtMs < DEBUG_MODEL_MIN_INTERVAL_MS
    ) {
      return
    }
    lastDebugModelAtMs = nowMs
    const snapshot = currentEngine.debugSnapshot()
    if (snapshot === null) {
      setDebugModel(null)
      return
    }
    for (const event of currentTake.events) {
      observedDebugEvents.set(event.id, event)
    }
    const observed = [...observedDebugEvents.values()].sort(
      (left, right) =>
        left.compensatedTransportFrame - right.compensatedTransportFrame,
    )
    setDebugModel(buildGuitarScoreDebugModel(snapshot, currentTake, observed))
  }

  /**
   * `immediate` bypasses the overlay's rebuild throttle. The throttle exists
   * for the per-frame effect; every deliberate settling point -- pause, stop,
   * completion -- must publish the state it actually ended on rather than one
   * up to a rebuild interval old.
   */
  const sampleCurrentTake = (immediate = false): void => {
    const currentEngine = engine
    const currentTake = options.take()
    const run = boundary()
    const sampledFrame = sampledTransportFrame()
    if (
      currentEngine === null ||
      currentTake === null ||
      run === null ||
      currentTake.id !== takeId ||
      (currentTake.lifecycle !== 'recording' &&
        options.roomStatus() !== 'complete')
    ) {
      return
    }
    const throughFrame = Math.max(lastSampledFrame, sampledFrame)
    lastSampledFrame = throughFrame
    setDisplay(
      currentEngine.sample(
        currentTake,
        throughFrame,
        retainedHealth(currentTake, options.health()),
      ),
    )
    refreshDebugModel(currentEngine, currentTake, immediate)
  }

  createEffect(() => {
    if (
      finishing() ||
      holdReason() !== null ||
      options.listeningStatus() === 'error'
    ) {
      return
    }
    sampleCurrentTake()
  })

  const settleCompletedTake = (take: GuitarTakeSnapshot): boolean => {
    const currentEngine = engine
    const run = boundary()
    if (
      currentEngine === null ||
      run === null ||
      take.id !== takeId ||
      take.lifecycle !== 'completed'
    ) {
      return false
    }
    const throughFrame = Math.max(
      lastSampledFrame,
      take.durationFrames ?? sampledTransportFrame(),
    )
    lastSampledFrame = throughFrame
    setDisplay(
      currentEngine.sample(
        take,
        throughFrame,
        retainedHealth(take, options.health()),
      ),
    )
    refreshDebugModel(currentEngine, take, true)
    finishingTakeId = null
    setHoldReason(null)
    setFinishing(false)
    return true
  }

  createEffect(() => {
    if (!finishing()) return
    const currentTake = options.take()
    if (currentTake === null || currentTake.id !== finishingTakeId) {
      finishingTakeId = null
      setFinishing(false)
      setHoldReason('paused')
      return
    }
    if (currentTake.lifecycle === 'recording') {
      return
    }
    if (!settleCompletedTake(currentTake)) {
      finishingTakeId = null
      setFinishing(false)
      setHoldReason('paused')
    }
  })

  createEffect(() => {
    const current = display()
    if (current?.grade === null || current?.grade === undefined) {
      setPresentedGrade(null)
      return
    }
    if (current.phase !== 'active' || current.score === null) {
      setPresentedGrade(current.grade)
      return
    }
    setPresentedGrade((previous) =>
      liveGradeWithHysteresis(
        current.score ?? 0,
        current.grade ?? 'D',
        previous,
      ),
    )
  })

  createEffect(() => {
    if (
      options.listeningStatus() !== 'error' ||
      engine === null ||
      holdReason() !== null
    ) {
      return
    }
    generation += 1
    setHoldReason('input-lost')
    setStarting(false)
    options.pauseRoom()
  })

  const state = createMemo<GuitarNightLiveScoreState>(() => {
    const current = display()
    if (holdReason() !== null)
      return current === null ? 'unavailable' : 'paused'
    if (starting() || options.roomStatus() === 'count-in') return 'count-in'
    if (current === null) {
      return options.listeningStatus() === 'listening' ? 'ready' : 'needs-input'
    }
    if (current.phase !== 'active') {
      if (current.totals.judgedTargets === 0) return 'unavailable'
      return 'complete'
    }
    if (current.totals.judgedTargets < 4 || presentedGrade() === null) {
      return 'warming'
    }
    return 'active'
  })

  const label = createMemo(() => {
    switch (state()) {
      case 'warming':
        return 'Setting your score'
      case 'active':
        return 'Live take'
      case 'paused':
        return 'Score held'
      case 'complete':
        return 'Take complete'
      case 'unavailable':
        return 'Score unavailable'
      default:
        return 'Live score'
    }
  })

  const detail = createMemo(() => {
    const current = display()
    switch (state()) {
      case 'needs-input':
        return 'Turn on Listening'
      case 'ready':
        return 'Press Play when ready'
      case 'count-in':
        return options.roomStatus() === 'count-in'
          ? `Count-in · ${options.countInRemaining()}`
          : 'Opening the room clock'
      case 'warming': {
        const judged = current?.totals.judgedTargets ?? 0
        return `${judged} of 4 notes scored`
      }
      case 'active':
        return `Notes · ${current?.totals.judgedTargets ?? 0} judged`
      case 'paused':
        return holdReason() === 'input-lost'
          ? 'Input disconnected'
          : `Paused at ${compactBeat(options.playheadBeat())}`
      case 'complete':
        return current !== null && current.totals.judgedTargets >= 4
          ? `Notes · ${current.totals.judgedTargets} judged`
          : 'Not enough notes to grade'
      case 'unavailable':
        return current === null
          ? 'No usable note evidence'
          : unavailableDetail(current)
    }
  })

  let previousState: GuitarNightLiveScoreState | null = null
  let previousGrade: GuitarLiveScoreGrade | null = null
  createEffect(() => {
    const nextState = state()
    const nextGrade = presentedGrade()
    if (nextState === previousState && nextGrade === previousGrade) return
    previousState = nextState
    previousGrade = nextGrade
    if (nextState === 'complete') {
      const finalScore = display()?.score ?? null
      setAnnouncement(
        nextGrade !== null && finalScore !== null
          ? `Take complete, live score ${Math.round(finalScore)} out of 100, grade ${nextGrade}`
          : 'Live score complete',
      )
      return
    }
    if (nextGrade !== null && nextState === 'active') {
      setAnnouncement(`Live grade ${nextGrade}`)
      return
    }
    if (nextState === 'ready') setAnnouncement('Live score ready')
    else if (nextState === 'count-in') setAnnouncement('Live score count-in')
    else if (nextState === 'paused') {
      setAnnouncement(
        holdReason() === 'input-lost'
          ? 'Input disconnected; live score held'
          : 'Live score paused',
      )
    } else if (nextState === 'unavailable') {
      setAnnouncement('Live score unavailable')
    } else if (nextState === 'needs-input') {
      setAnnouncement('Turn on Listening for live score')
    } else setAnnouncement('')
  })

  const clear = (): void => {
    generation += 1
    engine = null
    takeId = null
    lastSampledFrame = 0
    setBoundary(null)
    setDisplay(null)
    setPresentedGrade(null)
    setStarting(false)
    setHoldReason(null)
    setStartedAt(null)
    setScoringInputKind(null)
    observedDebugEvents.clear()
    lastDebugModelAtMs = 0
    setDebugModel(null)
    finishingTakeId = null
    setFinishing(false)
  }

  const start = async (range: LoopSpan): Promise<boolean> => {
    if (starting() || options.listeningStatus() !== 'listening') return false
    const currentGeneration = ++generation
    setStarting(true)
    const wallClockStartedAt = Date.now()
    try {
      const inputKind = options.inputKind()
      const run = await options.startRoom(range)
      if (currentGeneration !== generation) {
        if (run !== null) options.stopRoom()
        return false
      }
      if (run === null || !options.armTakeAt(run.startedAtSeconds)) {
        options.stopRoom()
        return false
      }
      const armedTake = options.take()
      if (armedTake === null) {
        options.stopInput()
        options.stopRoom()
        return false
      }
      const nextEngine = createGuitarLiveScoreEngine({
        source: {
          referenceId: run.reference.songId,
          trackId: run.reference.trackId,
          range: {
            startBeat: run.range.start,
            endBeat: run.range.end,
          },
        },
        sampleRate: run.sampleRate,
        beatToSeconds: run.beatToSeconds,
        targets: run.reference.notes.map((note) => ({
          id: note.id,
          midi: note.midi,
          startBeat: note.startBeat,
        })),
        inputKind,
        ...guitarScoreEngineTuning(inputKind),
        debug: import.meta.env.DEV,
      })
      if (!options.completeTakeAt(run.completedAtSeconds)) {
        options.stopInput()
        options.stopRoom()
        return false
      }
      engine = nextEngine
      takeId = armedTake.id
      lastSampledFrame = 0
      // The overlay's event page belongs to the take that produced it. Event
      // ids carry the take id, so nothing here is ever overwritten by a later
      // run -- without this the map grows by a take's worth of events on every
      // Play, and each rebuild re-sorts and re-searches all of them. Four runs
      // of a 290-event take had the overlay scanning 1,160 strikes per target.
      observedDebugEvents.clear()
      lastDebugModelAtMs = 0
      setBoundary(run)
      setDisplay(nextEngine.snapshot())
      setPresentedGrade(null)
      setHoldReason(null)
      setStartedAt(wallClockStartedAt)
      setScoringInputKind(inputKind)
      finishingTakeId = null
      setFinishing(false)
      return true
    } finally {
      if (currentGeneration === generation) setStarting(false)
    }
  }

  /** Preserve the last earned result; a later Play begins a fresh take. */
  const hold = (): void => {
    if (engine === null) return
    sampleCurrentTake(true)
    generation += 1
    setHoldReason('paused')
    setStarting(false)
  }

  /**
   * End an ordinary rehearsal take and settle its cumulative score now.
   *
   * Pause deliberately keeps an active, rolling result. Stop is different:
   * it pins the input boundary now, then keeps analysis alive only long enough
   * to attach late pitch before publishing the cumulative result.
   */
  const finish = (): boolean => {
    const currentTake = options.take()
    if (engine === null || currentTake === null || currentTake.id !== takeId) {
      return false
    }
    if (finishing()) return true

    sampleCurrentTake(true)
    generation += 1
    setStarting(false)
    if (currentTake.lifecycle === 'completed') {
      return settleCompletedTake(currentTake)
    }
    if (currentTake.lifecycle !== 'recording') {
      return false
    }

    // Enter the gate before pinEnd publishes its still-recording snapshot.
    // Otherwise the ordinary reactive sampler can advance past the manual
    // boundary in the same turn and judge targets the player never reached.
    finishingTakeId = currentTake.id
    setFinishing(true)
    if (!options.completeTakeNow()) {
      finishingTakeId = null
      setFinishing(false)
      return false
    }
    return true
  }

  return {
    /** Development-only diagnosis of this run; null in production builds. */
    debugModel,
    debugPlayheadSeconds: () => {
      const run = boundary()
      if (run === null) return null
      return transportFrame() / run.sampleRate
    },
    visible: () => true,
    captureActive: () =>
      // An active display can only exist with an engine. Keeping this accessor
      // signal-first also lets owner memos observe the first admitted run;
      // checking the non-reactive engine first would short-circuit forever.
      holdReason() === null && display()?.phase === 'active',
    starting,
    finishing,
    state,
    basis: () => 'notes' as const,
    label,
    detail,
    score: () => {
      const value = display()?.score ?? null
      return value === null ? null : Math.round(value)
    },
    grade: presentedGrade,
    /** Immutable run facts used by the separate objective take ledger. */
    display,
    boundary,
    startedAt,
    inputKind: scoringInputKind,
    announcement,
    start,
    hold,
    finish,
    clear,
  }
}
