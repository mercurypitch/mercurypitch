// The score room rehearses an authored tab on its own clock, with no separated song.
// ============================================================
//
// A tab does not need a recording to be worth playing. This drives the shared
// stage from the room band's count-in and groove, so an imported Guitar Pro or
// MIDI score is a complete rehearsal on its own terms.
//
// Musical time comes from the band's audio clock. A frame loop only *reads*
// that clock to refresh the signal — it never defines the beat.

import type { Accessor } from 'solid-js'
import { createMemo, createSignal, onCleanup } from 'solid-js'
import type { GuitarRoomBand, GuitarRoomBandNote, GuitarRoomBandStartResult, } from '@/features/guitar/backing/guitar-room-band'
import { createGuitarRoomBand, GUITAR_ROOM_BAND_MAX_TEMPO_BPM, resolveBandLoop, resolveBandStartBeat, resolveGuitarRoomBandTempoBpm, } from '@/features/guitar/backing/guitar-room-band'
import type { StringedInstrument } from '@/lib/guitar/instrument-tuning'
import type { LoopSpan } from '@/lib/guitar/loop-span'
import { normalizeLoopSpan, quantizeSpanToBeats } from '@/lib/guitar/loop-span'
import type { MidiTempoChange } from '@/lib/midi-song'
import { createBeatClock, createSecondsToBeatClock } from '@/lib/midi-song'
import type { GuitarNightReference } from './reference-port'

export type GuitarNightScoreRoomStatus =
  | 'quiet'
  | 'starting'
  | 'count-in'
  | 'playing'
  | 'paused'
  | 'complete'
  | 'error'

export const SCORE_ROOM_MIN_TEMPO = 40
export const SCORE_ROOM_MAX_TEMPO = GUITAR_ROOM_BAND_MAX_TEMPO_BPM
export const SCORE_ROOM_MAX_COUNT_IN = 8

interface GuitarNightScoreRoomControllerOptions {
  reference: Accessor<GuitarNightReference | null>
  /**
   * Beats to repeat, in the score's own beat time. The click cannot be rewound
   * — it is a scheduled pulse — so a loop is scheduled into it at start and
   * folded out of the elapsed clock for display.
   */
  loop?: Accessor<LoopSpan | null>
  /** Which instrument the stage is showing, so the score sounds like it. */
  instrument?: Accessor<StringedInstrument>
  createBand?: () => GuitarRoomBand
  requestFrame?: (callback: () => void) => number
  cancelFrame?: (handle: number) => void
}

interface GuitarNightScoreRoomRunConfiguration {
  mode: 'rehearsal' | 'assessment'
  reference: GuitarNightReference
  scoreTempoBpm: number
  tempoBpm: number
  countInBeats: number
  durationBeats: number
  durationSeconds: number
  startBeat: number
  endBeat: number
  endSeconds: number
  exerciseBeats: number
  tempoChanges?: readonly MidiTempoChange[]
  beatToSeconds: (beat: number) => number
  secondsToBeat: (seconds: number) => number
  loop: LoopSpan | null
  hearScore: boolean
  melody: readonly GuitarRoomBandNote[]
  melodyVariant: 'electric' | 'bass'
  exercisePulse: boolean
}

export interface GuitarNightScoreAssessmentBoundary {
  id: string
  reference: GuitarNightReference
  range: LoopSpan
  tempoBpm: number
  scoreTempoBpm: number
  countInBeats: number
  sampleRate: number
  startedAtSeconds: number
  completedAtSeconds: number
  beatToSeconds: (beat: number) => number
}

/** Copy every mutable collection whose later edit would rewrite a take. */
function snapshotReference(
  reference: GuitarNightReference,
): GuitarNightReference {
  return {
    ...reference,
    tempoChanges: reference.tempoChanges?.map((change) => ({ ...change })),
    tuning: {
      ...reference.tuning,
      openMidi: [...reference.tuning.openMidi],
      labels: [...reference.tuning.labels],
    },
    notes: reference.notes.map((note) => ({ ...note })),
    tracks: reference.tracks.map((track) => ({ ...track })),
  }
}

