// The reference controller owns the score axis: attach, track choice, and URL state.
// ============================================================

import { createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import type { InstrumentTuning, StringedInstrument, } from '@/lib/guitar/instrument-tuning'
import { clampStringCount, DEFAULT_STRING_COUNT, standardTuning, } from '@/lib/guitar/instrument-tuning'
import { backingMelody, backingParts, scoredPartSoundsByDefault, } from './backing-parts'
import type { GuitarNightReference, GuitarNightReferencePort, GuitarNightReferenceSummary, GuitarNightTranscriptionPort, MeasuredReferenceInput, } from './reference-port'
import { measuredReferenceFromTranscription } from './reference-port'
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

interface GuitarNightReferenceControllerOptions {
  loadReferencePort?: () => Promise<GuitarNightReferencePort>
  loadTranscriptionPort?: () => Promise<GuitarNightTranscriptionPort>
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

  // Which other parts the room plays under the player. Muted rather than
  // audible ids: a part added later should sound by default, because "play all
  // but the scored against" is the whole point of having a band.
  const [mutedBackingTracks, setMutedBackingTracks] = createSignal<{
    songId: string
    trackIds: readonly string[]
  }>({ songId: '', trackIds: [] })

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

  const audibleBackingTrackIds = createMemo<readonly string[]>(() => {
    const muted = new Set(mutedBacking())
    return backingPartList()
      .map((part) => part.trackId)
      .filter((trackId) => !muted.has(trackId))
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

  /** Whether the scored part sounds when the player has not said either way. */
  const scoredPartDefaultsAudible = createMemo(() =>
    scoredPartSoundsByDefault(sheetSource(), reference()?.trackId),
  )

  const toggleBackingTrack = (trackId: string): void => {
    const current = reference()
    if (current === null || trackId === current.trackId) return
    const muted = new Set(mutedBacking())
    if (muted.has(trackId)) {
      muted.delete(trackId)
    } else {
      muted.add(trackId)
    }
    setMutedBackingTracks({ songId: current.songId, trackIds: [...muted] })
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
  const replaceOnCurrentInstrument = (nextTuning: InstrumentTuning): void => {
    const current = state()
    if (current.kind !== 'ready') return
    if (current.reference.kind === 'measured') {
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
    sheetVisibleTrackIds,
    toggleSheetTrack,
    backingPartList,
    audibleBackingTrackIds,
    backingMelodyNotes,
    scoredPartDefaultsAudible,
    toggleBackingTrack,
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
