import type { Accessor, Setter } from 'solid-js'
import { createSignal } from 'solid-js'
import { mergeConsecutiveNotes, MIDI_NOTE_RANGE, WINDOW_STEP_SEC, } from '@/lib/midi-generator'
import type { PitchAlgorithm } from '@/lib/pitch-detector'
import { PitchDetector } from '@/lib/pitch-detector'
import { freqToMidi } from '@/lib/scale-data'
import type { PitchNote } from './types'

export interface StemMixerPitchAnalysisDeps {
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
}

export const useStemMixerPitchAnalysisController = (
  deps: StemMixerPitchAnalysisDeps,
): StemMixerPitchAnalysisController => {
  const [panelOpen, setPanelOpen] = createSignal(false)
  const [algorithm, setAlgorithm] = createSignal<PitchAlgorithm>('yin')
  const [bufferSize, setBufferSize] = createSignal(1024)
  const [sensitivity, setSensitivity] = createSignal(7)
  const [minConfidence, setMinConfidence] = createSignal(0.3)
  const [minAmplitude, setMinAmplitude] = createSignal(0.02)
  const [isAnalyzing, setIsAnalyzing] = createSignal(false)
  const [progress, setProgress] = createSignal(0)

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

      // To avoid freezing UI completely
      const YIELD_BATCH = 50

      for (let i = 0; i < totalFrames; i++) {
        const offset = i * stepSamples
        const chunk = data.slice(offset, offset + bufferSize())
        const pitch = detector.detect(chunk)

        if (pitch.frequency > 0) {
          const midi = freqToMidi(pitch.frequency)
          if (midi >= MIDI_NOTE_RANGE.min && midi <= MIDI_NOTE_RANGE.max) {
            rawDetections.push({
              midi,
              noteName: pitch.noteName,
              timeSec: offset / sr + bufferSize() / sr / 2,
            })
          }
        }

        if (i % YIELD_BATCH === 0 && i > 0) {
          setProgress(Math.round((i / totalFrames) * 100))
          await new Promise((r) => setTimeout(r, 0))
        }
      }

      setProgress(100)

      const merged = mergeConsecutiveNotes(
        rawDetections,
        WINDOW_STEP_SEC + 0.05,
        0.05,
      )

      const newHistory: PitchNote[] = []
      // Convert merged notes back into a "history" format that canvas expects
      // We can just populate it densely or sparsely. Canvas expects a point per frame ideally,
      // but if we feed it merged notes, the canvas might need modification.
      // Wait! PitchCanvas uses mergeConsecutiveNotes on the history anyway!
      // See useStemMixerCanvasController: const vocalPills = mergeConsecutiveNotes(toDetections(deps.getPitchHistory()))
      // So if we just populate PitchNote for each merged note segment, it might work, or we can just populate the raw detection points.

      // Let's populate the raw points that passed the smoothing threshold:
      // Actually, just dumping rawDetections into history is what realtime does.
      // But we want to DENOISE it. So we use the merged notes to construct clean raw points:
      for (const n of merged) {
        const numPoints = Math.max(
          1,
          Math.floor((n.endSec - n.startSec) / WINDOW_STEP_SEC),
        )
        const freq = 440 * Math.pow(2, (n.midi - 69) / 12)
        for (let j = 0; j < numPoints; j++) {
          newHistory.push({
            time: n.startSec + j * WINDOW_STEP_SEC,
            noteName: n.noteName,
            frequency: freq,
            octave: parseInt(n.noteName.slice(-1)) || 4,
          })
        }
      }

      deps.setPitchHistory(newHistory)
      deps.showNotification('Pitch analysis complete', 'success')
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

  return {
    panelOpen,
    setPanelOpen,
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
  }
}
