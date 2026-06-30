import type { Accessor, Setter } from 'solid-js'
import { createEffect, createSignal } from 'solid-js'
import { loadPitchAnalysisFromDb, savePitchAnalysisToDb, } from '@/db/services/session-pitch-analysis-service'
import type { MergedNote } from '@/lib/midi-generator'
import { mergeConsecutiveNotes, MIDI_NOTE_RANGE, WINDOW_STEP_SEC, } from '@/lib/midi-generator'
import { melodyItemsToMergedNotes } from '@/lib/note-display-utils'
import type { PitchAlgorithm } from '@/lib/pitch-detector'
import { PitchDetector } from '@/lib/pitch-detector'
import type { OfflineSegmentSecondsFrame } from '@/lib/pitch-pipeline'
import { segmentSecondsContourToMelody } from '@/lib/pitch-pipeline'
import { freqToMidi } from '@/lib/scale-data'
import type { PitchNote } from './types'

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

  // Retained raw per-frame contour (incl. unvoiced frames) so the slider can
  // re-segment cheaply without re-decoding audio. In-memory only this turn;
  // not persisted, so the slider is disabled after reload until re-run.
  let rawContour: OfflineSegmentSecondsFrame[] = []

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

  /** Re-segment the retained contour at the current cleanup settings and push
   *  the cleaned result to the canvas. Cheap — no re-detection. */
  const resegment = (): MergedNote[] => {
    const items = segmentSecondsContourToMelody(rawContour, {
      bpm: songBpm(),
      key: songKey(),
      scaleType: songScale(),
      cleanupAmount: cleanupAmount(),
      pipeline: COARSE_HOP_PIPELINE,
    })
    const segMerged = melodyItemsToMergedNotes(items, songBpm())
    setOfflineSegmentedNotes(segMerged)
    const history = buildHistoryFromNotes(segMerged)
    setOfflinePitchHistory(history)
    deps.setPitchHistory(history)
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

      // Retain the contour and run the shared denoise pipeline at the current
      // cleanup amount. The slider re-runs only this cheap step afterwards.
      rawContour = contour
      setContourReady(true)
      const segmentedMerged = resegment()
      console.log(
        `[PitchAnalysis] Raw merged: ${merged.length} notes, cleaned: ${segmentedMerged.length} notes`,
      )

      setPitchSourceMode('offline')
      deps.showNotification('Pitch analysis complete', 'success')

      // Persist to IndexedDB (cleaned result + history; contour not yet
      // persisted, so the slider is re-enabled only after a fresh run).
      if (deps.sessionId != null && deps.sessionId !== '') {
        void savePitchAnalysisToDb(deps.sessionId, {
          mergedNotes: merged,
          segmentedNotes: segmentedMerged,
          pitchHistory: offlinePitchHistory(),
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
    setOfflineSegmentedNotes(data.segmentedNotes)
    setOfflinePitchHistory(data.pitchHistory)
    setPitchSourceMode('offline')
    deps.setPitchHistory(data.pitchHistory)

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
