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
import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js'
import type { GuitarRoomBand, GuitarRoomBandNote, GuitarRoomBandStartResult, } from '@/features/guitar/backing/guitar-room-band'
import { createGuitarRoomBand, GUITAR_ROOM_BAND_MAX_TEMPO_BPM, resolveBandLoop, resolveBandStartBeat, resolveGuitarRoomBandTempoBpm, } from '@/features/guitar/backing/guitar-room-band'
import type { StringedInstrument } from '@/lib/guitar/instrument-tuning'
import type { LoopSpan } from '@/lib/guitar/loop-span'
import { normalizeLoopSpan, quantizeSpanToBeats } from '@/lib/guitar/loop-span'
import type { MidiTempoChange } from '@/lib/midi-song'
import { createBeatClock, createSecondsToBeatClock } from '@/lib/midi-song'
import { createPersistedSignal } from '@/lib/storage'
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
export const GUITAR_NIGHT_SCORE_CHANNEL = 'guitar-night-score'
export const GUITAR_NIGHT_SCORE_MIX_VOLUME_KEY =
  'mercurypitch.guitar-night.score-mix-volume.v1'

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
  /**
   * The rest of the band: notes from every other part the player chose to
   * hear, each already carrying its own timbre.
   */
  backingMelody?: Accessor<readonly GuitarRoomBandNote[]>
  /** Which backing lanes are open now; gain changes are safe during playback. */
  audibleBackingTrackIds?: Accessor<readonly string[]>
  /**
   * Whether the scored part sounds when the player has not said either way.
   * A tab with a band behind it hands that part to the player; a tab with one
   * part keeps playing itself.
   */
  defaultHearScore?: Accessor<boolean>
  createBand?: () => GuitarRoomBand
  requestFrame?: (callback: () => void) => number
  cancelFrame?: (handle: number) => void
}

interface GuitarNightScoreRoomRunConfiguration {
  mode: 'rehearsal' | 'assessment' | 'live-score'
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
  /** Every other audible part, merged and already carrying its own timbre. */
  backingMelody: readonly GuitarRoomBandNote[]
  melodyVariant: 'electric' | 'bass'
  /**
   * Read on every beat rather than settled at launch, so the click can be
   * quieted while it is ticking. The mode rule is fixed for the run — a live
   * take never sounds the room into an open microphone — but whether the
   * reader wants to hear it is theirs to change at any time.
   */
  exercisePulse: () => boolean
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

export type GuitarNightScoreLiveBoundary = GuitarNightScoreAssessmentBoundary

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
    channelId: GUITAR_NIGHT_SCORE_CHANNEL,
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
  const [masterVolume, setMasterVolumeSignal] = createPersistedSignal<number>(
    GUITAR_NIGHT_SCORE_MIX_VOLUME_KEY,
    0.76,
    {
      validator: (value): value is number =>
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 1,
    },
  )
  // Held against the part it was chosen for, so scoring a different part gets
  // the default that suits it rather than the last part's answer.
  const [hearScoreOverride, setHearScoreOverride] = createSignal<{
    key: string
    value: boolean
  } | null>(null)
  const referenceKey = createMemo(() => {
    const current = options.reference()
    return current === null ? '' : `${current.songId}:${current.trackId}`
  })
  const configuredHearScore = createMemo(() => {
    const override = hearScoreOverride()
    if (override !== null && override.key === referenceKey()) {
      return override.value
    }
    return options.defaultHearScore?.() ?? true
  })

  // This signal changes only through `setMasterVolume`; seed the dormant graph
  // once, then let that setter schedule exactly one live ramp per gesture.
  band.setMasterLevel(masterVolume())
  createEffect(() => {
    band.setMelodyChannelLevel(
      GUITAR_NIGHT_SCORE_CHANNEL,
      configuredHearScore() ? 1 : 0,
    )
    const audible =
      options.audibleBackingTrackIds === undefined
        ? null
        : new Set(options.audibleBackingTrackIds())
    const channelIds = new Set(
      (options.backingMelody?.() ?? [])
        .map((note) => note.channelId)
        .filter((channelId): channelId is string => channelId !== undefined),
    )
    for (const channelId of channelIds) {
      band.setMelodyChannelLevel(
        channelId,
        audible === null || audible.has(channelId) ? 1 : 0,
      )
    }
  })
  const setHearScore = (
    next: boolean | ((previous: boolean) => boolean),
  ): void => {
    const value =
      typeof next === 'function' ? next(configuredHearScore()) : next
    setHearScoreOverride({ key: referenceKey(), value })
  }
  /**
   * The click. It used to run whenever the room did, with no way to quiet it —
   * reported as "it plays in background and cannot be adjusted, muted etc."
   */
  const [hearClick, setHearClick] = createSignal(true)
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
  // Deliberately not guarded by `takePinsSetup`: a completed take is reviewed
  // against the score it actually sounded, not against whatever is loaded now.
  // Reading a different part ends the take instead — see `stop` — which is what
  // returns this to the live reference.
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
  const hearScore = configuredHearScore
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

