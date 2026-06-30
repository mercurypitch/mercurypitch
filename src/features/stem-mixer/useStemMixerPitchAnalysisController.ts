import type { Accessor, Setter } from 'solid-js'
import { createEffect, createMemo, createSignal } from 'solid-js'
import { loadPitchAnalysisFromDb, savePitchAnalysisToDb, } from '@/db/services/session-pitch-analysis-service'
import type { KeyEstimate, KeyNote, KeyRegion } from '@/lib/key-detection'
import { detectKeyFromNotes, detectRegionalKeys } from '@/lib/key-detection'
import type { MergedNote } from '@/lib/midi-generator'
import { mergeConsecutiveNotes, MIDI_NOTE_RANGE, WINDOW_STEP_SEC, } from '@/lib/midi-generator'
import { melodyItemsToMergedNotes } from '@/lib/note-display-utils'
import type { PitchAlgorithm } from '@/lib/pitch-detector'
import { PitchDetector } from '@/lib/pitch-detector'
import type { OfflineSegmentSecondsFrame } from '@/lib/pitch-pipeline'
import { segmentSecondsContourToMelody } from '@/lib/pitch-pipeline'
import { freqToMidi, midiToNote } from '@/lib/scale-data'
import type { EditableNote, PitchEditLayer } from './pitch-edit-model'
import { applyEditLayer, deleteNote, editNote, emptyEditLayer, isEditLayerEmpty, mergeNotes, splitNote, } from './pitch-edit-model'
import type { PitchNote } from './types'

/** Fields a drag edit may change. */
type EditPatch = Partial<Pick<EditableNote, 'startBeat' | 'endBeat' | 'midi'>>