/**
 * The score as the band can schedule it: MIDI pitch and position in beats.
 * The stage's own notes carry string and fret too, which the ear does not need.
 */
export function scoreToBandMelody(
  reference: GuitarNightReference | null,
): GuitarRoomBandNote[] {
  if (reference === null) return []
  return reference.notes.map((note) => ({
    midi: note.midi,
    startBeat: note.startBeat,
    durationBeats: note.duration,
  }))
}

/** Beats the score occupies, from its first note to the end of its last. */
export function scoreDurationBeats(
  reference: GuitarNightReference | null,
): number {
  if (reference === null) return 0
  return reference.notes.reduce(
    (latest, note) => Math.max(latest, note.startBeat + note.duration),
    0,
  )
}

/** Preserve a score's tempo relationships while changing its opening tempo. */
export function scaleScoreTempoChanges(
  changes: readonly MidiTempoChange[] | undefined,
  scoreTempoBpm: number,
  targetTempoBpm: number,
): MidiTempoChange[] | undefined {
  if (changes === undefined) return undefined
  const sourceTempo = Number.isFinite(scoreTempoBpm)
    ? Math.max(1, scoreTempoBpm)
    : 120
  const targetTempo = Number.isFinite(targetTempoBpm)
    ? Math.max(1, targetTempoBpm)
    : sourceTempo
  const scale = sourceTempo / targetTempo
  return changes.map((change) => ({
    ...change,
    usPerBeat: change.usPerBeat * scale,
  }))
}

/**
 * Convert the audio clock into the beat the scheduler is sounding.
 *
 * Folding beats after a seconds-to-beat conversion only works at constant
 * tempo. A mapped loop repeats the seconds between A and B, so its inverse
 * must repeat that same interval before converting back to authored beats.
 */
export function scorePlayheadBeat(
  positionSeconds: number,
  loop: LoopSpan | null,
  beatToSeconds: (beat: number) => number,
  secondsToBeat: (seconds: number) => number,
): number {
  const elapsed = Number.isFinite(positionSeconds)
    ? Math.max(0, positionSeconds)
    : 0
  if (loop === null) return secondsToBeat(elapsed)

  const loopStartSeconds = beatToSeconds(loop.start)
  const loopEndSeconds = beatToSeconds(loop.end)
  const loopDurationSeconds = loopEndSeconds - loopStartSeconds
  if (
    elapsed < loopEndSeconds ||
    !Number.isFinite(loopDurationSeconds) ||
    loopDurationSeconds <= 0
  ) {
    return secondsToBeat(elapsed)
  }

  const cycleSeconds = (elapsed - loopEndSeconds) % loopDurationSeconds
  return secondsToBeat(loopStartSeconds + cycleSeconds)
}