  // Once a pinned run has been released, keep the parked musical position in
  // the newly selected score/tempo domain. Track changes are reactive, so the
  // second half of this handoff necessarily happens after the owner's signal
  // updates rather than inside the click handler that requested it.
  createEffect(() => {
    const currentStatus = status()
    if (
      runningTake() !== null ||
      (currentStatus !== 'paused' && currentStatus !== 'complete')
    ) {
      return
    }
    const maximumBeat = scoreDurationBeats(options.reference())
    const beat = Math.min(maximumBeat, Math.max(0, parkedBeat()))
    if (beat !== parkedBeat()) setParkedBeat(beat)
    setPositionSeconds(configuredBeatToSeconds()(beat))
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
    boundedMode: 'assessment' | 'live-score' = 'assessment',
    audibleGuide = false,
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
    const mode = assessmentRange === null ? 'rehearsal' : boundedMode
    const loopForRun =
      mode !== 'rehearsal'
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
      hearScore:
        mode === 'rehearsal' || (mode === 'live-score' && audibleGuide),
      melody:
        mode === 'rehearsal' || (mode === 'live-score' && audibleGuide)
          ? scoreToBandMelody(reference)
          : [],
      // The band follows the same rule as the score: never sounded into an
      // open microphone, where the room's own playback becomes player evidence.
      backingMelody:
        mode === 'rehearsal' || (mode === 'live-score' && audibleGuide)
          ? [...(options.backingMelody?.() ?? [])]
          : [],
      melodyVariant: configuredMelodyVariant(),
      exercisePulse: () =>
        (mode === 'rehearsal' || (mode === 'live-score' && audibleGuide)) &&
        hearClick(),
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
        melody: [...run.melody, ...run.backingMelody],
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

  /**
   * Apply an owner-approved A/B edit to an ordinary rehearsal already in
   * flight. Assessment and live-score runs are deliberately refused: their
   * admitted evidence is pinned to one range and must be ended by the owner
   * before a fresh scored range begins.
   */
  const applyLoopSpan = async (next: LoopSpan | null): Promise<boolean> => {
    const run = runningTake()
    const currentStatus = status()
    if (
      run === null ||
      run.mode !== 'rehearsal' ||
      (currentStatus !== 'starting' &&
        currentStatus !== 'count-in' &&
        currentStatus !== 'playing' &&
        currentStatus !== 'paused')
    ) {
      return false
    }
    if (next === null) {
      if (run.loop === null) return true
      if (currentStatus === 'paused') {
        const visibleBeat = Math.min(
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
        setRunningTake({ ...run, loop: null })
        setParkedBeat(visibleBeat)
        setPositionSeconds(run.beatToSeconds(visibleBeat))
        return true
      }
      readAudioClock()
      const restartBeat = Math.min(
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
      return (await launch({ ...run, loop: null }, restartBeat, 0)) !== null
    }
    const normalized = normalizeLoopSpan(
      next.start,
      next.end,
      run.durationBeats,
    )
    if (normalized === null) return false
    const activatedLoop = resolveBandLoop(
      quantizeSpanToBeats(normalized),
      run.exerciseBeats,
    )
    if (activatedLoop === null) return false
    if (
      run.loop?.start === activatedLoop.start &&
      run.loop.end === activatedLoop.end
    ) {
      return true
    }
    if (currentStatus !== 'paused') readAudioClock()
    const visibleBeat = Math.min(
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
    // Completing A/B is an explicit request to enter the new loop at A. Once
    // a loop already exists, boundary edits behave like the Stem Mixer: keep
    // the audible playhead when it remains inside the edited range, and only
    // fold to A when the edit leaves it outside the new half-open span.
    const restartBeat =
      run.loop !== null &&
      visibleBeat >= activatedLoop.start &&
      visibleBeat < activatedLoop.end
        ? visibleBeat
        : activatedLoop.start
    if (currentStatus === 'paused') {
      setRunningTake({ ...run, loop: activatedLoop })
      setParkedBeat(restartBeat)
      setPositionSeconds(run.beatToSeconds(restartBeat))
      return true
    }
    return (
      (await launch({ ...run, loop: activatedLoop }, restartBeat, 0)) !== null
    )
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
    if (run !== null && run.mode !== 'rehearsal') setRunningTake(null)
  }

  /**
   * Pause at the exact visible beat and release the old run snapshot. Setup
   * changes can then apply to the next count-in without throwing the player
   * back to beat one.
   */
  const parkForConfiguration = (): void => {
    if (
      status() === 'starting' ||
      status() === 'count-in' ||
      status() === 'playing'
    ) {
      pause()
    }
    if (
      (status() !== 'paused' && status() !== 'complete') ||
      runningTake() === null
    ) {
      return
    }
    const beat = parkedBeat()
    setRunningTake(null)
    const maximumBeat = scoreDurationBeats(options.reference())
    const parked = Math.min(maximumBeat, Math.max(0, beat))
    setParkedBeat(parked)
    setPositionSeconds(configuredBeatToSeconds()(parked))
    setStatus('paused')
  }

  /** Exact authored beat → timeline seconds for rails and marker placement. */
  const secondsForBeat = (value: number): number => {
    const run = runningTake()
    const currentReference = run?.reference ?? options.reference()
    if (currentReference === null || currentReference.notes.length === 0)
      return 0
    const maximumBeat =
      run?.durationBeats ?? scoreDurationBeats(currentReference)
    const requestedBeat = Number.isFinite(value) ? value : 0
    const targetBeat = Math.min(maximumBeat, Math.max(0, requestedBeat))
    return (run?.beatToSeconds ?? configuredBeatToSeconds())(targetBeat)
  }

  /** Exact timeline seconds → authored beat for rail pointer interactions. */
  const beatForSeconds = (value: number): number => {
    const run = runningTake()
    const currentReference = run?.reference ?? options.reference()
    if (currentReference === null || currentReference.notes.length === 0)
      return 0
    const maximumBeat =
      run?.durationBeats ?? scoreDurationBeats(currentReference)
    const beatToSeconds = run?.beatToSeconds ?? configuredBeatToSeconds()
    const secondsToBeat = run?.secondsToBeat ?? configuredSecondsToBeat()
    const maximumSeconds = run?.durationSeconds ?? beatToSeconds(maximumBeat)
    const requestedSeconds = Number.isFinite(value) ? value : 0
    const targetSeconds = Math.min(
      maximumSeconds,
      Math.max(0, requestedSeconds),
    )
    return Math.min(maximumBeat, Math.max(0, secondsToBeat(targetSeconds)))
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

  /** Seek through the active score's exact tempo map, not a BPM approximation. */
  const seekBeat = (value: number): void => {
    seekSeconds(secondsForBeat(value))
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

  /**
   * Schedule one evidence-scored range on the same exact boundary as review.
   * Room-microphone routes keep the range silent so the app cannot grade its
   * own guide. MIDI may retain the configured guide because its note messages
   * cannot originate from the room speakers.
   */
  const startLiveScore = async (
    range: LoopSpan,
    options: { audibleGuide: boolean },
  ): Promise<GuitarNightScoreLiveBoundary | null> => {
    const run = buildRun(range, 'live-score', options.audibleGuide)
    if (run === null || run.mode !== 'live-score') return null
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
      id: `guitar-score-live-${assessmentSequence}`,
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
    parkForConfiguration()
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
    parkForConfiguration()
    setTempoOverride(null)
    if (runningTake() === null && status() === 'paused') {
      setPositionSeconds(configuredBeatToSeconds()(parkedBeat()))
    }
  }

  const setCountInBeats = (value: number): void => {
    if (status() === 'paused') parkForConfiguration()
    setCountInBeatsSignal(
      Math.min(SCORE_ROOM_MAX_COUNT_IN, Math.max(0, Math.round(value))),
    )
  }

  const setMasterVolume = (value: number): void => {
    const next = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
    setMasterVolumeSignal(next)
    band.setMasterLevel(next)
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
    parkForConfiguration,
    /** Open the room's audio without scheduling a beat — for microphone input. */
    activateAudio: async (): Promise<boolean> =>
      (await band.activate()) !== null,
    getAudioGraph: () => band.getAudioGraph(),
    status,
    error,
    countInRemaining,
    positionSeconds,
    displayPositionSeconds,
    secondsForBeat,
    beatForSeconds,
    playheadBeat,
    durationSeconds,
    durationBeats,
    /** Score snapshot whose notes and tuning agree with the sounding take. */
    displayReference,
    tempoBpm,
    scoreTempo,
    countInBeats,
    configuredCountInBeats,
    start,
    startAssessment,
    startLiveScore,
    pause,
    stop,
    toggle,
    seekSeconds,
    seekBeat,
    applyLoopSpan,
    setTempoBpm,
    resetTempo,
    setCountInBeats,
    masterVolume,
    setMasterVolume,
    /** Whether the room sounds the score; its gain changes during playback. */
    hearScore,
    setHearScore,
    /** Whether the click runs under the take. */
    hearClick,
    setHearClick,
  }
}
