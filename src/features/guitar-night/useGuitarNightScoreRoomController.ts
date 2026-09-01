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
import { createEffect, createMemo, createSignal, onCleanup, untrack, } from 'solid-js'
import type { GuitarRoomBand, GuitarRoomBandNote, GuitarRoomBandPercussionHit, GuitarRoomBandStartResult, GuitarRoomDrumPlaybackSnapshot, } from '@/features/guitar/backing/guitar-room-band'
import { createGuitarRoomBand, GUITAR_ROOM_BAND_MAX_TEMPO_BPM, resolveBandLoop, resolveBandStartBeat, resolveGuitarRoomBandTempoBpm, } from '@/features/guitar/backing/guitar-room-band'
import { GUITAR_TRACK_MIX_DEFAULT_DB, guitarTrackMixDbToGain, normalizeGuitarTrackMixDb, } from '@/features/guitar/backing/guitar-track-mix'
import type { GuitarElectricAmpParameters } from '@/lib/guitar/guitar-electric-amp'
import type { StringedInstrument } from '@/lib/guitar/instrument-tuning'
import type { LoopSpan } from '@/lib/guitar/loop-span'
import { normalizeLoopSpan, quantizeSpanToBeats } from '@/lib/guitar/loop-span'
import type { MidiTempoChange } from '@/lib/midi-song'
import { createBeatClock, createSecondsToBeatClock } from '@/lib/midi-song'
import { createPersistedSignal } from '@/lib/storage'
import type { GuitarNightDrumKitId } from './guitar-night-drum-sound'
import { GUITAR_NIGHT_SCORE_MAX_COUNT_IN_BEATS } from './guitar-night-score-count-in'
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
export const SCORE_ROOM_MAX_COUNT_IN = GUITAR_NIGHT_SCORE_MAX_COUNT_IN_BEATS
export const GUITAR_NIGHT_SCORE_CHANNEL = 'guitar-night-score'
export const GUITAR_NIGHT_SCORE_MIX_VOLUME_KEY =
  'mercurypitch.guitar-night.score-mix-volume.v1'
const MASTER_VOLUME_PERSIST_IDLE_MS = 180

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
  audibleBackingTrackIds?: Accessor<readonly string[] | undefined>
  /** Authored drum parts kept separate from the pitched backing melody. */
  backingPercussion?: Accessor<readonly GuitarRoomBandPercussionHit[]>
  /** Drum parts whose run-scoped gates begin open. */
  audiblePercussionTrackIds?: Accessor<readonly string[] | undefined>
  /**
   * Whether the scored part sounds when the player has not said either way.
   * A tab with a band behind it hands that part to the player; a tab with one
   * part keeps playing itself.
   */
  defaultHearScore?: Accessor<boolean>
  /** Persisted amp state; reading it must not open audio. */
  ampParameters?: Accessor<GuitarElectricAmpParameters>
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
  melody: readonly GuitarRoomBandNote[]
  /** Every other audible part, merged and already carrying its own timbre. */
  backingMelody: readonly GuitarRoomBandNote[]
  /** Every audible authored drum attack, never coerced into a melody note. */
  backingPercussion: readonly GuitarRoomBandPercussionHit[]
  audiblePercussionTrackIds: readonly string[]
  melodyVariant: 'electric' | 'bass'
  /**
   * Read on every beat rather than settled at launch, so the click can be
   * quieted while it is ticking. Phrase assessment is the only fixed-silent
   * mode; a live score keeps the reader's explicit rehearsal mix.
   */
  exercisePulse: () => boolean
}

