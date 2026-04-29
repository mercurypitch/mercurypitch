import { createSignal, type Accessor } from 'solid-js'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { melodyStore } from '@/stores/melody-store'
import { midiToNote } from '@/lib/scale-data'
import * as uiStore from '@/stores/ui-store'
import type { MelodyItem, MelodyNote, NoteName, PitchResult } from '@/types'

export interface RecordingController {
  isRecording: Accessor<boolean>
  recordedMelody: Accessor<MelodyItem[]>
  handleRecordToggle: () => Promise<void>
  /** Called from the pitch animation loop. */
  processPitchFrame: (
    pitch: PitchResult | null,
    beat: number,
    isEditorPlaying: boolean,
  ) => void
  finalizeRecording: (endBeat: number) => void
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

  // Mutable state for the in-progress note buffer
  let silenceFrames = 0
  let currentNoteStartBeat = -1
  let currentNoteMidi = -1
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
    let finalRecordedItems = recordedMelody()
    if (currentNoteMidi > 0 && currentNoteStartBeat >= 0) {
      finalRecordedItems = [
        ...finalRecordedItems,
        makeRecordedNote(currentNoteMidi, currentNoteStartBeat, endBeat),
      ]
    }
    if (finalRecordedItems.length > 0) {
      melodyStore.setMelody(
        mergeRecordedItems(melodyStore.items(), finalRecordedItems),
      )
    }
    setRecordedMelody([])
    currentNoteMidi = -1
    currentNoteStartBeat = -1
    setIsRecording(false)
    audioEngine.setVolume(0.8)
    uiStore.setActiveTab('editor')
  }

  const handleRecordToggle = async (): Promise<void> => {
    if (isRecording()) {
      finalizeRecording(playbackRuntime.getCurrentBeat())
    } else {
      const micOk = await practiceEngine.startMic()
      if (!micOk) return
      setRecordedMelody([])
      currentNoteMidi = -1
      currentNoteStartBeat = -1
      silenceFrames = 0
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

    if (pitch && pitch.frequency > 0 && pitch.clarity >= 0.2) {
      const midi = Math.round(69 + 12 * Math.log2(pitch.frequency / 440))
      if (midi !== currentNoteMidi) {
        if (currentNoteMidi > 0 && currentNoteStartBeat >= 0) {
          setRecordedMelody((prev) => [
            ...prev,
            makeRecordedNote(currentNoteMidi, currentNoteStartBeat, beat),
          ])
        }
        currentNoteMidi = midi
        currentNoteStartBeat = beat
      }
      silenceFrames = 0
    } else {
      silenceFrames++
      if (silenceFrames >= 10 && currentNoteMidi > 0) {
        setRecordedMelody((prev) => [
          ...prev,
          makeRecordedNote(currentNoteMidi, currentNoteStartBeat, beat),
        ])
        currentNoteMidi = -1
        currentNoteStartBeat = -1
      }
    }
  }

  return {
    isRecording,
    recordedMelody,
    handleRecordToggle,
    processPitchFrame,
    finalizeRecording,
  }
}
