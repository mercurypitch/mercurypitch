import type { Accessor, Setter } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup, untrack, } from 'solid-js'
import { loadPitchAnalysisFromDb, savePitchAnalysisToDb, } from '@/db/services/session-pitch-analysis-service'
import type { KeyEstimate, KeyNote, KeyRegion } from '@/lib/key-detection'
import { detectKeyFromNotes, detectRegionalKeys } from '@/lib/key-detection'
import type { MergedNote } from '@/lib/midi-generator'
import type { AnalysisAlgorithm, OfflineSegmentSecondsFrame, } from '@/lib/pitch-pipeline'
import { analyzeVocalSamples, pitchHistoryFromNotes, segmentVocalContour, VOCAL_ANALYSIS_DEFAULTS, } from '@/lib/pitch-pipeline'
import { midiToNote } from '@/lib/scale-data'
import type { SongTempoEstimate, SongTempoRecord, } from '@/lib/song-tempo-record'
import type { EditableNote, PitchEditLayer } from './pitch-edit-model'
import { applyEditLayer, deleteNote, editNote, emptyEditLayer, isEditLayerEmpty, mergeNotes, splitNote, } from './pitch-edit-model'
import { CONFIDENT_TEMPO, estimateSongTempo } from './song-tempo'
import type { StreamedVocalSource } from './streamed-vocal-samples'
import { canGatherStreamedVocal, gatherStreamedVocal, windowForStep, } from './streamed-vocal-samples'
import type { PitchNote } from './types'

/** Fields a drag edit may change. */
type EditPatch = Partial<Pick<EditableNote, 'startBeat' | 'endBeat' | 'midi'>>

export interface StemMixerPitchAnalysisDeps {
  sessionId?: string
  vocalBuffer: Accessor<AudioBuffer | null>
  /**
   * The vocal's stream, where it plays streamed and `vocalBuffer` has no
   * samples: the analysis then gathers channel 0 from its decoded chunks
   * (streamed-vocal-samples.ts), so a phone that streams finds the notes too,
   * unless the song is too long to hold even that way. Absent, or null: there
   * is only `vocalBuffer`.
   */
  vocalStream?: Accessor<StreamedVocalSource | null>
  /**
   * The recording the song's tempo is estimated from: the instrumental's
   * decoded samples when the song has one, else the vocal's. Null while it
   * decodes, and where it streams. Absent: the tempo is never estimated.
   */
  tempoSource?: Accessor<AudioBuffer | null>
  sampleRate: Accessor<number>
  setPitchHistory: (history: PitchNote[]) => void
  showNotification: (
    msg: string,
    type?: 'info' | 'success' | 'error' | 'warning',
  ) => void
}

/**
 * How an analysis ended. A failure carries what went wrong, and whether the
 * analysis has already shown that to the singer.
 */
export type PitchAnalysisOutcome =
  | { ok: true }
  | { ok: false; message: string; shown: boolean }

/** What a finished analysis says to the singer who asked for it. */
const ANALYSIS_COMPLETE = 'Pitch analysis complete'

/**
 * The share of the progress a streamed vocal's walk takes, in percent: the
 * decode of the whole song through the stream, before the detector runs.
 */
const STREAM_WALK_SHARE = 35

export interface StemMixerPitchAnalysisRunOptions {
  /**
   * Show nothing, success or failure: the caller reports the outcome as
   * part of its own message ("find my key" does).
   */
  quiet?: boolean
}

export interface StemMixerPitchAnalysisController {
  panelOpen: Accessor<boolean>
  setPanelOpen: Setter<boolean>

  pitchSourceMode: Accessor<'realtime' | 'offline'>
  setPitchSourceMode: Setter<'realtime' | 'offline'>
  offlinePitchHistory: Accessor<PitchNote[]>
  offlineMergedNotes: Accessor<MergedNote[]>
  /** Cleaned notes from the shared denoise pipeline, as MergedNote[] */
  offlineSegmentedNotes: Accessor<MergedNote[]>