export function useGuitarNightScoreRoomController(
  options: GuitarNightScoreRoomControllerOptions,
) {
  const [status, setStatus] = createSignal<GuitarNightScoreRoomStatus>('quiet')
  const [countInRemaining, setCountInRemaining] = createSignal(0)
  const [positionSeconds, setPositionSeconds] = createSignal(0)
  const [parkedBeat, setParkedBeat] = createSignal(0)
  const [configuredCountInBeats, setCountInBeatsSignal] = createSignal(4)
  const [tempoOverride, setTempoOverride] = createSignal<number | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [runningTake, setRunningTake] =
    createSignal<GuitarNightScoreRoomRunConfiguration | null>(null)

  const requestFrame =
    options.requestFrame ??
    ((callback: () => void) => requestAnimationFrame(callback))
  const cancelFrame =
    options.cancelFrame ?? ((handle: number) => cancelAnimationFrame(handle))

  const band = options.createBand?.() ?? createGuitarRoomBand()
  const [configuredHearScore, setHearScore] = createSignal(true)
  // A bass part played through a guitar voice reads as the wrong instrument
  // even when every note is right, so the tuning the room is already showing
  // decides the voice.
  const configuredMelodyVariant = createMemo(() =>
    options.instrument?.() === 'bass'
      ? ('bass' as const)
      : ('electric' as const),
  )
  let startGeneration = 0
  let assessmentSequence = 0
  let frame = 0
  let originSeconds: number | null = null

  const configuredScoreTempo = createMemo(
    () => options.reference()?.tempoBpm ?? 120,
  )
  const configuredTempoBpm = createMemo(() =>
    resolveGuitarRoomBandTempoBpm(
      Math.max(SCORE_ROOM_MIN_TEMPO, tempoOverride() ?? configuredScoreTempo()),
    ),
  )
  const configuredTempoChanges = createMemo(() =>
    scaleScoreTempoChanges(
      options.reference()?.tempoChanges,
      configuredScoreTempo(),
      configuredTempoBpm(),
    ),
  )
  const configuredBeatToSeconds = createMemo(() =>
    createBeatClock({
      bpm: configuredTempoBpm(),
      tempoChanges: configuredTempoChanges(),
    }),
  )
  const configuredSecondsToBeat = createMemo(() =>
    createSecondsToBeatClock({
      bpm: configuredTempoBpm(),
      tempoChanges: configuredTempoChanges(),
    }),
  )
  const scoreTempo = createMemo(
    () => runningTake()?.scoreTempoBpm ?? configuredScoreTempo(),
  )
  const takePinsSetup = createMemo(
    () =>
      runningTake() !== null &&
      (status() === 'starting' ||
        status() === 'count-in' ||
        status() === 'playing' ||
        status() === 'paused'),
  )
  const tempoBpm = createMemo(
    () =>
      (takePinsSetup() ? runningTake()?.tempoBpm : undefined) ??
      configuredTempoBpm(),
  )
  const durationBeats = createMemo(
    () =>
      runningTake()?.durationBeats ?? scoreDurationBeats(options.reference()),
  )
  const displayReference = createMemo(
    () => runningTake()?.reference ?? options.reference(),
  )
  const durationSeconds = createMemo(() => {
    const pinnedDuration = runningTake()?.durationSeconds
    if (pinnedDuration !== undefined) return pinnedDuration
    return configuredBeatToSeconds()(durationBeats())
  })
  const countInBeats = createMemo(
    () =>
      (takePinsSetup() ? runningTake()?.countInBeats : undefined) ??
      configuredCountInBeats(),
  )
  const hearScore = createMemo(
    () =>
      (takePinsSetup() ? runningTake()?.hearScore : undefined) ??
      configuredHearScore(),
  )
  const runningLoop = createMemo(() => runningTake()?.loop ?? null)
  /** The loop as the click was actually scheduled with it: whole beats. */
  const scheduledLoop = createMemo(() => {
    const span = options.loop?.() ?? null
    return span === null ? null : quantizeSpanToBeats(span)
  })
  const playheadBeat = createMemo(() => {
    if (status() === 'quiet') return null
    if (status() === 'paused' || status() === 'complete') return parkedBeat()
    const run = runningTake()
    return scorePlayheadBeat(
      positionSeconds(),
      runningLoop(),
      run?.beatToSeconds ?? configuredBeatToSeconds(),
      run?.secondsToBeat ?? configuredSecondsToBeat(),
    )
  })
  /** Elapsed time at the visible beat, folded with the playhead during a loop. */
  const displayPositionSeconds = createMemo(() => {
    const beat = playheadBeat()
    if (beat === null) return 0
    const beatToSeconds =
      runningTake()?.beatToSeconds ?? configuredBeatToSeconds()
    return beatToSeconds(beat)
  })

  const stopFrames = (): void => {
    if (frame !== 0) cancelFrame(frame)
    frame = 0
  }

  /** Sample the score position from the band's audio clock. */
  const readAudioClock = (): void => {
    const context = band.getAudioGraph()?.context
    if (context === undefined || originSeconds === null) return
    const elapsed = Math.max(0, context.currentTime - originSeconds)
    const run = runningTake()
    setPositionSeconds(
      run !== null && run.loop === null
        ? Math.min(elapsed, run.endSeconds)
        : elapsed,
    )
  }

  /** Read the band's audio clock every frame. The clock is the authority. */
  const followAudioClock = (): void => {
    stopFrames()
    const tick = (): void => {
      readAudioClock()
      frame = requestFrame(tick)
    }
    frame = requestFrame(tick)
  }

  const stop = (): void => {
    startGeneration += 1
    stopFrames()
    band.stop()
    originSeconds = null
    setRunningTake(null)
    setStatus('quiet')
    setCountInRemaining(0)
    setPositionSeconds(0)
    setParkedBeat(0)
  }

  const buildRun = (
    requestedAssessment?: LoopSpan,
  ): GuitarNightScoreRoomRunConfiguration | null => {
    const currentReference = options.reference()
    if (currentReference === null || currentReference.notes.length === 0) {
      return null
    }
    const reference = snapshotReference(currentReference)

    const scoreTempoForRun = configuredScoreTempo()
    const tempoForRun = configuredTempoBpm()
    const tempoChangesForRun = scaleScoreTempoChanges(
      reference.tempoChanges,
      scoreTempoForRun,
      tempoForRun,
    )
    const beatToSecondsForRun = createBeatClock({
      bpm: tempoForRun,
      tempoChanges: tempoChangesForRun,
    })
    const secondsToBeatForRun = createSecondsToBeatClock({
      bpm: tempoForRun,
      tempoChanges: tempoChangesForRun,
    })
    const durationBeatsForRun = scoreDurationBeats(reference)
    const exerciseBeatsForRun = Math.max(1, Math.ceil(durationBeatsForRun))
    const assessmentRange =
      requestedAssessment === undefined
        ? null
        : normalizeLoopSpan(
            requestedAssessment.start,
            requestedAssessment.end,
            durationBeatsForRun,
          )
    if (requestedAssessment !== undefined && assessmentRange === null) {
      return null
    }
    const mode = assessmentRange === null ? 'rehearsal' : 'assessment'
    const loopForRun =
      mode === 'assessment'
        ? null
        : resolveBandLoop(scheduledLoop(), exerciseBeatsForRun)
    const startBeatForRun = assessmentRange?.start ?? 0
    const endBeatForRun = assessmentRange?.end ?? durationBeatsForRun
    return {
      mode,
      reference,
      scoreTempoBpm: scoreTempoForRun,
      tempoBpm: tempoForRun,
      countInBeats: configuredCountInBeats(),
      durationBeats: durationBeatsForRun,
      durationSeconds: beatToSecondsForRun(durationBeatsForRun),
      startBeat: startBeatForRun,
      endBeat: endBeatForRun,
      endSeconds: beatToSecondsForRun(endBeatForRun),
      exerciseBeats: exerciseBeatsForRun,
      tempoChanges: tempoChangesForRun,
      beatToSeconds: beatToSecondsForRun,
      secondsToBeat: secondsToBeatForRun,
      loop: loopForRun,
      hearScore: mode === 'rehearsal' && configuredHearScore(),
      melody: mode === 'rehearsal' ? scoreToBandMelody(reference) : [],
      melodyVariant: configuredMelodyVariant(),
      exercisePulse: mode === 'rehearsal',
    }
  }

  const launch = async (
    run: GuitarNightScoreRoomRunConfiguration,
    requestedStartBeat: number,
    launchCountInBeats: number,
  ): Promise<GuitarRoomBandStartResult | null> => {
    const startBeat = resolveBandStartBeat(
      requestedStartBeat,
      run.durationBeats,
      run.loop,
    )
    const countInForLaunch = Math.max(0, Math.floor(launchCountInBeats))

    startGeneration += 1
    const generation = startGeneration
    stopFrames()
    band.stop()
    originSeconds = null
    setError(null)
    setPositionSeconds(run.beatToSeconds(startBeat))
    setParkedBeat(startBeat)
    setRunningTake(run)
    setCountInRemaining(countInForLaunch)
    setStatus('starting')

    try {
      const result = await band.start({
        tempoBpm: run.tempoBpm,
        tempoChanges: run.tempoChanges,
        countInBeats: countInForLaunch,
        exerciseBeats: run.exerciseBeats,
        startBeat,
        durationBeats: run.endBeat,
        loop: run.loop,
        // A tab room rehearses a written part, so it ticks rather than
        // grooving, and it sounds the part rather than something under it.
        feel: 'click',
        melody: run.hearScore ? run.melody : [],
        melodyVariant: run.melodyVariant,
        exercisePulse: run.exercisePulse,
        onExerciseStart: (exerciseStartBeat, scheduledAtSeconds) => {
          if (generation !== startGeneration) return
          originSeconds =
            scheduledAtSeconds - run.beatToSeconds(exerciseStartBeat)
          followAudioClock()
          setStatus('playing')
          setCountInRemaining(0)
        },
        onBeat: (beatIndex, phase) => {
          if (generation !== startGeneration) return
          if (phase === 'count-in') {
            setStatus('count-in')
            setCountInRemaining(Math.max(1, countInForLaunch - beatIndex))
            return
          }
          setCountInRemaining(0)
        },
        onComplete: () => {
          if (generation !== startGeneration) return
          stopFrames()
          setStatus('complete')
          setPositionSeconds(run.endSeconds)
          setParkedBeat(run.endBeat)
        },
      })
      return generation === startGeneration ? result : null
    } catch {
      if (generation !== startGeneration) return null
      stopFrames()
      band.stop()
      originSeconds = null
      setRunningTake(null)
      setStatus('error')
      setError('The room clock could not start. Check this device’s audio.')
      return null
    }
  }

  const pause = (): void => {
    if (
      status() !== 'starting' &&
      status() !== 'count-in' &&
      status() !== 'playing'
    ) {
      return
    }
    readAudioClock()
    const run = runningTake()
    if (run !== null) {
      const parkedBeat = Math.min(
        run.endBeat,
        Math.max(
          0,
          scorePlayheadBeat(
            positionSeconds(),
            run.loop,
            run.beatToSeconds,
            run.secondsToBeat,
          ),
        ),
      )
      setParkedBeat(parkedBeat)
      setPositionSeconds(run.beatToSeconds(parkedBeat))
    }
    startGeneration += 1
    stopFrames()
    band.stop()
    originSeconds = null
    setCountInRemaining(0)
    setStatus('paused')
    if (run?.mode === 'assessment') setRunningTake(null)
  }

  /** Park the playhead exactly where the rail points, without opening audio. */
  const seekSeconds = (value: number): void => {
    if (status() === 'complete') {
      // Completion keeps its pinned score visible for review. The first seek is
      // a new configurable run, though: retaining the old run here would lock
      // setup and silently revive its tempo, loop, and guide on Resume.
      startGeneration += 1
      stopFrames()
      band.stop()
      originSeconds = null
      setRunningTake(null)
    } else {
      pause()
    }
    const run = runningTake()
    const reference = run?.reference ?? options.reference()
    if (reference === null || reference.notes.length === 0) return
    const beatToSeconds = run?.beatToSeconds ?? configuredBeatToSeconds()
    const secondsToBeat = run?.secondsToBeat ?? configuredSecondsToBeat()
    const scoreBeats = run?.durationBeats ?? scoreDurationBeats(reference)
    const scoreSeconds = run?.durationSeconds ?? beatToSeconds(scoreBeats)
    const exerciseBeats =
      run?.exerciseBeats ?? Math.max(1, Math.ceil(scoreBeats))
    const activeLoop =
      run?.loop ?? resolveBandLoop(scheduledLoop(), exerciseBeats)
    const requestedSeconds = Number.isFinite(value) ? value : 0
    const clampedSeconds = Math.min(scoreSeconds, Math.max(0, requestedSeconds))
    const requestedBeat = Math.min(
      scoreBeats,
      Math.max(0, secondsToBeat(clampedSeconds)),
    )
    const targetBeat = resolveBandStartBeat(
      requestedBeat,
      scoreBeats,
      activeLoop,
    )
    setError(null)
    setParkedBeat(targetBeat)
    setPositionSeconds(beatToSeconds(targetBeat))
    setCountInRemaining(0)
    setStatus(
      activeLoop === null && requestedBeat >= scoreBeats
        ? 'complete'
        : 'paused',
    )
  }

  const start = async (): Promise<boolean> => {
    const pausedRun = status() === 'paused' ? runningTake() : null
    const run = pausedRun ?? buildRun()
    if (run === null) return false

    if (status() === 'paused') {
      return (
        (await launch(
          run,
          parkedBeat(),
          pausedRun === null ? run.countInBeats : 0,
        )) !== null
      )
    }

    const replayStart = status() === 'complete' ? (run.loop?.start ?? 0) : 0
    return (await launch(run, replayStart, run.countInBeats)) !== null
  }

  /**
   * Schedule one silent, non-looping score range for microphone assessment.
   * The audible count-in remains; exact audio-clock boundaries are returned so
   * the input recorder never borrows callback delivery time as musical time.
   */
  const startAssessment = async (
    range: LoopSpan,
  ): Promise<GuitarNightScoreAssessmentBoundary | null> => {
    const run = buildRun(range)
    if (run === null || run.mode !== 'assessment') return null
    const result = await launch(run, run.startBeat, run.countInBeats)
    if (
      result?.exerciseStartedAtSeconds === null ||
      result?.exerciseStartedAtSeconds === undefined ||
      result.completedAtSeconds === null
    ) {
      return null
    }
    const context = band.getAudioGraph()?.context
    if (context === undefined) return null
    assessmentSequence += 1
    return {
      id: `guitar-score-assessment-${assessmentSequence}`,
      reference: run.reference,
      range: { start: run.startBeat, end: run.endBeat },
      tempoBpm: run.tempoBpm,
      scoreTempoBpm: run.scoreTempoBpm,
      countInBeats: run.countInBeats,
      sampleRate: context.sampleRate,
      startedAtSeconds: result.exerciseStartedAtSeconds,
      completedAtSeconds: result.completedAtSeconds,
      beatToSeconds: run.beatToSeconds,
    }
  }

  const toggle = (): void => {
    if (
      status() === 'starting' ||
      status() === 'count-in' ||
      status() === 'playing'
    ) {
      pause()
      return
    }
    void start()
  }

  const setTempoBpm = (value: number): void => {
    setTempoOverride(
      Math.min(
        SCORE_ROOM_MAX_TEMPO,
        Math.max(SCORE_ROOM_MIN_TEMPO, Math.round(value)),
      ),
    )
    if (runningTake() === null && status() === 'paused') {
      setPositionSeconds(configuredBeatToSeconds()(parkedBeat()))
    }
  }

  const resetTempo = (): void => {
    setTempoOverride(null)
    if (runningTake() === null && status() === 'paused') {
      setPositionSeconds(configuredBeatToSeconds()(parkedBeat()))
    }
  }

  const setCountInBeats = (value: number): void => {
    setCountInBeatsSignal(
      Math.min(SCORE_ROOM_MAX_COUNT_IN, Math.max(0, Math.round(value))),
    )
  }

  onCleanup(() => {
    startGeneration += 1
    stopFrames()
    void band.dispose()
  })

  return {
    /** The loop this take is actually running, null until one is scheduled. */
    runningLoop,
    /** Setup stays editable for a parked pre-play seek, but not a paused take. */
    setupLocked: takePinsSetup,
    /** Open the room's audio without scheduling a beat — for microphone input. */
    activateAudio: async (): Promise<boolean> =>
      (await band.activate()) !== null,
    getAudioGraph: () => band.getAudioGraph(),
    status,
    error,
    countInRemaining,
    positionSeconds,
    displayPositionSeconds,
    playheadBeat,
    durationSeconds,
    durationBeats,
    /** Score snapshot whose notes and tuning agree with the sounding take. */
    displayReference,
    tempoBpm,
    scoreTempo,
    countInBeats,
    start,
    startAssessment,
    pause,
    stop,
    toggle,
    seekSeconds,
    setTempoBpm,
    resetTempo,
    setCountInBeats,
    /** Whether the room sounds the score. Takes effect on the next take. */
    hearScore,
    setHearScore,
  }
}
