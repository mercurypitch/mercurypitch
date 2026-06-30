import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'
import { TAB_COMPOSE } from '@/features/tabs/constants'
import type { AudioEngine } from '@/lib/audio-engine'
import type { RawPitchFrame } from '@/lib/pitch-pipeline'
import { createLivePitchPipeline } from '@/lib/pitch-pipeline'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { midiToNote } from '@/lib/scale-data'
import { melodyStore } from '@/stores/melody-store'
import * as uiStore from '@/stores/ui-store'
import type { MelodyItem, MelodyNote, NoteName, PitchResult } from '@/types'

/** The note currently being captured, before its boundary is committed. */
export interface ProvisionalNote {
  midi: number
  startBeat: number
}

/** A finished take awaiting the user's raw<->cleaned review before commit. */
export interface PendingTake {
  frames: RawPitchFrame[]
  endBeat: number
}

export interface RecordingController {
  isRecording: Accessor<boolean>
  recordedMelody: Accessor<MelodyItem[]>
  /** The note currently being held (for the live tracking preview). */
  provisionalNote: Accessor<ProvisionalNote | null>
  /** Smoothed live pitch (fractional MIDI) for the low-latency needle. */
  liveMidi: Accessor<number | null>
  /** A finished take awaiting review (cleanup slider), or null. */
  pendingTake: Accessor<PendingTake | null>
  handleRecordToggle: () => Promise<void>
  /** Called from the pitch animation loop. */
  processPitchFrame: (
    pitch: PitchResult | null,
    beat: number,
    isEditorPlaying: boolean,
  ) => void
  finalizeRecording: (endBeat: number) => void
  /** Merge the reviewed melody into the song and clear the pending take. */
  commitTake: (items: MelodyItem[]) => void
  /** Drop the pending take without committing. */
  discardTake: () => void
}

interface Deps {
  audioEngine: AudioEngine
  playbackRuntime: PlaybackRuntime
  practiceEngine: PracticeEngine
}

export function useRecordingController(deps: Deps): RecordingController {
  const { audioEngine, playbackRuntime, practiceEngine } = deps

  const [isRecording, setIsRecording] = createSignal(false)
  const [recordedMelody, setRecordedMelody] = createSignal<MelodyItem[]>([])
  const [provisionalNote, setProvisionalNote] =
    createSignal<ProvisionalNote | null>(null)
  const [liveMidi, setLiveMidi] = createSignal<number | null>(null)
  const [pendingTake, setPendingTake] = createSignal<PendingTake | null>(null)

  // Shared denoise + note-segmentation pipeline (octave correction, median +
  // One-Euro smoothing, hysteresis note on/off). Replaces the old per-frame
  // round-and-compare that fragmented held notes on every octave glitch.
  const pipeline = createLivePitchPipeline()
  // Raw per-frame contour retained for the take so the review slider can
  // re-segment it from gentle (as-sung) to strong (key-snapped + quantized).
  let rawFrames: RawPitchFrame[] = []
  let pendingNoteId = 0

  const makeRecordedNote = (
    midi: number,
    startBeat: number,
    endBeat: number,
  ): MelodyItem => {
    const note = midiToNote(midi)
    return {
      id: pendingNoteId++,
      note: {
        name: (note?.name ?? 'C') as NoteName,
        octave: note?.octave ?? 4,
        midi,
        freq: 440 * Math.pow(2, (midi - 69) / 12),
      } as MelodyNote,
      duration: Math.max(0.25, endBeat - startBeat),
      startBeat,
    }
  }

  const mergeRecordedItems = (
    existing: MelodyItem[],
    recorded: MelodyItem[],
  ): MelodyItem[] => {
    if (recorded.length === 0) return existing
    const overlapsRecorded = (item: MelodyItem): boolean => {
      const itemStart = item.startBeat
      const itemEnd = item.startBeat + item.duration
      return recorded.some((rec) => {
        const recStart = rec.startBeat
        const recEnd = rec.startBeat + rec.duration
        return itemStart < recEnd && itemEnd > recStart
      })
    }
    return [
      ...existing.filter((item) => !overlapsRecorded(item)),
      ...recorded,
    ].sort((a, b) => a.startBeat - b.startBeat)
  }

  const finalizeRecording = (endBeat: number): void => {
    pipeline.reset()
    const frames = rawFrames
    rawFrames = []
    setRecordedMelody([])
    setProvisionalNote(null)
    setLiveMidi(null)
    setIsRecording(false)
    audioEngine.setVolume(0.8)
    uiStore.setActiveTab(TAB_COMPOSE)
    // Hand the take to the review flow instead of committing immediately. The
    // App re-segments it at the chosen cleanup amount and calls commitTake.
    const hasVoiced = frames.some((f) => f.freq !== null && f.freq > 0)
    setPendingTake(hasVoiced ? { frames, endBeat } : null)
  }

  const commitTake = (items: MelodyItem[]): void => {
    if (items.length > 0) {
      const renumbered = items.map((item) => ({
        ...item,
        id: pendingNoteId++,
      }))
      melodyStore.setMelody(mergeRecordedItems(melodyStore.items(), renumbered))
    }
    setPendingTake(null)
  }

  const discardTake = (): void => {
    setPendingTake(null)
  }

  const handleRecordToggle = async (): Promise<void> => {
    if (isRecording()) {
      finalizeRecording(playbackRuntime.getCurrentBeat())
    } else {
      const micOk = await practiceEngine.startMic()
      if (!micOk) return
      pipeline.reset()
      rawFrames = []
      setPendingTake(null)
      setRecordedMelody([])
      setProvisionalNote(null)
      setLiveMidi(null)
      setIsRecording(true)
      audioEngine.setVolume(0)
    }
  }

  const processPitchFrame = (
    pitch: PitchResult | null,
    beat: number,
    isEditorPlaying: boolean,
  ): void => {
    if (!isRecording() || !isEditorPlaying) return

    const timeSec = performance.now() / 1000
    const freq = pitch !== null && pitch.frequency > 0 ? pitch.frequency : null
    const clarity = pitch?.clarity ?? 0
    rawFrames.push({ beat, timeSec, freq, clarity })

    const res = pipeline.push(freq, clarity, timeSec, beat)

    if (res.completed.length > 0) {
      setRecordedMelody((prev) => [
        ...prev,
        ...res.completed.map((c) =>
          makeRecordedNote(c.midi, c.startBeat, c.endBeat),
        ),
      ])
    }
    setProvisionalNote(res.open)
    setLiveMidi(res.smoothedMidi)
  }

  return {
    isRecording,
    recordedMelody,
    provisionalNote,
    liveMidi,
    pendingTake,
    handleRecordToggle,
    processPitchFrame,
    finalizeRecording,
    commitTake,
    discardTake,
  }
}