  // ── Cleanup slider (re-segments the retained contour) ──────────
  /** 0 = as detected, 1 = strongly cleaned (key-snapped + quantized). */
  cleanupAmount: Accessor<number>
  setCleanupAmount: Setter<number>
  songKey: Accessor<string>
  setSongKey: Setter<string>
  songScale: Accessor<string>
  setSongScale: Setter<string>
  songBpm: Accessor<number>
  setSongBpm: Setter<number>
  /**
   * The singer typed a tempo into the BPM box: it wins over the estimate,
   * now and when the song is opened again.
   */
  typeSongBpm: (bpm: number) => void
  /** The song's tempo estimate; null until it has run, or when it found none. */
  tempoEstimate: Accessor<SongTempoEstimate | null>
  /** True once a contour has been captured this session (enables the slider). */
  contourReady: Accessor<boolean>

  // ── Detected key ───────────────────────────────────────────────
  /** Global detected key for the vocal, or null. */
  detectedKey: Accessor<KeyEstimate | null>
  /** Per-region detected keys (the song may modulate). */
  keyRegions: Accessor<KeyRegion[]>

  // ── Edit mode (manual note editing over the cleanup output) ────
  editMode: Accessor<boolean>
  setEditMode: Setter<boolean>
  /** Effective notes (base cleanup output with the edit layer applied), seconds. */
  editableNotes: Accessor<EditableNote[]>
  /** The original (algorithm) notes, before edits — for the 'original'/'both' view. */
  baseNotes: Accessor<EditableNote[]>
  /** Which layer to show: 'edited' (effective), 'original', or 'both'. */
  pitchView: Accessor<'edited' | 'original' | 'both'>
  setPitchView: Setter<'edited' | 'original' | 'both'>
  selectedNoteId: Accessor<string | null>
  setSelectedNoteId: Setter<string | null>
  deleteSelectedNote: () => void
  splitSelectedNote: () => void
  mergeSelectedWithNext: () => void
  undoEdit: () => void
  resetEdits: () => void
  hasEdits: Accessor<boolean>
  /** Drag editing: snapshot at start, re-derive on preview, finish on end. */
  beginEdit: () => void
  previewEdit: (
    note: EditableNote,
    patch: Partial<Pick<EditableNote, 'startBeat' | 'endBeat' | 'midi'>>,
  ) => void
  endEdit: () => void

  algorithm: Accessor<AnalysisAlgorithm>
  setAlgorithm: Setter<AnalysisAlgorithm>

  bufferSize: Accessor<number>
  setBufferSize: Setter<number>

  sensitivity: Accessor<number>
  setSensitivity: Setter<number>

  minConfidence: Accessor<number>
  setMinConfidence: Setter<number>

  minAmplitude: Accessor<number>
  setMinAmplitude: Setter<number>

  isAnalyzing: Accessor<boolean>
  progress: Accessor<number>
  /**
   * An analysis can run now: on a decoded vocal, or on a streamed one short
   * enough to gather. False while the song is still loading.
   */
  canAnalyse: Accessor<boolean>

  /**
   * One analysis at a time: asked again while one runs, this joins it and
   * reports as the first request asked.
   */
  runAnalysis: (
    options?: StemMixerPitchAnalysisRunOptions,
  ) => Promise<PitchAnalysisOutcome>
  /** Load cached pitch analysis from IndexedDB. Returns true if data was found. */
  loadCachedAnalysis: () => Promise<boolean>
}

