// The reference controller owns the score axis: attach, track choice, and URL state.
// ============================================================

import { createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import type { InstrumentTuning, StringedInstrument, } from '@/lib/guitar/instrument-tuning'
import { clampStringCount, DEFAULT_STRING_COUNT, standardTuning, } from '@/lib/guitar/instrument-tuning'
import type { MidiTimeSignature } from '@/lib/midi-bars'
import type { ScoreAlignment } from '@/lib/transcription/score-alignment'
import { alignmentDriftSeconds, nudgeAlignment, } from '@/lib/transcription/score-alignment'
import { backingMelody, backingParts, backingPercussion, scoredPartSoundsByDefault, } from './backing-parts'
import type { GuitarNightReference, GuitarNightReferencePort, GuitarNightReferenceSummary, GuitarNightTranscriptionPort, MeasuredReferenceInput, } from './reference-port'
import { measuredReferenceFromTranscription } from './reference-port'
import type { RecordingMarks } from './score-on-recording'
import { alignmentFromMarks, alignScoreToRecording, scoreOnRecording, scoreSpanSeconds, } from './score-on-recording'
import { readGuitarNightScore, withGuitarNightScore } from './session-link'
import { playableSheetTracks, sheetLaneFromReference, sheetLanesFromSource, } from './sheet/sheet-lanes'
import type { SheetLane } from './sheet/sheet-model'
import type { GuitarNightStemKind } from './song-port'

export type GuitarNightReferenceLibraryState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error'

export type GuitarNightReferenceState =
  | { kind: 'idle' }
  | { kind: 'ready'; reference: GuitarNightReference }
  | {
      kind: 'unavailable'
      songId: string
      reason: 'not-found' | 'no-playable-notes' | 'library-error'
    }

type HistoryMode = 'push' | 'replace' | 'none'

/**
 * Why a score could not be hung on this recording, in words a player can act
 * on. Each says what to try, because "alignment failed" tells nobody anything.
 */
const ALIGN_FAILURE_COPY: Record<string, string> = {
  'no-notes': 'That part has no notes to line up against this recording.',
  'no-anchors':
    'Nothing in that part lines up with this recording. Check it is the same song.',
  'no-agreement':
    'Too little of that part was heard in this recording to place it honestly.',
}

/**
 * A written score hung on a recording, and the evidence for the fit.
 *
 * The share of the part the recording confirmed exists only where something
 * measured it. A hand placement has no such number, and the union says so
 * rather than carrying a null that every reader of it has to defend against.
 */
type ReadingOnRecording = {
  songId: string
  trackId: string
  alignment: ScoreAlignment
  driftSeconds: number
} & ({ placedBy: 'measured'; matchedFraction: number } | { placedBy: 'hand' })

/** A part being hung by hand, and the moments marked in the recording so far. */
export interface HandPlacement {
  songId: string
  trackId: string
  /** Named so the room can say which part the marks belong to. */
  trackName: string
  marks: RecordingMarks
}

interface GuitarNightReferenceControllerOptions {
  loadReferencePort?: () => Promise<GuitarNightReferencePort>
  loadTranscriptionPort?: () => Promise<GuitarNightTranscriptionPort>
  /**
   * The recording staged right now, when one is.
   *
   * A part hung on a recording has to name the recording it was hung on, or
   * the room drops it the moment a different song is staged. A measurement
   * carries its own session; a hand placement has no measurement to carry one,
   * so it takes it from here.
   */
  backingSessionId?: () => string | null
}

export async function loadDefaultGuitarNightTranscriptionPort(): Promise<GuitarNightTranscriptionPort> {
  const module = await import('@/lib/transcription/stem-transcription-client')
  return {
    transcribeStem: (stemUrl, options) =>
      module.transcribeStem(stemUrl, {
        signal: options.signal,
        onProgress: options.onProgress,
      }),
  }
}

export async function loadDefaultGuitarNightReferencePort(): Promise<GuitarNightReferencePort> {
  const module = await import('./saved-score-reference-port')
  return module.createSavedScoreGuitarNightReferencePort()
}

function writeScoreToHistory(
  songId: string | null,
  mode: Exclude<HistoryMode, 'none'>,
): void {
  const href = withGuitarNightScore(window.location.href, songId)
  if (mode === 'replace') window.history.replaceState(null, '', href)
  else window.history.pushState(null, '', href)
}

export function useGuitarNightReferenceController(
  options: GuitarNightReferenceControllerOptions = {},
) {
  const [port, setPort] = createSignal<GuitarNightReferencePort | null>(null)
  const [libraryState, setLibraryState] =
    createSignal<GuitarNightReferenceLibraryState>('idle')
  const [state, setState] = createSignal<GuitarNightReferenceState>({
    kind: 'idle',
  })
  const [importStatus, setImportStatus] = createSignal<string | null>(null)
  const [importPendingFileName, setImportPendingFileName] = createSignal<
    string | null
  >(null)
  const [libraryVersion, setLibraryVersion] = createSignal(0)
  const [instrument, setInstrumentSignal] =
    createSignal<StringedInstrument>('guitar')
  const [stringCount, setStringCountSignal] = createSignal(
    DEFAULT_STRING_COUNT.guitar,
  )
  const [sourceTuning, setSourceTuning] = createSignal<InstrumentTuning | null>(
    null,
  )
  const tuning = createMemo(
    () => sourceTuning() ?? standardTuning(instrument(), stringCount()),
  )

  let disposed = false
  let attachGeneration = 0
  let importGeneration = 0
  let portPromise: Promise<GuitarNightReferencePort> | null = null
  /**
   * The track the instrument was last chosen for. A manual choice sticks until
   * a different part is attached, which is when the suggestion is worth having
   * again.
   */
  let tunedForTrack: string | null = null
  /** Kept so changing the instrument can re-place measured notes without re-reading audio. */
  let lastMeasured: MeasuredReferenceInput | null = null

  const references = createMemo<readonly GuitarNightReferenceSummary[]>(() => {
    libraryVersion()
    return port()?.listReferences() ?? []
  })

  const reference = createMemo(() => {
    const current = state()
    return current.kind === 'ready' ? current.reference : null
  })

  // Which parts the sheet draws, held against the song they belong to. Keying
  // the set by song is what makes attaching a different score forget the old
  // choices without a lifecycle hook to remember to write.
  const [sheetHiddenTracks, setSheetHiddenTracks] = createSignal<{
    songId: string
    trackIds: readonly string[]
  }>({ songId: '', trackIds: [] })

  const sheetSource = createMemo(() => {
    const current = reference()
    if (current === null || current.kind !== 'authored') return null
    libraryVersion()
    return port()?.readSource(current.songId) ?? null
  })

  /**
   * Where the sheet's bar lines go, from the file that carried them.
   *
   * A measured stem has none: its beats are seconds on a recording, not bars
   * in a score. Undefined there reads as common time, which the sheet states
   * as a fallback rather than as a claim about the music.
   */
  const sheetTimeSignatures = createMemo<
    readonly MidiTimeSignature[] | undefined
  >(() => sheetSource()?.timeSignatures)

  const sheetHidden = createMemo<readonly string[]>(() => {
    const current = reference()
    const held = sheetHiddenTracks()
    return current === null || held.songId !== current.songId
      ? []
      : held.trackIds
  })

  /** Parts on the sheet right now. The scored part is always among them. */
  const sheetVisibleTrackIds = createMemo<readonly string[]>(() => {
    const current = reference()
    if (current === null) return []
    const source = sheetSource()
    if (source === null) return [current.trackId]
    const hidden = new Set(sheetHidden())
    return playableSheetTracks(source)
      .map((track) => track.id)
      .filter((id) => id === current.trackId || !hidden.has(id))
  })

  const sheetLanes = createMemo<readonly SheetLane[]>(() => {
    const current = reference()
    if (current === null) return []
    const source = sheetSource()
    // A measured stem line has no written score behind it and counts its beats
    // on the recording's clock, so it reads as a sheet of exactly one part.
    if (source === null) return [sheetLaneFromReference(current)]
    return sheetLanesFromSource(source, {
      visibleTrackIds: sheetVisibleTrackIds(),
      scoredTrackId: current.trackId,
      scoredTuning: current.tuning,
    })
  })

  // The part in the corner of the moving views. It is the part you were reading
  // before, so tapping the corner and tapping it again puts you back — which is
  // what "swap between the two easily" asks for. Before any swap it is simply
  // the first other part on the page.
  const [previousScoredTrack, setPreviousScoredTrack] = createSignal<{
    songId: string
    trackId: string
  } | null>(null)

  const secondaryLane = createMemo<SheetLane | null>(() => {
    const current = reference()
    if (current === null) return null
    const others = sheetLanes().filter(
      (lane) => lane.trackId !== current.trackId,
    )
    if (others.length === 0) return null

    const previous = previousScoredTrack()
    if (previous !== null && previous.songId === current.songId) {
      const swappedBack = others.find(
        (lane) => lane.trackId === previous.trackId,
      )
      if (swappedBack !== undefined) return swappedBack
    }
    return others[0] ?? null
  })

  // Which other parts the room plays under the player. Muted rather than
  // audible ids: a part added later should sound by default, because "play all
  // but the scored against" is the whole point of having a band.
  const [mutedBackingTracks, setMutedBackingTracks] = createSignal<{
    songId: string
    trackIds: readonly string[]
  }>({ songId: '', trackIds: [] })
  const [soloBackingTrack, setSoloBackingTrack] = createSignal<{
    songId: string
    trackId: string | null
  }>({ songId: '', trackId: null })

  const mutedBacking = createMemo<readonly string[]>(() => {
    const current = reference()
    const held = mutedBackingTracks()
    return current === null || held.songId !== current.songId
      ? []
      : held.trackIds
  })

  /** Every part that could play under the scored one, in written order. */
  const backingPartList = createMemo(() => {
    const source = sheetSource()
    const current = reference()
    if (source === null || current === null) return []
    return backingParts(source, current.trackId)
  })

  const soloedBackingTrackId = createMemo<string | null>(() => {
    const current = reference()
    const held = soloBackingTrack()
    if (current === null || held.songId !== current.songId) return null
    const part = backingPartList().find(
      (candidate) => candidate.trackId === held.trackId,
    )
    return part !== undefined &&
      (part.kind !== 'percussion' || part.supportedHitCount > 0)
      ? held.trackId
      : null
  })

  const audibleBackingTrackIds = createMemo<readonly string[]>(() => {
    const soloed = soloedBackingTrackId()
    if (soloed !== null) return [soloed]
    const muted = new Set(mutedBacking())
    return backingPartList()
      .filter(
        (part) =>
          !muted.has(part.trackId) &&
          (part.kind !== 'percussion' || part.supportedHitCount > 0),
      )
      .map((part) => part.trackId)
  })

  const backingMelodyNotes = createMemo(() => {
    const source = sheetSource()
    const current = reference()
    if (source === null || current === null) return []
    return backingMelody(source, {
      scoredTrackId: current.trackId,
      audibleTrackIds: audibleBackingTrackIds(),
    })
  })

  /** Every backing note, including muted lanes, so live gains can restore it. */
  const rehearsalBackingMelodyNotes = createMemo(() => {
    const source = sheetSource()
    const current = reference()
    if (source === null || current === null) return []
    return backingMelody(source, { scoredTrackId: current.trackId })
  })

  /** Audible drum hits for snapshots that schedule only the selected mix. */
  const backingPercussionHits = createMemo(() => {
    const source = sheetSource()
    const current = reference()
    if (source === null || current === null) return []
    return backingPercussion(source, {
      scoredTrackId: current.trackId,
      audibleTrackIds: audibleBackingTrackIds(),
    })
  })
  const allBackingPercussionHits = createMemo(() => {
    const source = sheetSource()
    const current = reference()
    if (source === null || current === null) return []
    return backingPercussion(source, { scoredTrackId: current.trackId })
  })

  /** Whether the scored part sounds when the player has not said either way. */
  const scoredPartDefaultsAudible = createMemo(() =>
    scoredPartSoundsByDefault(sheetSource(), reference()?.trackId),
  )

  const toggleBackingTrack = (trackId: string): void => {
    const current = reference()
    if (current === null || trackId === current.trackId) return
    const part = backingPartList().find(
      (candidate) => candidate.trackId === trackId,
    )
    if (
      part === undefined ||
      (part.kind === 'percussion' && part.supportedHitCount === 0)
    ) {
      return
    }
    const muted = new Set(mutedBacking())
    if (muted.has(trackId)) {
      muted.delete(trackId)
    } else {
      muted.add(trackId)
      if (soloedBackingTrackId() === trackId) {
        setSoloBackingTrack({ songId: current.songId, trackId: null })
      }
    }
    setMutedBackingTracks({ songId: current.songId, trackIds: [...muted] })
  }

  const toggleSoloBackingTrack = (trackId: string): void => {
    const current = reference()
    const part = backingPartList().find(
      (candidate) => candidate.trackId === trackId,
    )
    if (
      current === null ||
      trackId === current.trackId ||
      part === undefined ||
      (part.kind === 'percussion' && part.supportedHitCount === 0)
    ) {
      return
    }
    setSoloBackingTrack({
      songId: current.songId,
      trackId: soloedBackingTrackId() === trackId ? null : trackId,
    })
  }

  const toggleSheetTrack = (trackId: string): void => {
    const current = reference()
    if (current === null || trackId === current.trackId) return
    const hidden = new Set(sheetHidden())
    if (hidden.has(trackId)) {
      hidden.delete(trackId)
    } else {
      hidden.add(trackId)
    }
    setSheetHiddenTracks({ songId: current.songId, trackIds: [...hidden] })
  }

  /**
   * `lastMeasured` is a plain variable so the transcriber can write it without
   * re-running the graph; this mirrors it for the parts of the UI that must
   * appear the moment a measurement lands.
   */
  const [measuredForAlignment, setMeasuredForAlignment] =
    createSignal<MeasuredReferenceInput | null>(null)

  /**
   * The written score currently being read on the recording, if any.
   *
   * Kept so changing instrument can re-place it without measuring the audio
   * again — the alignment is a property of the pair, not of the neck.
   */
  const [readingOnRecording, setReadingOnRecording] =
    createSignal<ReadingOnRecording | null>(null)
  const [alignStatus, setAlignStatus] = createSignal<string | null>(null)
  const [handPlacement, setHandPlacement] = createSignal<HandPlacement | null>(
    null,
  )
  /**
   * The score a reader tried to hang and the matcher refused.
   *
   * Offered as a hand placement at exactly the moment they need it, naming the
   * score they already chose rather than making them choose again.
   */
  const [handFallback, setHandFallback] = createSignal<{
    songId: string
    title: string
  } | null>(null)

  /** Scores in the library that could be hung on the recording being read. */
  const alignableScores = createMemo<readonly GuitarNightReferenceSummary[]>(
    () => (measuredForAlignment() === null ? [] : references()),
  )

  const ensurePort = async (): Promise<GuitarNightReferencePort | null> => {
    const current = port()
    if (current !== null) return current

    if (portPromise === null) {
      setLibraryState('loading')
      const load =
        options.loadReferencePort ?? loadDefaultGuitarNightReferencePort
      portPromise = Promise.resolve().then(load)
    }

    try {
      const loaded = await portPromise
      if (disposed) return null
      setPort(loaded)
      setLibraryState('ready')
      return loaded
    } catch {
      portPromise = null
      if (!disposed) setLibraryState('error')
      return null
    }
  }

  const initialize = (): void => {
    void ensurePort()
  }

  /**
   * Move to an instrument and its most common string count, returning the
   * tuning directly so callers never depend on signal propagation order.
   */
  const adoptInstrument = (next: StringedInstrument): InstrumentTuning => {
    const count = DEFAULT_STRING_COUNT[next]
    setSourceTuning(null)
    setInstrumentSignal(next)
    setStringCountSignal(count)
    return standardTuning(next, count)
  }

  const adoptSourceTuning = (next: InstrumentTuning): InstrumentTuning => {
    setInstrumentSignal(next.instrument)
    setStringCountSignal(next.stringCount)
    setSourceTuning(next)
    return next
  }

  const attachReference = async (
    songId: string,
    trackId?: string,
    historyMode: HistoryMode = 'push',
    cancelPendingImport = true,
  ): Promise<void> => {
    const normalizedSongId = songId.trim()
    if (normalizedSongId === '') return
    if (cancelPendingImport) {
      importGeneration += 1
      setImportPendingFileName(null)
    }
    const generation = ++attachGeneration
    // An authored score replaces whatever was being measured: stop that work
    // rather than letting a late transcription overwrite this attachment.
    cancelFollowStem()

    const loadedPort = await ensurePort()
    if (disposed || generation !== attachGeneration) return
    if (loadedPort === null) {
      setState({
        kind: 'unavailable',
        songId: normalizedSongId,
        reason: 'library-error',
      })
      return
    }

    // A bass part read on guitar rows lands on the wrong strings with frets
    // from another neck, so the instrument is settled before the notes are
    // placed — but only when this is a part the player has not already tuned
    // for by hand.
    const suggestion = loadedPort.suggestInstrument(normalizedSongId, trackId)
    let stageTuning = tuning()
    if (suggestion !== null) {
      const trackKey = `${normalizedSongId}:${suggestion.trackId}`
      if (trackKey !== tunedForTrack) {
        tunedForTrack = trackKey
        stageTuning =
          suggestion.sourceTuning === undefined
            ? adoptInstrument(suggestion.instrument)
            : adoptSourceTuning(suggestion.sourceTuning)
      }
    }

    const result = loadedPort.openReference(
      normalizedSongId,
      trackId,
      stageTuning,
    )
    if (disposed || generation !== attachGeneration) return

    if (result.ok) {
      lastMeasured = null
      setMeasuredForAlignment(null)
      // Remember the visible track so the same part returns next time, in
      // Guitar Night and in the legacy tab that shares this library.
      loadedPort.rememberTrack(normalizedSongId, result.reference.trackId)
      setState({ kind: 'ready', reference: result.reference })
    } else {
      setState({
        kind: 'unavailable',
        songId: normalizedSongId,
        reason: result.code,
      })
    }

    if (historyMode !== 'none') {
      writeScoreToHistory(normalizedSongId, historyMode)
    }
  }

  const attach = (
    songId: string,
    trackId?: string,
    historyMode: HistoryMode = 'push',
  ): Promise<void> => attachReference(songId, trackId, historyMode)

  const selectTrack = async (trackId: string): Promise<void> => {
    const current = reference()
    if (current === null || current.trackId === trackId) return
    const selected = current.tracks.find((track) => track.id === trackId)
    if (selected === undefined || selected.kind === 'percussion') return
    // Solo is a live audition of a backing lane, not a hidden preference that
    // may reappear later. Once that lane becomes the scored part it leaves the
    // backing bus, so clear the audition rather than reviving it silently when
    // the player switches back.
    if (soloedBackingTrackId() === trackId) {
      setSoloBackingTrack({ songId: current.songId, trackId: null })
    }
    // Remember what is being left, so the corner offers the way back.
    setPreviousScoredTrack({
      songId: current.songId,
      trackId: current.trackId,
    })
    // Switching the visible part never re-routes: it is the same reference.
    await attach(current.songId, trackId, 'none')
  }

  const detach = (historyMode: HistoryMode = 'push'): void => {
    attachGeneration += 1
    importGeneration += 1
    setImportPendingFileName(null)
    setImportStatus(null)
    cancelFollowStem()
    lastMeasured = null
    setMeasuredForAlignment(null)
    setReadingOnRecording(null)
    setHandPlacement(null)
    setHandFallback(null)
    setAlignStatus(null)
    tunedForTrack = null
    setSourceTuning(null)
    setState({ kind: 'idle' })
    // Only the saved-score axis owns a URL parameter. A measured reference has
    // none, so clearing it must not push an identical entry onto history.
    if (historyMode !== 'none' && readGuitarNightScore() !== null) {
      writeScoreToHistory(null, historyMode)
    }
  }

  /**
   * Re-place the attached notes on the instrument now selected. A measured line
   * is re-placed from the transcription already in hand, so changing the neck
   * never re-reads the audio.
   */
  /** Rebuild the written-on-recording reference for a given neck. */
  const placeWrittenOnRecording = (
    written: ReadingOnRecording,
    nextTuning: InstrumentTuning,
  ): GuitarNightReference | null => {
    const source = port()?.readSource(written.songId) ?? null
    if (source === null) return null
    const measured = measuredForAlignment()
    const sessionId =
      measured?.sessionId ?? options.backingSessionId?.() ?? null
    return scoreOnRecording(source, written.trackId, written.alignment, {
      tuning: nextTuning,
      ...(sessionId === null ? {} : { backingSessionId: sessionId }),
      ...(measured === null
        ? {}
        : { recordingLabel: `this ${measured.stemLabel.toLowerCase()}` }),
    })
  }

  /**
   * Hang a written score on the recording currently being read.
   *
   * The measurement is the bridge: it is a transcription of this recording, so
   * the matcher can say where the written part lands against it. What comes
   * back reads as a measured line, because once the notes are pinned to a
   * recording there is no musical tempo left to claim.
   */
  const readScoreOnRecording = async (
    songId: string,
    trackId?: string,
  ): Promise<void> => {
    const measured = measuredForAlignment()
    if (measured === null) {
      setAlignStatus(
        'Measure a stem first, so there is a recording to read on.',
      )
      return
    }
    const loaded = await ensurePort()
    if (loaded === null || disposed) return
    const source = loaded.readSource(songId)
    if (source === null) {
      setAlignStatus('That score is no longer in the library.')
      return
    }
    const part = trackId ?? source.scoreTrackId
    if (part === null) {
      setAlignStatus('Choose a pitched part before aligning this score.')
      return
    }
    const result = alignScoreToRecording(source, part, measured.transcription)
    if (!result.ok) {
      setAlignStatus(ALIGN_FAILURE_COPY[result.code])
      setHandFallback({ songId, title: source.name })
      return
    }

    const written: ReadingOnRecording = {
      songId,
      trackId: part,
      alignment: result.fit.alignment,
      matchedFraction: result.fit.matchedFraction,
      driftSeconds: result.fit.driftSeconds,
      placedBy: 'measured',
    }
    if (!showWrittenOnRecording(written)) return
    setHandPlacement(null)
    setHandFallback(null)
  }

  /**
   * Place the reference for a reading, or say why it could not be placed.
   *
   * Every path that changes the alignment goes through here — measuring,
   * marking, nudging — so a reader always sees the tab move the moment they
   * change anything, and a failure to place never leaves a stale tab claiming
   * to be somewhere it is not.
   */
  const showWrittenOnRecording = (written: ReadingOnRecording): boolean => {
    const placed = placeWrittenOnRecording(written, tuning())
    if (placed === null) {
      setAlignStatus('That part could not be placed on this instrument.')
      return false
    }
    setReadingOnRecording(written)
    setAlignStatus(null)
    setState({ kind: 'ready', reference: placed })
    return true
  }

  /**
   * Start hanging a part by hand, for a recording nothing measured.
   *
   * Nothing moves yet: the reader has claimed a part but has not said where it
   * goes, and guessing here would put a tab on screen that nobody placed.
   */
  const placeScoreByHand = async (
    songId: string,
    trackId?: string,
  ): Promise<void> => {
    const loaded = await ensurePort()
    if (loaded === null || disposed) return
    const source = loaded.readSource(songId)
    if (source === null) {
      setAlignStatus('That score is no longer in the library.')
      return
    }
    const part = trackId ?? source.scoreTrackId
    if (part === null) {
      setAlignStatus('Choose a pitched part before placing this score.')
      return
    }
    // The track is looked up before the span rather than after, so the name a
    // reader is shown is the part's own name and never its id in disguise.
    const track = source.tracks.find((candidate) => candidate.id === part)
    if (track === undefined || scoreSpanSeconds(source, part) === null) {
      setAlignStatus('That part has no notes to place.')
      return
    }
    setHandPlacement({
      songId,
      trackId: part,
      trackName: track.name,
      marks: {},
    })
    setHandFallback(null)
    setAlignStatus(null)
  }

  /**
   * Pin a written moment to the moment of the recording now playing.
   *
   * One mark shifts the part; a second, far enough from the first, fixes its
   * rate as well — which is the usual reason somebody is doing this by hand.
   */
  const markScoreOnRecording = (
    end: 'first' | 'last',
    audioSeconds: number,
  ): void => {
    const placing = handPlacement()
    if (placing === null) return
    const source = port()?.readSource(placing.songId) ?? null
    const span =
      source === null ? null : scoreSpanSeconds(source, placing.trackId)
    if (span === null) {
      setAlignStatus('That score is no longer in the library.')
      return
    }

    // A room whose clock has not started yet reads NaN, and a moment that is
    // not a number marks nothing. Dropping it here keeps it out of the marks a
    // reader is shown as well as out of the placement.
    const moment = Number.isFinite(audioSeconds) ? audioSeconds : null
    const marks: RecordingMarks =
      moment === null
        ? placing.marks
        : {
            ...placing.marks,
            ...(end === 'first'
              ? { firstAudioSeconds: moment }
              : { lastAudioSeconds: moment }),
          }

    const alignment = alignmentFromMarks(span, marks)
    if (alignment === null) return
    setHandPlacement({ ...placing, marks })
    showWrittenOnRecording({
      songId: placing.songId,
      trackId: placing.trackId,
      alignment,
      driftSeconds: alignmentDriftSeconds(alignment),
      placedBy: 'hand',
    })
  }

  /** Forget the marks, and the tab they placed. */
  const clearHandPlacement = (): void => {
    const placing = handPlacement()
    if (placing === null) return
    setHandPlacement({ ...placing, marks: {} })
    if (readingOnRecording()?.placedBy === 'hand') stopReadingOnRecording()
  }

  /**
   * Slide the whole tab along the recording.
   *
   * The knob for "right, but late". A measured drift survives the nudge rather
   * than being flattened by it, and the result is marked as hand-placed
   * because it is now somebody's decision.
   */
  const nudgeScoreOnRecording = (deltaSeconds: number): void => {
    const written = readingOnRecording()
    if (written === null) return
    const alignment = nudgeAlignment(written.alignment, deltaSeconds)
    // Built rather than spread: a nudged reading is hand-placed, and spreading
    // would carry the measured share along as if it still described this.
    showWrittenOnRecording({
      songId: written.songId,
      trackId: written.trackId,
      alignment,
      driftSeconds: alignmentDriftSeconds(alignment),
      placedBy: 'hand',
    })
  }

  /**
   * Take the written part back off the recording.
   *
   * Where it goes depends on what was there first. A part hung over a stem
   * measurement goes back to the line the transcriber heard; one hung by hand
   * on an attached tab goes back to that tab, on its own clock. Both are a
   * return to what the reader had, which is the only thing "back" can mean.
   */
  const stopReadingOnRecording = (): void => {
    const written = readingOnRecording()
    setReadingOnRecording(null)
    setAlignStatus(null)
    const measured = measuredForAlignment()
    if (measured !== null) {
      setState({
        kind: 'ready',
        reference: measuredReferenceFromTranscription(measured, tuning()),
      })
      return
    }
    if (written !== null) void attach(written.songId, written.trackId, 'none')
  }

  const replaceOnCurrentInstrument = (nextTuning: InstrumentTuning): void => {
    const current = state()
    if (current.kind !== 'ready') return
    if (current.reference.kind === 'measured') {
      const written = readingOnRecording()
      if (written !== null) {
        const placed = placeWrittenOnRecording(written, nextTuning)
        if (placed !== null) setState({ kind: 'ready', reference: placed })
        return
      }
      if (lastMeasured === null) return
      setState({
        kind: 'ready',
        reference: measuredReferenceFromTranscription(lastMeasured, nextTuning),
      })
      return
    }
    void attach(current.reference.songId, current.reference.trackId, 'none')
  }

  const setInstrument = (next: StringedInstrument): void => {
    if (next === instrument() && sourceTuning() === null) return
    // A deliberate choice outranks the suggestion for as long as this part stays
    // attached.
    replaceOnCurrentInstrument(adoptInstrument(next))
  }

  const setStringCount = (next: number): void => {
    const clamped = clampStringCount(next)
    if (clamped === stringCount() && sourceTuning() === null) return
    setSourceTuning(null)
    setStringCountSignal(clamped)
    replaceOnCurrentInstrument(standardTuning(instrument(), clamped))
  }

  /**
   * Keep a deliberate tuning choice attached to the visible stage as well as
   * the tuner. A Drop D target with Standard rows would make every authored
   * low-string fret untrue, so the same tuning must re-place the reference.
   */
  const setTuning = (next: InstrumentTuning): void => {
    if (next.openMidi.length !== next.stringCount) return
    replaceOnCurrentInstrument(adoptSourceTuning(next))
  }

  const importFile = async (file: File): Promise<void> => {
    const generation = ++importGeneration
    attachGeneration += 1
    cancelFollowStem()
    setImportPendingFileName(file.name)
    setImportStatus(null)
    const loadedPort = await ensurePort()
    if (disposed || generation !== importGeneration) return
    if (loadedPort === null) {
      setImportStatus('Your tab library could not be opened.')
      setImportPendingFileName(null)
      return
    }

    try {
      const summary = await loadedPort.importReference(file)
      if (disposed || generation !== importGeneration) return
      setLibraryVersion((version) => version + 1)
      setImportStatus(null)
      await attachReference(summary.songId, undefined, 'replace', false)
    } catch (caught) {
      if (disposed || generation !== importGeneration) return
      setImportStatus(
        caught instanceof Error
          ? caught.message
          : 'That file could not be read as a tab.',
      )
    } finally {
      if (!disposed && generation === importGeneration) {
        setImportPendingFileName(null)
      }
    }
  }

  const [transcribeProgress, setTranscribeProgress] = createSignal<
    number | null
  >(null)
  /**
   * Which stem the running transcription is reading. One run at a time is a
   * hard rule below, and with more than one stem on offer the surface has to
   * be able to say which of them is busy — otherwise every button reports the
   * same progress.
   */
  const [transcribingStem, setTranscribingStem] = createSignal<{
    sessionId: string
    stemKind: GuitarNightStemKind
  } | null>(null)
  let transcribeAbort: AbortController | null = null

  /**
   * Follow what one separated stem actually plays. A measured reference is
   * derived from this recording, so it carries no saved id and never routes on
   * the score axis — re-opening the room re-derives it.
   */
  const followStem = async (
    input: Omit<MeasuredReferenceInput, 'transcription'> & { stemUrl: string },
  ): Promise<void> => {
    if (transcribeProgress() !== null) return
    importGeneration += 1
    setImportPendingFileName(null)
    setImportStatus(null)
    const generation = ++attachGeneration

    let loaded: GuitarNightTranscriptionPort
    try {
      const load =
        options.loadTranscriptionPort ?? loadDefaultGuitarNightTranscriptionPort
      loaded = await load()
    } catch {
      if (!disposed && generation === attachGeneration) {
        setImportStatus('The note reader could not be opened.')
      }
      return
    }
    if (disposed || generation !== attachGeneration) return

    const abort = new AbortController()
    transcribeAbort = abort
    setImportStatus(null)
    setTranscribeProgress(0)
    setTranscribingStem({
      sessionId: input.sessionId,
      stemKind: input.stemKind,
    })

    try {
      const transcription = await loaded.transcribeStem(input.stemUrl, {
        signal: abort.signal,
        onProgress: (fraction) => {
          if (!disposed && generation === attachGeneration) {
            setTranscribeProgress(Math.min(1, Math.max(0, fraction)))
          }
        },
      })
      if (disposed || generation !== attachGeneration || abort.signal.aborted) {
        return
      }
      if (transcription.notes.length === 0) {
        setImportStatus(
          `No clear notes could be read from the ${input.stemLabel.toLowerCase()} stem, so the stage stays in free play.`,
        )
        return
      }
      const measured: MeasuredReferenceInput = {
        sessionId: input.sessionId,
        stemKind: input.stemKind,
        stemLabel: input.stemLabel,
        transcription,
      }
      lastMeasured = measured
      setMeasuredForAlignment(measured)
      // A recording to read on is only useful with scores to offer against it,
      // so the library is loaded now rather than when the reader goes looking.
      void ensurePort()
      setReadingOnRecording(null)
      setHandPlacement(null)
      setHandFallback(null)
      setAlignStatus(null)
      // The stem names the instrument outright, so no guessing is needed.
      tunedForTrack = `${input.sessionId}:${input.stemKind}`
      const stageTuning = adoptInstrument(
        input.stemKind === 'bass' ? 'bass' : 'guitar',
      )
      setState({
        kind: 'ready',
        reference: measuredReferenceFromTranscription(measured, stageTuning),
      })
    } catch (caught) {
      if (disposed || abort.signal.aborted) return
      setImportStatus(
        caught instanceof Error
          ? caught.message
          : 'That stem could not be read.',
      )
    } finally {
      // A cancelled transcriber is allowed to settle after its replacement has
      // started. Only the run that still owns this slot may clear its progress;
      // otherwise the stale finally makes the live run look idle and permits a
      // duplicate measurement to start on top of it.
      if (transcribeAbort === abort) {
        transcribeAbort = null
        if (!disposed) {
          setTranscribeProgress(null)
          setTranscribingStem(null)
        }
      }
    }
  }

  const cancelFollowStem = (): void => {
    transcribeAbort?.abort()
    transcribeAbort = null
    setTranscribeProgress(null)
    setTranscribingStem(null)
  }

  onMount(() => {
    const initialSongId = readGuitarNightScore()
    if (initialSongId !== null) void attach(initialSongId, undefined, 'none')

    const handlePopState = () => {
      const nextSongId = readGuitarNightScore()
      if (nextSongId === null) {
        detach('none')
        return
      }
      void attach(nextSongId, undefined, 'none')
    }
    window.addEventListener('popstate', handlePopState)
    onCleanup(() => window.removeEventListener('popstate', handlePopState))
  })

  onCleanup(() => {
    disposed = true
    attachGeneration += 1
    importGeneration += 1
    transcribeAbort?.abort()
    transcribeAbort = null
  })

  return {
    libraryState,
    state,
    reference,
    references,
    importStatus,
    importPendingFileName,
    transcribeProgress,
    transcribingStem,
    sheetLanes,
    sheetTimeSignatures,
    alignableScores,
    readingOnRecording,
    alignStatus,
    readScoreOnRecording,
    stopReadingOnRecording,
    handPlacement,
    handFallback,
    placeScoreByHand,
    markScoreOnRecording,
    clearHandPlacement,
    nudgeScoreOnRecording,
    sheetVisibleTrackIds,
    toggleSheetTrack,
    secondaryLane,
    backingPartList,
    mutedBackingTrackIds: mutedBacking,
    audibleBackingTrackIds,
    backingMelodyNotes,
    rehearsalBackingMelodyNotes,
    soloedBackingTrackId,
    backingPercussionHits,
    allBackingPercussionHits,
    scoredPartDefaultsAudible,
    toggleBackingTrack,
    toggleSoloBackingTrack,
    instrument,
    stringCount,
    tuning,
    initialize,
    attach,
    selectTrack,
    detach,
    importFile,
    followStem,
    cancelFollowStem,
    setInstrument,
    setStringCount,
    setTuning,
  }
}