// The pipeline's frame-count thresholds are tuned for the live ~10ms cadence;
// the stem-mixer detects at a coarse 100ms hop (WINDOW_STEP_SEC), so shrink the
// frame counts proportionally or notes won't register / break correctly.
const COARSE_HOP_PIPELINE = {
  note: {
    debounceFrames: 1,
    offsetFrames: 2,
    minHoldSec: 0.1,
    minNoteDurationSec: 0.12,
  },
  octave: { confirmFrames: 2 },
} as const

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

  algorithm: Accessor<PitchAlgorithm>
  setAlgorithm: Setter<PitchAlgorithm>

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

  const [algorithm, setAlgorithm] = createSignal<PitchAlgorithm>('yin')
  const [bufferSize, setBufferSize] = createSignal(1024)
  const [sensitivity, setSensitivity] = createSignal(7)
  const [minConfidence, setMinConfidence] = createSignal(0.3)
  const [minAmplitude, setMinAmplitude] = createSignal(0.02)
  const [isAnalyzing, setIsAnalyzing] = createSignal(false)
  const [progress, setProgress] = createSignal(0)

  // Cleanup slider state.
  const [cleanupAmount, setCleanupAmount] = createSignal(0.3)
  const [songKey, setSongKey] = createSignal('C')
  const [songScale, setSongScale] = createSignal('major')
  const [songBpm, setSongBpm] = createSignal(120)
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

  /** Build the canvas pitch-history points from a list of (cleaned) notes. */
  const buildHistoryFromNotes = (notes: MergedNote[]): PitchNote[] => {
    const history: PitchNote[] = []
    for (const n of notes) {
      const numPoints = Math.max(
        1,
        Math.floor((n.endSec - n.startSec) / WINDOW_STEP_SEC),
      )
      const freq = 440 * Math.pow(2, (n.midi - 69) / 12)
      for (let j = 0; j < numPoints; j++) {
        history.push({
          time: n.startSec + j * WINDOW_STEP_SEC,
          noteName: n.noteName,
          frequency: freq,
          octave: parseInt(n.noteName.slice(-1)) || 4,
        })
      }
    }
    return history
  }

  /** Re-segment the retained contour at the current cleanup settings into the
   *  BASE note list. Cheap — no re-detection. Edits are reapplied reactively. */
  const resegment = (): MergedNote[] => {
    const items = segmentSecondsContourToMelody(rawContour, {
      bpm: songBpm(),
      key: songKey(),
      scaleType: songScale(),
      cleanupAmount: cleanupAmount(),
      pipeline: COARSE_HOP_PIPELINE,
    })
    const segMerged = melodyItemsToMergedNotes(items, songBpm())
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
    const history = buildHistoryFromNotes(merged)
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
      pitchHistory: buildHistoryFromNotes(
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
      const data = buffer.getChannelData(0)
      const sr = buffer.sampleRate
      const detector = new PitchDetector({
        sampleRate: sr,
        bufferSize: bufferSize(),
        algorithm: algorithm(),
        sensitivity: sensitivity(),
        minConfidence: minConfidence(),
        minAmplitude: minAmplitude(),
      })

      const stepSamples = Math.floor(WINDOW_STEP_SEC * sr)
      const totalFrames =
        Math.floor((data.length - bufferSize()) / stepSamples) + 1

      if (totalFrames <= 0) {
        throw new Error('Buffer too short')
      }

      const rawDetections: {
        midi: number
        noteName: string
        timeSec: number
      }[] = []
      // Full per-frame contour incl. unvoiced frames (freq: null) — the pipeline
      // needs the silences to break held notes.
      const contour: OfflineSegmentSecondsFrame[] = []

      // To avoid freezing UI completely
      const YIELD_BATCH = 50

      for (let i = 0; i < totalFrames; i++) {
        const offset = i * stepSamples
        const chunk = data.slice(offset, offset + bufferSize())
        const pitch = detector.detect(chunk)
        const timeSec = offset / sr + bufferSize() / sr / 2

        const midi = pitch.frequency > 0 ? freqToMidi(pitch.frequency) : -1
        const inRange =
          midi >= MIDI_NOTE_RANGE.min && midi <= MIDI_NOTE_RANGE.max

        contour.push({
          timeSec,
          freq: inRange ? pitch.frequency : null,
          clarity: inRange ? pitch.clarity : 0,
        })
        if (inRange) {
          rawDetections.push({ midi, noteName: pitch.noteName, timeSec })
        }

        if (i % YIELD_BATCH === 0 && i > 0) {
          setProgress(Math.round((i / totalFrames) * 100))
          await new Promise((r) => setTimeout(r, 0))
        }
      }

      setProgress(100)

      // Raw (un-cleaned) merged notes for reference.
      const merged = mergeConsecutiveNotes(
        rawDetections,
        WINDOW_STEP_SEC + 0.05,
        0.05,
      )
      setOfflineMergedNotes(merged)

      // A fresh analysis is a new starting point — drop edits from the old take.
      setEditLayer(emptyEditLayer())
      setSelectedNoteId(null)
      editUndo = []

      // Retain the contour and run the shared denoise pipeline at the current
      // cleanup amount. The slider re-runs only this cheap step afterwards.
      rawContour = contour
      setContourReady(true)
      const segmentedMerged = resegment()
      // Detect the key from the cleaned notes (MergedNote is KeyNote-shaped) and
      // adopt it for the cleanup snapping.
      runKeyDetection(segmentedMerged)
      console.log(
        `[PitchAnalysis] Raw merged: ${merged.length} notes, cleaned: ${segmentedMerged.length} notes, key: ${detectedKey()?.keyName ?? '?'} ${detectedKey()?.scaleType ?? ''}`,
      )

      setPitchSourceMode('offline')
      deps.showNotification('Pitch analysis complete', 'success')

      // Persist to IndexedDB (cleaned result + history; contour not yet
      // persisted, so the slider is re-enabled only after a fresh run).
      if (deps.sessionId != null && deps.sessionId !== '') {
        void savePitchAnalysisToDb(deps.sessionId, {
          mergedNotes: merged,
          segmentedNotes: segmentedMerged,
          pitchHistory: buildHistoryFromNotes(segmentedMerged),
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