export const useStemMixerPitchAnalysisController = (
  deps: StemMixerPitchAnalysisDeps,
): StemMixerPitchAnalysisController => {
  const [panelOpen, setPanelOpen] = createSignal(false)
  const [pitchSourceMode, setPitchSourceMode] = createSignal<
    'realtime' | 'offline'
  >('realtime')
  const [offlinePitchHistory, setOfflinePitchHistory] = createSignal<
    PitchNote[]
  >([])
  const [offlineMergedNotes, setOfflineMergedNotes] = createSignal<
    MergedNote[]
  >([])
  const [offlineSegmentedNotes, setOfflineSegmentedNotes] = createSignal<
    MergedNote[]
  >([])

  // Seeded from the pipeline's own defaults rather than from literals here,
  // so the panel opens on exactly what a caller that never opens the panel
  // (Karaoke Night's zen stage, a jam room) analyses with.
  const [algorithm, setAlgorithm] = createSignal<AnalysisAlgorithm>(
    VOCAL_ANALYSIS_DEFAULTS.algorithm,
  )
  const [bufferSize, setBufferSize] = createSignal(
    VOCAL_ANALYSIS_DEFAULTS.bufferSize,
  )
  const [sensitivity, setSensitivity] = createSignal(
    VOCAL_ANALYSIS_DEFAULTS.sensitivity,
  )
  const [minConfidence, setMinConfidence] = createSignal(
    VOCAL_ANALYSIS_DEFAULTS.minConfidence,
  )
  const [minAmplitude, setMinAmplitude] = createSignal(
    VOCAL_ANALYSIS_DEFAULTS.minAmplitude,
  )
  const [isAnalyzing, setIsAnalyzing] = createSignal(false)
  const [progress, setProgress] = createSignal(0)

  // Cleanup slider state.
  const [cleanupAmount, setCleanupAmount] = createSignal(
    VOCAL_ANALYSIS_DEFAULTS.cleanupAmount,
  )
  const [songKey, setSongKey] = createSignal(VOCAL_ANALYSIS_DEFAULTS.key)
  const [songScale, setSongScale] = createSignal(
    VOCAL_ANALYSIS_DEFAULTS.scaleType,
  )
  const [songBpm, setSongBpm] = createSignal(VOCAL_ANALYSIS_DEFAULTS.bpm)
  const [contourReady, setContourReady] = createSignal(false)

  // Edit-mode state. Notes are in SECONDS (EditableNote.startBeat == startSec).
  const [editMode, setEditMode] = createSignal(false)
  const [baseNotes, setBaseNotes] = createSignal<EditableNote[]>([])
  const [editLayer, setEditLayer] =
    createSignal<PitchEditLayer>(emptyEditLayer())
  const [selectedNoteId, setSelectedNoteId] = createSignal<string | null>(null)
  const hasEdits = createMemo(() => !isEditLayerEmpty(editLayer()))
  // Which layer to display: the edited (effective) notes, the original
  // (algorithm) notes, or both overlaid. The edit layer is always retained.
  const [pitchView, setPitchView] = createSignal<
    'edited' | 'original' | 'both'
  >('edited')
  // Snapshot stack for edit undo (separate from the editor's piano-roll undo).
  let editUndo: PitchEditLayer[] = []

  // Detected key (global) + per-region keys for the vocal.
  const [detectedKey, setDetectedKey] = createSignal<KeyEstimate | null>(null)
  const [keyRegions, setKeyRegions] = createSignal<KeyRegion[]>([])

  /** Krumhansl-Schmuckler key detection over the cleaned notes. Sets the global
   *  + per-region keys, and adopts the detected global key for the cleanup
   *  snapping (the user can still override via the picker). */
  const runKeyDetection = (notes: KeyNote[]): void => {
    if (notes.length === 0) {
      setDetectedKey(null)
      setKeyRegions([])
      return
    }
    const global = detectKeyFromNotes(notes)
    setDetectedKey(global)
    setKeyRegions(detectRegionalKeys(notes))
    if (global.confidence > 0) {
      setSongKey(global.keyName)
      setSongScale(global.scaleType)
    }
  }

  // Effective notes = the cleanup output (base) with manual edits applied.
  const editableNotes = createMemo(() =>
    applyEditLayer(baseNotes(), editLayer()),
  )

  // Retained raw per-frame contour (incl. unvoiced frames) so the slider can
  // re-segment cheaply without re-decoding audio. In-memory only this turn;
  // not persisted, so the slider is disabled after reload until re-run.
  let rawContour: OfflineSegmentSecondsFrame[] = []

  // ── Song tempo ────────────────────────────────────────────────
  // The BPM box starts at the default. Once per song the tempo is estimated
  // from the recording (song-tempo.ts), and a confident estimate fills the
  // box unless the singer has typed a tempo for this song, which always wins.
  // Both are stored with the analysis, so a song opened again is not
  // estimated again; the estimate waits until that stored analysis is read.
  const [tempoEstimate, setTempoEstimate] =
    createSignal<SongTempoEstimate | null>(null)
  const [typedBpm, setTypedBpm] = createSignal<number | undefined>(undefined)
  const [tempoStage, setTempoStage] = createSignal<
    'unread' | 'wanted' | 'estimating' | 'known' | 'failed'
  >('unread')
  const tempoAbort = new AbortController()
  onCleanup(() => tempoAbort.abort())

  /** Write a confident estimate into the box while it holds the default. */
  const fillTempo = (): void => {
    const estimate = tempoEstimate()
    if (estimate === null || estimate.confidence < CONFIDENT_TEMPO) return
    if (typedBpm() !== undefined) return
    if (songBpm() !== VOCAL_ANALYSIS_DEFAULTS.bpm) return
    // A contour analysed this session re-segments when the tempo changes,
    // under any edits on its notes. The estimate fills the box before an
    // analysis or while one runs (which then segments at it), never after.
    if (rawContour.length > 0) return
    setSongBpm(estimate.bpm)
  }

  /** What is stored of the tempo: only what is known. */
  const tempoRecord = (): SongTempoRecord => {
    const record: SongTempoRecord = {}
    if (tempoStage() === 'known') record.estimate = tempoEstimate()
    const typed = typedBpm()
    if (typed !== undefined) record.typedBpm = typed
    return record
  }

  /** The tempo stored with the song's analysis, read once as the song opens. */
  const readStoredTempo = (record: SongTempoRecord | undefined): void => {
    if (tempoStage() !== 'unread') return
    if (record?.typedBpm !== undefined) {
      setTypedBpm(record.typedBpm)
      setSongBpm(record.typedBpm)
    }
    if (record?.estimate !== undefined) {
      setTempoEstimate(record.estimate)
      setTempoStage('known')
      fillTempo()
    } else {
      setTempoStage('wanted')
    }
  }

  const estimateTempo = async (source: AudioBuffer): Promise<void> => {
    setTempoStage('estimating')
    const channels = Array.from({ length: source.numberOfChannels }, (_, c) =>
      source.getChannelData(c),
    )
    try {
      const estimate = await estimateSongTempo(
        channels,
        source.sampleRate,
        tempoAbort.signal,
      )
      setTempoEstimate(estimate)
      setTempoStage('known')
      fillTempo()
    } catch (error) {
      if (tempoAbort.signal.aborted) return
      console.warn('[PitchAnalysis] tempo estimate failed', error)
      setTempoStage('failed')
    }
  }

  createEffect(() => {
    if (tempoStage() !== 'wanted') return
    const source = deps.tempoSource?.() ?? null
    if (source !== null) void untrack(() => estimateTempo(source))
  })

  const typeSongBpm = (bpm: number): void => {
    setTypedBpm(bpm)
    setSongBpm(bpm)
  }

  const baseToEditable = (notes: MergedNote[]): EditableNote[] =>
    notes.map((m, i) => ({
      id: `base-${i}`,
      startBeat: m.startSec,
      endBeat: m.endSec,
      midi: m.midi,
    }))

  const editableToMerged = (notes: EditableNote[]): MergedNote[] =>
    notes.map((e) => {
      const info = midiToNote(e.midi)
      return {
        midi: e.midi,
        noteName: `${info.name}${info.octave}`,
        startSec: e.startBeat,
        endSec: e.endBeat,
      }
    })

  /** The denoise settings the panel currently has dialled in. */
  const denoiseOptions = () => ({
    bpm: songBpm(),
    key: songKey(),
    scaleType: songScale(),
    cleanupAmount: cleanupAmount(),
  })

  /** Run the denoise pipeline over a contour at the current cleanup settings. */
  const segmentContour = (
    contour: OfflineSegmentSecondsFrame[],
  ): MergedNote[] => segmentVocalContour(contour, denoiseOptions())

  /** Re-segment the retained contour at the current cleanup settings into the
   *  BASE note list. Cheap — no re-detection. Edits are reapplied reactively. */
  const resegment = (): MergedNote[] => {
    const segMerged = segmentContour(rawContour)
    setBaseNotes(baseToEditable(segMerged))
    return segMerged
  }

  // Live re-segment when the slider / key / scale / bpm change. Gated on the
  // (non-reactive) contour buffer so it no-ops before the first analysis and
  // doesn't double-run when analysis completes (which resegments explicitly).
  createEffect(() => {
    cleanupAmount()
    songKey()
    songScale()
    songBpm()
    if (rawContour.length > 0) {
      resegment()
    }
  })

  // Push the displayed notes to the canvas whenever the base regenerates, the
  // edit layer changes, or the view mode changes. 'original' shows the base;
  // 'edited'/'both' show the effective notes (the base ghost for 'both' is
  // drawn by the canvas).
  createEffect(() => {
    const notes = pitchView() === 'original' ? baseNotes() : editableNotes()
    const merged = editableToMerged(notes)
    setOfflineSegmentedNotes(merged)
    const history = pitchHistoryFromNotes(merged)
    setOfflinePitchHistory(history)
    deps.setPitchHistory(history)
  })

  // Debounced persistence: store the original (base) notes and the user's edit
  // layer separately so a reload can show original / edited / both.
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  const persistNow = (): void => {
    const sid = deps.sessionId
    if (sid == null || sid === '') return
    const base = baseNotes()
    if (base.length === 0) return
    void savePitchAnalysisToDb(sid, {
      mergedNotes: offlineMergedNotes(),
      segmentedNotes: editableToMerged(base),
      pitchHistory: pitchHistoryFromNotes(
        editableToMerged(applyEditLayer(base, editLayer())),
      ),
      editLayer: editLayer(),
      keyRegions: keyRegions(),
      tempo: tempoRecord(),
    })
  }
  createEffect(() => {
    baseNotes()
    editLayer()
    // A tempo estimated or typed after the analysis is stored with it too.
    tempoStage()
    tempoEstimate()
    typedBpm()
    if (deps.sessionId == null || deps.sessionId === '') return
    if (saveTimer !== null) clearTimeout(saveTimer)
    saveTimer = setTimeout(persistNow, 600)
  })

  // ── Edit operations ───────────────────────────────────────────
  const pushEditUndo = (): void => {
    editUndo.push(editLayer())
    if (editUndo.length > 100) editUndo.shift()
  }

  const deleteSelectedNote = (): void => {
    const id = selectedNoteId()
    if (id === null) return
    const note = editableNotes().find((n) => n.id === id)
    if (note === undefined) return
    pushEditUndo()
    setEditLayer(deleteNote(editLayer(), note))
    setSelectedNoteId(null)
  }

  const undoEdit = (): void => {
    const prev = editUndo.pop()
    if (prev === undefined) return
    setEditLayer(prev)
    setSelectedNoteId(null)
  }

  const resetEdits = (): void => {
    if (isEditLayerEmpty(editLayer())) return
    pushEditUndo()
    setEditLayer(emptyEditLayer())
    setSelectedNoteId(null)
  }

  const splitSelectedNote = (): void => {
    const id = selectedNoteId()
    if (id === null) return
    const note = editableNotes().find((n) => n.id === id)
    if (note === undefined) return
    pushEditUndo()
    setEditLayer(
      splitNote(editLayer(), note, (note.startBeat + note.endBeat) / 2),
    )
    setSelectedNoteId(null)
  }

  const mergeSelectedWithNext = (): void => {
    const id = selectedNoteId()
    if (id === null) return
    const notes = editableNotes()
    const note = notes.find((n) => n.id === id)
    if (note === undefined) return
    const next = notes
      .filter((n) => n.startBeat > note.startBeat)
      .sort((a, b) => a.startBeat - b.startBeat)[0]
    if (next === undefined) return
    pushEditUndo()
    setEditLayer(mergeNotes(editLayer(), note, next))
    setSelectedNoteId(null)
  }

  // Drag editing: snapshot the layer once at drag start (single undo step),
  // then re-derive the layer from that snapshot on each move so repeated
  // previews don't accumulate.
  let dragStartLayer: PitchEditLayer | null = null
  let dragUndoPushed = false
  const beginEdit = (): void => {
    dragStartLayer = editLayer()
    dragUndoPushed = false
  }
  const previewEdit = (note: EditableNote, patch: EditPatch): void => {
    if (dragStartLayer === null) return
    // Record undo only once the drag actually changes something (a plain click
    // that selects without moving leaves no undo entry).
    if (!dragUndoPushed) {
      pushEditUndo()
      dragUndoPushed = true
    }
    const next = editNote(dragStartLayer, note, patch)
    setEditLayer(next)
    // editNote appends the edited note; keep selection on it (its id changes
    // from base-* to m-* the first time a base note is touched).
    const added = next.manual[next.manual.length - 1]
    if (added !== undefined) setSelectedNoteId(added.id)
  }
  const endEdit = (): void => {
    dragStartLayer = null
  }

  /** The vocal's stream, when it is the one to analyse and can be gathered. */
  const gatherableStream = (): StreamedVocalSource | null => {
    const stream = deps.vocalStream?.() ?? null
    return stream !== null && canGatherStreamedVocal(stream) ? stream : null
  }
  const canAnalyse = (): boolean =>
    deps.vocalBuffer() !== null || gatherableStream() !== null

  const analyse = async (quiet: boolean): Promise<PitchAnalysisOutcome> => {
    const buffer = deps.vocalBuffer()
    const stream = buffer === null ? gatherableStream() : null
    if (!buffer && stream === null) {
      const message = 'No vocal stem loaded'
      if (!quiet) deps.showNotification(message, 'error')
      return { ok: false, message, shown: !quiet }
    }

    setIsAnalyzing(true)
    setProgress(0)

    try {
      // Decoded: channel 0 as it is. Streamed: channel 0 gathered from the
      // stream's chunks first, which is most of the wait on a phone, so it
      // takes the first part of the progress.
      const vocal =
        buffer !== null
          ? {
              samples: buffer.getChannelData(0),
              sampleRate: buffer.sampleRate,
              step: 1,
            }
          : await gatherStreamedVocal(stream!, {
              onProgress: (fraction) =>
                setProgress(Math.round(fraction * STREAM_WALK_SHARE)),
            })
      const from = buffer !== null ? 0 : STREAM_WALK_SHARE
      const settings = denoiseOptions()
      const { algo, mergedNotes, contour, segmentedNotes } =
        await analyzeVocalSamples(
          vocal.samples,
          vocal.sampleRate,
          {
            algorithm: algorithm(),
            // The same span of time at the rate the samples were kept at.
            bufferSize: windowForStep(bufferSize(), vocal.step),
            sensitivity: sensitivity(),
            minConfidence: minConfidence(),
            minAmplitude: minAmplitude(),
            ...settings,
          },
          {
            onProgress: (pct) =>
              setProgress(from + Math.round((pct * (100 - from)) / 100)),
          },
        )

      // Raw (un-cleaned) merged notes for reference.
      setOfflineMergedNotes(mergedNotes)

      // A fresh analysis is a new starting point -- drop edits from the old take.
      setEditLayer(emptyEditLayer())
      setSelectedNoteId(null)
      editUndo = []

      // Retain the contour so the slider can re-segment cheaply, and adopt
      // the cleaned notes the run already produced as the editable base --
      // re-segmenting here would run the same pure pass over the same frames
      // at the same settings for the same answer.
      rawContour = contour
      setContourReady(true)
      // The song's tempo estimate can land while the analysis runs, and the
      // run quantized at the tempo the box held when it started: segment the
      // contour again at the tempo it holds now.
      if (songBpm() !== settings.bpm) resegment()
      else setBaseNotes(baseToEditable(segmentedNotes))
      // Detect the key from the cleaned notes (MergedNote is KeyNote-shaped) and
      // adopt it for the cleanup snapping.
      runKeyDetection(segmentedNotes)
      console.log(
        `[PitchAnalysis] ${algo}: raw merged ${mergedNotes.length} notes, cleaned ${segmentedNotes.length} notes, key: ${detectedKey()?.keyName ?? '?'} ${detectedKey()?.scaleType ?? ''}`,
      )

      setPitchSourceMode('offline')
      if (!quiet) deps.showNotification(ANALYSIS_COMPLETE, 'success')

      // Persist to IndexedDB (cleaned result + history; contour not yet
      // persisted, so the slider is re-enabled only after a fresh run).
      if (deps.sessionId != null && deps.sessionId !== '') {
        void savePitchAnalysisToDb(deps.sessionId, {
          mergedNotes,
          segmentedNotes,
          pitchHistory: pitchHistoryFromNotes(segmentedNotes),
          editLayer: editLayer(),
          keyRegions: keyRegions(),
          tempo: tempoRecord(),
        })
      }
      return { ok: true }
    } catch (e) {
      console.error(e)
      const message = e instanceof Error ? e.message : 'Analysis failed'
      if (!quiet) deps.showNotification(message, 'error')
      return { ok: false, message, shown: !quiet }
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Two at once would race to write the same notes: the second request
  // waits for the first instead.
  //
  // A quiet run says nothing, because its caller reports the outcome in its
  // own message (Find my key). If Pitch Studio's Analyze joins it, the singer
  // asked for the analysis in their own right and is owed the answer: it is
  // said once, when the run settles, and every caller is told so (`shown`),
  // so Find my key does not say a failure again.
  let running: {
    result: Promise<PitchAnalysisOutcome>
    claim: () => void
  } | null = null

  const say = (outcome: PitchAnalysisOutcome): PitchAnalysisOutcome => {
    if (outcome.ok) {
      deps.showNotification(ANALYSIS_COMPLETE, 'success')
      return outcome
    }
    if (outcome.shown) return outcome
    deps.showNotification(outcome.message, 'error')
    return { ...outcome, shown: true }
  }

  const runAnalysis = (
    options: StemMixerPitchAnalysisRunOptions = {},
  ): Promise<PitchAnalysisOutcome> => {
    const quiet = options.quiet === true
    if (running !== null) {
      if (!quiet) running.claim()
      return running.result
    }
    let claimed = false
    const result = analyse(quiet)
      .then((outcome) => (quiet && claimed ? say(outcome) : outcome))
      .finally(() => {
        running = null
      })
    running = {
      result,
      claim: () => {
        claimed = true
      },
    }
    return result
  }

  const loadCachedAnalysis = async (): Promise<boolean> => {
    if (deps.sessionId == null || deps.sessionId === '') {
      readStoredTempo(undefined)
      return false
    }

    const data = await loadPitchAnalysisFromDb(deps.sessionId)
    readStoredTempo(data?.tempo)
    if (!data) return false
    if (data.mergedNotes.length === 0 && data.segmentedNotes.length === 0) {
      return false
    }

    setOfflineMergedNotes(data.mergedNotes)
    // Seed the editable base from the cached original notes and restore the
    // user's edit layer, so a reloaded session can show original / edited /
    // both. The display effect then feeds offlineSegmentedNotes + the history.
    setEditLayer(data.editLayer ?? emptyEditLayer())
    setSelectedNoteId(null)
    editUndo = []
    setBaseNotes(baseToEditable(data.segmentedNotes))
    // Restore detected keys for display (don't re-adopt the key — the loaded
    // notes are already the analysis-time result and the slider is disabled).
    setKeyRegions(data.keyRegions ?? [])
    setDetectedKey(
      data.segmentedNotes.length > 0
        ? detectKeyFromNotes(data.segmentedNotes)
        : null,
    )
    setPitchSourceMode('offline')

    return true
  }

  return {
    panelOpen,
    setPanelOpen,
    pitchSourceMode,
    setPitchSourceMode,
    offlinePitchHistory,
    offlineMergedNotes,
    offlineSegmentedNotes,
    cleanupAmount,
    setCleanupAmount,
    songKey,
    setSongKey,
    songScale,
    setSongScale,
    songBpm,
    setSongBpm,
    typeSongBpm,
    tempoEstimate,
    contourReady,
    detectedKey,
    keyRegions,
    editMode,
    setEditMode,
    editableNotes,
    baseNotes,
    pitchView,
    setPitchView,
    selectedNoteId,
    setSelectedNoteId,
    deleteSelectedNote,
    splitSelectedNote,
    mergeSelectedWithNext,
    undoEdit,
    resetEdits,
    hasEdits,
    beginEdit,
    previewEdit,
    endEdit,
    algorithm,
    setAlgorithm,
    bufferSize,
    setBufferSize,
    sensitivity,
    setSensitivity,
    minConfidence,
    setMinConfidence,
    minAmplitude,
    setMinAmplitude,
    isAnalyzing,
    progress,
    canAnalyse,
    runAnalysis,
    loadCachedAnalysis,
  }
}