interface GuitarNightScoreRoomStartOptions {
  /**
   * A deliberate Play, Space, or voice-command resume rehearses the selected
   * lead-in again. Automatic scrub recovery leaves this false so dragging the
   * playhead never surprises the player with another count-in.
   */
  countInOnResume?: boolean
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
    ...(note.velocity === undefined ? {} : { velocity: note.velocity }),
    ...(reference.instrumentFamily === undefined
      ? {}
      : { instrumentFamily: reference.instrumentFamily }),
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

/** Keep the room alive through the final authored one-shot drum attack. */
export function percussionDurationBeats(
  percussion: readonly GuitarRoomBandPercussionHit[],
): number {
  return percussion.reduce(
    (latest, hit) =>
      Number.isFinite(hit.startBeat) &&
      hit.startBeat >= 0 &&
      Number.isInteger(hit.gmKey) &&
      hit.gmKey >= 35 &&
      hit.gmKey <= 81
        ? Math.max(latest, hit.startBeat + 0.001)
        : latest,
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

function sameAmpParameters(
  left: GuitarElectricAmpParameters,
  right: GuitarElectricAmpParameters,
): boolean {
  const keys = Object.keys(left) as (keyof GuitarElectricAmpParameters)[]
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => Object.is(left[key], right[key]))
  )
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
  const [drumPlayback, setDrumPlayback] =
    createSignal<GuitarRoomDrumPlaybackSnapshot | null>(
      band.drumPlaybackSnapshot?.() ?? null,
    )
  const unsubscribeDrumPlayback = band.subscribeDrumPlayback?.(() => {
    setDrumPlayback(band.drumPlaybackSnapshot?.() ?? null)
  })
  const [persistedMasterVolume, persistMasterVolume] =
    createPersistedSignal<number>(GUITAR_NIGHT_SCORE_MIX_VOLUME_KEY, 0.76, {
      validator: (value): value is number =>
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 1,
    })
  const [masterVolume, setMasterVolumeSignal] = createSignal(
    persistedMasterVolume(),
  )
  let pendingMasterVolume: number | null = null
  let masterVolumePersistTimer: ReturnType<typeof setTimeout> | null = null

  const flushMasterVolumePersistence = (): void => {
    if (masterVolumePersistTimer !== null) {
      clearTimeout(masterVolumePersistTimer)
      masterVolumePersistTimer = null
    }
    const pending = pendingMasterVolume
    pendingMasterVolume = null
    if (pending !== null && pending !== untrack(persistedMasterVolume)) {
      persistMasterVolume(pending)
    }
  }

  const scheduleMasterVolumePersistence = (next: number): void => {
    if (masterVolumePersistTimer !== null) {
      clearTimeout(masterVolumePersistTimer)
      masterVolumePersistTimer = null
    }
    if (next === untrack(persistedMasterVolume)) {
      pendingMasterVolume = null
      return
    }
    pendingMasterVolume = next
    masterVolumePersistTimer = setTimeout(
      flushMasterVolumePersistence,
      MASTER_VOLUME_PERSIST_IDLE_MS,
    )
  }
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
  const [hearBacking, setHearBacking] = createSignal(true)
  const [trackLevelsBySong, setTrackLevelsBySong] = createSignal<
    ReadonlyMap<string, ReadonlyMap<string, number>>
  >(new Map())

  /** One authored fader, isolated by song and stable across M/S masks. */
  const trackLevelDb = (trackId: string): number => {
    const songId = options.reference()?.songId
    if (songId === undefined || trackId.length === 0) {
      return GUITAR_TRACK_MIX_DEFAULT_DB
    }
    return (
      trackLevelsBySong().get(songId)?.get(trackId) ??
      GUITAR_TRACK_MIX_DEFAULT_DB
    )
  }

  const setTrackLevelDb = (trackId: string, value: number): void => {
    const currentReference = options.reference()
    if (
      currentReference === null ||
      !currentReference.tracks.some((track) => track.id === trackId)
    ) {
      return
    }
    const nextLevel = normalizeGuitarTrackMixDb(value)
    setTrackLevelsBySong((previous) => {
      const nextBySong = new Map(previous)
      const nextSongLevels = new Map(previous.get(currentReference.songId))
      if (nextLevel === GUITAR_TRACK_MIX_DEFAULT_DB) {
        nextSongLevels.delete(trackId)
      } else {
        nextSongLevels.set(trackId, nextLevel)
      }
      if (nextSongLevels.size === 0) {
        nextBySong.delete(currentReference.songId)
      } else {
        nextBySong.set(currentReference.songId, nextSongLevels)
      }
      return nextBySong
    })
  }

  const resetTrackLevels = (): void => {
    const songId = options.reference()?.songId
    if (songId === undefined) return
    setTrackLevelsBySong((previous) => {
      if (!previous.has(songId)) return previous
      const next = new Map(previous)
      next.delete(songId)
      return next
    })
  }

  const setBandMelodyMix = (
    channelId: string,
    gain: number,
    audible: boolean,
  ): void => {
    if (
      band.setMelodyChannelGain !== undefined &&
      band.setMelodyChannelAudible !== undefined
    ) {
      band.setMelodyChannelGain(channelId, gain)
      band.setMelodyChannelAudible(channelId, audible)
      return
    }
    // Compatibility for injected pre-mixer band ports. The production band
    // owns direct gain and gate independently, including gains above unity.
    band.setMelodyChannelLevel(channelId, audible ? Math.min(1, gain) : 0)
  }

  const setBandPercussionMix = (
    trackId: string,
    gain: number,
    audible: boolean,
  ): void => {
    band.setPercussionTrackGain?.(trackId, gain)
    band.setPercussionTrackAudible(trackId, audible)
  }

  // This signal changes only through `setMasterVolume`; seed the dormant graph
  // once, then let that setter schedule exactly one live ramp per gesture.
  band.setMasterLevel(untrack(masterVolume))
  const ampParameters = options.ampParameters
  if (ampParameters !== undefined) {
    const initialAmpParameters = untrack(ampParameters)
    band.setElectricAmpParameters(initialAmpParameters)
    createEffect<GuitarElectricAmpParameters>((previous) => {
      const next = ampParameters()
      if (!sameAmpParameters(previous, next)) {
        band.setElectricAmpParameters(next)
      }
      return next
    }, initialAmpParameters)
  }
  createEffect(() => {
    const hydrated = persistedMasterVolume()
    if (pendingMasterVolume !== null || hydrated === untrack(masterVolume)) {
      return
    }
    setMasterVolumeSignal(hydrated)
    band.setMasterLevel(hydrated)
  })
  createEffect(() => {
    const currentReference = options.reference()
    // Subscribe once for all faders; individual lookups below then use the
    // same immutable song snapshot for one coherent live mix update.
    trackLevelsBySong()
    const configuredAudibleBackingTracks = options.audibleBackingTrackIds?.()
    const audible =
      configuredAudibleBackingTracks === undefined
        ? null
        : new Set(configuredAudibleBackingTracks)
    const backingChannelIds = new Set(
      (options.backingMelody?.() ?? [])
        .map((note) => note.channelId)
        .filter((channelId): channelId is string => channelId !== undefined),
    )
    if (currentReference !== null && currentReference.trackId !== '') {
      setBandMelodyMix(
        GUITAR_NIGHT_SCORE_CHANNEL,
        guitarTrackMixDbToGain(trackLevelDb(currentReference.trackId)),
        configuredHearScore(),
      )
    }
    for (const channelId of backingChannelIds) {
      setBandMelodyMix(
        channelId,
        guitarTrackMixDbToGain(trackLevelDb(channelId)),
        hearBacking() && (audible === null || audible.has(channelId)),
      )
    }

    const configuredAudiblePercussionTracks =
      options.audiblePercussionTrackIds?.()
    const audiblePercussion =
      configuredAudiblePercussionTracks === undefined
        ? null
        : new Set(configuredAudiblePercussionTracks)
    const percussionTrackIds = new Set(
      (options.backingPercussion?.() ?? []).map((hit) => hit.trackId),
    )
    for (const trackId of percussionTrackIds) {
      setBandPercussionMix(
        trackId,
        guitarTrackMixDbToGain(trackLevelDb(trackId)),
        hearBacking() &&
          (audiblePercussion === null || audiblePercussion.has(trackId)),
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
  const configuredDurationBeats = createMemo(() =>
    Math.max(
      scoreDurationBeats(options.reference()),
      percussionDurationBeats(options.backingPercussion?.() ?? []),
    ),
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
  const percussionBackingLive = createMemo(
    () =>
      runningTake()?.mode !== 'assessment' &&
      (status() === 'count-in' || status() === 'playing'),
  )
  const tempoBpm = createMemo(
    () =>
      (takePinsSetup() ? runningTake()?.tempoBpm : undefined) ??
      configuredTempoBpm(),
  )
  const durationBeats = createMemo(
    () => runningTake()?.durationBeats ?? configuredDurationBeats(),
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
    const maximumBeat = configuredDurationBeats()
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
  ): GuitarNightScoreRoomRunConfiguration | null => {
    const currentReference = options.reference()
    const configuredPercussion = options.backingPercussion?.() ?? []
    if (
      currentReference === null ||
      (currentReference.notes.length === 0 &&
        percussionDurationBeats(configuredPercussion) === 0)
    ) {
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
    const scoreDurationBeatsForRun = scoreDurationBeats(reference)
    const assessmentRange =
      requestedAssessment === undefined
        ? null
        : normalizeLoopSpan(
            requestedAssessment.start,
            requestedAssessment.end,
            scoreDurationBeatsForRun,
          )
    if (requestedAssessment !== undefined && assessmentRange === null) {
      return null
    }
    const mode = assessmentRange === null ? 'rehearsal' : boundedMode
    const backingPercussionForRun =
      mode !== 'assessment' ? [...configuredPercussion] : []
    const durationBeatsForRun =
      mode === 'rehearsal'
        ? Math.max(
            scoreDurationBeatsForRun,
            percussionDurationBeats(backingPercussionForRun),
          )
        : scoreDurationBeatsForRun
    const exerciseBeatsForRun = Math.max(1, Math.ceil(durationBeatsForRun))
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
      // Live scoring schedules the complete explicit mix. Input route never
      // doubles as a mute preset; live channel gates remain authoritative.
      melody: mode !== 'assessment' ? scoreToBandMelody(reference) : [],
      backingMelody:
        mode !== 'assessment' ? [...(options.backingMelody?.() ?? [])] : [],
      backingPercussion: backingPercussionForRun,
      audiblePercussionTrackIds: [
        ...(options.audiblePercussionTrackIds?.() ??
          Array.from(
            new Set(backingPercussionForRun.map((hit) => hit.trackId)),
          )),
      ],
      melodyVariant: configuredMelodyVariant(),
      exercisePulse: () => mode !== 'assessment' && hearClick(),
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
        percussion: run.backingPercussion,
        audiblePercussionTrackIds: hearBacking()
          ? run.audiblePercussionTrackIds
          : [],
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
      return (
        (await launch(
          { ...run, loop: null },
          restartBeat,
          currentStatus === 'starting' || currentStatus === 'count-in'
            ? run.countInBeats
            : 0,
        )) !== null
      )
    }
    // The scheduler owns whole exercise beats. A percussion attack at beat 2
    // gives the one-shot run a 2.001-beat audible horizon but still belongs in
    // the full [0, 3) loop selected by a B marker at the rail's right edge.
    // Clamping to the shorter one-shot horizon before whole-beat quantization
    // would silently turn B=3 into B=2 and drop that final attack.
    const normalized = normalizeLoopSpan(
      next.start,
      next.end,
      run.exerciseBeats,
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
      (await launch(
        { ...run, loop: activatedLoop },
        restartBeat,
        currentStatus === 'starting' || currentStatus === 'count-in'
          ? run.countInBeats
          : 0,
      )) !== null
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
    const enteredComplete = status() === 'complete'
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
    const maximumBeat = configuredDurationBeats()
    const parked = Math.min(maximumBeat, Math.max(0, beat))
    setParkedBeat(parked)
    setPositionSeconds(configuredBeatToSeconds()(parked))
    setStatus(enteredComplete ? 'complete' : 'paused')
  }

  /** Exact authored beat → timeline seconds for rails and marker placement. */
  const secondsForBeat = (value: number): number => {
    const run = runningTake()
    const currentReference = run?.reference ?? options.reference()
    if (currentReference === null) return 0
    const maximumBeat = run?.durationBeats ?? configuredDurationBeats()
    const requestedBeat = Number.isFinite(value) ? value : 0
    const targetBeat = Math.min(maximumBeat, Math.max(0, requestedBeat))
    return (run?.beatToSeconds ?? configuredBeatToSeconds())(targetBeat)
  }

  /** Exact timeline seconds → authored beat for rail pointer interactions. */
  const beatForSeconds = (value: number): number => {
    const run = runningTake()
    const currentReference = run?.reference ?? options.reference()
    if (currentReference === null) return 0
    const maximumBeat = run?.durationBeats ?? configuredDurationBeats()
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
    if (reference === null) return
    const beatToSeconds = run?.beatToSeconds ?? configuredBeatToSeconds()
    const secondsToBeat = run?.secondsToBeat ?? configuredSecondsToBeat()
    const scoreBeats =
      run?.durationBeats ??
      Math.max(
        scoreDurationBeats(reference),
        percussionDurationBeats(options.backingPercussion?.() ?? []),
      )
    if (scoreBeats <= 0) return
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

  const start = async (
    startOptions: GuitarNightScoreRoomStartOptions = {},
  ): Promise<boolean> => {
    const pausedRun = status() === 'paused' ? runningTake() : null
    const run = pausedRun ?? buildRun()
    if (run === null) return false

    if (status() === 'paused') {
      const launchCountInBeats =
        pausedRun === null
          ? run.countInBeats
          : startOptions.countInOnResume === true
            ? configuredCountInBeats()
            : 0
      const resumedRun =
        startOptions.countInOnResume === true &&
        run.countInBeats !== launchCountInBeats
          ? { ...run, countInBeats: launchCountInBeats }
          : run
      return (
        (await launch(resumedRun, parkedBeat(), launchCountInBeats)) !== null
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
   * The run schedules every rehearsal lane so explicit Target, Backing, track,
   * and Click controls remain live; the selected input route never rewrites
   * the player's mix.
   */
  const startLiveScore = async (
    range: LoopSpan,
  ): Promise<GuitarNightScoreLiveBoundary | null> => {
    const run = buildRun(range, 'live-score')
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
    void start({ countInOnResume: true })
  }

  const setPercussionTrackAudible = (
    trackId: string,
    audible: boolean,
  ): void => {
    setBandPercussionMix(
      trackId,
      guitarTrackMixDbToGain(trackLevelDb(trackId)),
      audible && hearBacking(),
    )
    setRunningTake((run) => {
      if (run === null || run.mode === 'assessment') return run
      const trackIds = new Set(run.audiblePercussionTrackIds)
      if (audible) trackIds.add(trackId)
      else trackIds.delete(trackId)
      return { ...run, audiblePercussionTrackIds: [...trackIds] }
    })
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
    if (next !== masterVolume()) {
      setMasterVolumeSignal(next)
      band.setMasterLevel(next)
    }
    scheduleMasterVolumePersistence(next)
  }

  const setDrumKit = (kitId: GuitarNightDrumKitId): void => {
    band.setDrumKit?.(kitId)
  }

  onCleanup(() => {
    unsubscribeDrumPlayback?.()
    flushMasterVolumePersistence()
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
    percussionBackingLive,
    setPercussionTrackAudible,
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
    flushMasterVolumePersistence,
    /** Song-keyed authored faders; gates never rewrite these values. */
    trackLevelDb,
    setTrackLevelDb,
    resetTrackLevels,
    /** Switch retained Guitar-room drums in place, without transport churn. */
    setDrumKit,
    /** Readiness and routing truth; never evidence that output was audible. */
    drumPlayback,
    /** Whether the room sounds the score; its gain changes during playback. */
    hearScore,
    setHearScore,
    /** Master gate above the backing lanes' individual mute and solo state. */
    hearBacking,
    setHearBacking,
    /** Whether the click runs under the take. */
    hearClick,
    setHearClick,
  }
}
