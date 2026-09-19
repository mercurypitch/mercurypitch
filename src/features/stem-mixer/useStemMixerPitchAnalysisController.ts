import type { Accessor, Setter } from 'solid-js'
import { createEffect, createMemo, createSignal } from 'solid-js'
import { loadPitchAnalysisFromDb, savePitchAnalysisToDb, } from '@/db/services/session-pitch-analysis-service'
import type { KeyEstimate, KeyNote, KeyRegion } from '@/lib/key-detection'
import { detectKeyFromNotes, detectRegionalKeys } from '@/lib/key-detection'
import type { MergedNote } from '@/lib/midi-generator'
import type { AnalysisAlgorithm, OfflineSegmentSecondsFrame, } from '@/lib/pitch-pipeline'
import { analyzeVocalSamples, pitchHistoryFromNotes, segmentVocalContour, VOCAL_ANALYSIS_DEFAULTS, } from '@/lib/pitch-pipeline'
import { midiToNote } from '@/lib/scale-data'
import type { EditableNote, PitchEditLayer } from './pitch-edit-model'
import { applyEditLayer, deleteNote, editNote, emptyEditLayer, isEditLayerEmpty, mergeNotes, splitNote, } from './pitch-edit-model'
import type { PitchNote } from './types'

/** Fields a drag edit may change. */
type EditPatch = Partial<Pick<EditableNote, 'startBeat' | 'endBeat' | 'midi'>>

export interface StemMixerPitchAnalysisDeps {
  sessionId?: string
  vocalBuffer: Accessor<AudioBuffer | null>
  sampleRate: Accessor<number>
  setPitchHistory: (history: PitchNote[]) => void
  showNotification: (
    msg: string,
    type?: 'info' | 'success' | 'error' | 'warning',
  ) => void
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

  runAnalysis: () => Promise<void>
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
    })
  }
  createEffect(() => {
    baseNotes()
    editLayer()
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

  const runAnalysis = async () => {
    const buffer = deps.vocalBuffer()
    if (!buffer) {
      deps.showNotification('No vocal stem loaded', 'error')
      return
    }

    setIsAnalyzing(true)
    setProgress(0)

    try {
      const { algo, mergedNotes, contour, segmentedNotes } =
        await analyzeVocalSamples(
          buffer.getChannelData(0),
          buffer.sampleRate,
          {
            algorithm: algorithm(),
            bufferSize: bufferSize(),
            sensitivity: sensitivity(),
            minConfidence: minConfidence(),
            minAmplitude: minAmplitude(),
            ...denoiseOptions(),
          },
          { onProgress: setProgress },
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
      setBaseNotes(baseToEditable(segmentedNotes))
      // Detect the key from the cleaned notes (MergedNote is KeyNote-shaped) and
      // adopt it for the cleanup snapping.
      runKeyDetection(segmentedNotes)
      console.log(
        `[PitchAnalysis] ${algo}: raw merged ${mergedNotes.length} notes, cleaned ${segmentedNotes.length} notes, key: ${detectedKey()?.keyName ?? '?'} ${detectedKey()?.scaleType ?? ''}`,
      )

      setPitchSourceMode('offline')
      deps.showNotification('Pitch analysis complete', 'success')

      // Persist to IndexedDB (cleaned result + history; contour not yet
      // persisted, so the slider is re-enabled only after a fresh run).
      if (deps.sessionId != null && deps.sessionId !== '') {
        void savePitchAnalysisToDb(deps.sessionId, {
          mergedNotes,
          segmentedNotes,
          pitchHistory: pitchHistoryFromNotes(segmentedNotes),
          editLayer: editLayer(),
          keyRegions: keyRegions(),
        })
      }
    } catch (e) {
      console.error(e)
      deps.showNotification(
        e instanceof Error ? e.message : 'Analysis failed',
        'error',
      )
    } finally {
      setIsAnalyzing(false)
    }
  }

  const loadCachedAnalysis = async (): Promise<boolean> => {
    if (deps.sessionId == null || deps.sessionId === '') return false

    const data = await loadPitchAnalysisFromDb(deps.sessionId)
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
    runAnalysis,
    loadCachedAnalysis,
  }
}
