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
import type { GuitarRoomBand, GuitarRoomBandNote, } from '@/features/guitar/backing/guitar-room-band'
import { createGuitarRoomBand, GUITAR_ROOM_BAND_MAX_TEMPO_BPM, resolveBandLoop, resolveGuitarRoomBandTempoBpm, } from '@/features/guitar/backing/guitar-room-band'
import type { StringedInstrument } from '@/lib/guitar/instrument-tuning'
import type { LoopSpan } from '@/lib/guitar/loop-span'
import { quantizeSpanToBeats } from '@/lib/guitar/loop-span'
import type { MidiTempoChange } from '@/lib/midi-song'
import { createBeatClock, createSecondsToBeatClock } from '@/lib/midi-song'
import type { GuitarNightReference } from './reference-port'

export type GuitarNightScoreRoomStatus =
  | 'quiet'
  | 'starting'
  | 'count-in'
  | 'playing'
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
  reference: GuitarNightReference
  scoreTempoBpm: number
  tempoBpm: number
  countInBeats: number
  durationBeats: number
  durationSeconds: number
  exerciseBeats: number
  tempoChanges?: readonly MidiTempoChange[]
  beatToSeconds: (beat: number) => number
  secondsToBeat: (seconds: number) => number
  loop: LoopSpan | null
  hearScore: boolean
  melody: readonly GuitarRoomBandNote[]
  melodyVariant: 'electric' | 'bass'
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
  const takeIsActive = createMemo(
    () =>
      status() === 'starting' ||
      status() === 'count-in' ||
      status() === 'playing',
  )
  const tempoBpm = createMemo(
    () =>
      (takeIsActive() ? runningTake()?.tempoBpm : undefined) ??
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
      (takeIsActive() ? runningTake()?.countInBeats : undefined) ??
      configuredCountInBeats(),
  )
  const hearScore = createMemo(
    () =>
      (takeIsActive() ? runningTake()?.hearScore : undefined) ??
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

  /** Read the band's audio clock every frame. The clock is the authority. */
  const followAudioClock = (): void => {
    stopFrames()
    const tick = (): void => {
      const context = band.getAudioGraph()?.context
      if (context !== undefined && originSeconds !== null) {
        const elapsed = Math.max(0, context.currentTime - originSeconds)
        const run = runningTake()
        setPositionSeconds(
          run !== null && run.loop === null
            ? Math.min(elapsed, run.durationSeconds)
            : elapsed,
        )
      }
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
  }

  const start = async (): Promise<boolean> => {
    const reference = options.reference()
    if (reference === null || reference.notes.length === 0) return false

    // Read every mutable accessor before crossing the async audio boundary.
    // Once scheduled, this object is the complete truth for the take; edits
    // configure the next take without rewriting the one already sounding.
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
    const loopForRun = resolveBandLoop(scheduledLoop(), exerciseBeatsForRun)
    const run: GuitarNightScoreRoomRunConfiguration = {
      reference,
      scoreTempoBpm: scoreTempoForRun,
      tempoBpm: tempoForRun,
      countInBeats: configuredCountInBeats(),
      durationBeats: durationBeatsForRun,
      durationSeconds: beatToSecondsForRun(durationBeatsForRun),
      exerciseBeats: exerciseBeatsForRun,
      tempoChanges: tempoChangesForRun,
      beatToSeconds: beatToSecondsForRun,
      secondsToBeat: secondsToBeatForRun,
      loop: loopForRun,
      hearScore: configuredHearScore(),
      melody: scoreToBandMelody(reference),
      melodyVariant: configuredMelodyVariant(),
    }

    startGeneration += 1
    const generation = startGeneration
    stopFrames()
    band.stop()
    originSeconds = null
    setError(null)
    setPositionSeconds(0)
    setRunningTake(run)
    setCountInRemaining(run.countInBeats)
    setStatus('starting')

    try {
      await band.start({
        tempoBpm: run.tempoBpm,
        tempoChanges: run.tempoChanges,
        countInBeats: run.countInBeats,
        exerciseBeats: run.exerciseBeats,
        durationBeats: run.durationBeats,
        loop: run.loop,
        // A tab room rehearses a written part, so it ticks rather than
        // grooving, and it sounds the part rather than something under it.
        feel: 'click',
        melody: run.hearScore ? run.melody : [],
        melodyVariant: run.melodyVariant,
        onBeat: (beatIndex, phase, scheduledAtSeconds) => {
          if (generation !== startGeneration) return
          if (phase === 'count-in') {
            setStatus('count-in')
            setCountInRemaining(Math.max(1, run.countInBeats - beatIndex))
            return
          }
          if (beatIndex === 0 && originSeconds === null) {
            // Beat one's scheduled audio time remains true even when the main
            // thread delivers this callback late under rendering work.
            originSeconds = scheduledAtSeconds
            followAudioClock()
          }
          setStatus('playing')
          setCountInRemaining(0)
        },
        onComplete: () => {
          if (generation !== startGeneration) return
          stopFrames()
          setStatus('complete')
          setPositionSeconds(run.durationSeconds)
        },
      })
      return generation === startGeneration
    } catch {
      if (generation !== startGeneration) return false
      stopFrames()
      band.stop()
      originSeconds = null
      setRunningTake(null)
      setStatus('error')
      setError('The room clock could not start. Check this device’s audio.')
      return false
    }
  }

  const toggle = (): void => {
    if (
      status() === 'quiet' ||
      status() === 'complete' ||
      status() === 'error'
    ) {
      void start()
      return
    }
    stop()
  }

  const setTempoBpm = (value: number): void => {
    setTempoOverride(
      Math.min(
        SCORE_ROOM_MAX_TEMPO,
        Math.max(SCORE_ROOM_MIN_TEMPO, Math.round(value)),
      ),
    )
  }

  const resetTempo = (): void => {
    setTempoOverride(null)
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
    stop,
    toggle,
    setTempoBpm,
    resetTempo,
    setCountInBeats,
    /** Whether the room sounds the score. Takes effect on the next take. */
    hearScore,
    setHearScore,
  }
}
