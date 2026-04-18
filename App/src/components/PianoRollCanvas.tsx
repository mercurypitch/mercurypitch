// ============================================================
// PianoRollCanvas — Piano roll editor wrapper
// ============================================================

import type { Component} from 'solid-js';
import { createEffect,onCleanup, onMount } from 'solid-js'
import { AudioEngine } from '@/lib/audio-engine'
import type { PlaybackState } from '@/lib/piano-roll'
import { PianoRollEditor } from '@/lib/piano-roll'
import type { MelodyItem, PitchPerfectWindow,ScaleDegree  } from '@/types'

interface PianoRollCanvasProps {
  melody: () => MelodyItem[]
  scale: () => ScaleDegree[]
  bpm: () => number
  totalBeats: () => number
  playbackState: () => PlaybackState
  currentNoteIndex: () => number
  onMelodyChange: (melody: MelodyItem[]) => void
  onInstrumentChange?: (instrument: string) => void
  /** Called when the editor's internal playback state changes */
  onPlaybackStateChange?: (state: PlaybackState) => void
  isRecording?: () => boolean
  getWaveform?: () => Float32Array | null
}

export const PianoRollCanvas: Component<PianoRollCanvasProps> = (props) => {
  let containerRef: HTMLDivElement | undefined
  let editor: PianoRollEditor | null = null
  let _onMelodyChange: ((melody: MelodyItem[]) => void) | null = null
  let audioEngine: AudioEngine | null = null

  onMount(() => {
    if (!containerRef) return

    // Create and expose audio engine for piano roll playback
    audioEngine = new AudioEngine()
    ;(window as PitchPerfectWindow).pianoRollAudioEngine = audioEngine

    editor = new PianoRollEditor({
      container: containerRef,
      onInstrumentChange: props.onInstrumentChange,
      onPlaybackStateChange: props.onPlaybackStateChange,
    })
    _onMelodyChange = props.onMelodyChange
    editor.setMelody(props.melody())
    editor.setScale(props.scale())
    editor.setBPM(props.bpm())
    editor.setTotalBeats(props.totalBeats())

    // Expose on window for debugging
    ;(window as PitchPerfectWindow).pianoRollEditor = editor
    ;(window as PitchPerfectWindow).pianoRollGenerateId = () => Date.now()
  })

  // Propagate melody changes to the editor
  createEffect(() => {
    const m = props.melody()
    editor?.setMelody(m)
  })

  // Propagate scale changes
  createEffect(() => {
    const s = props.scale()
    editor?.setScale(s)
  })

  // Propagate BPM changes
  createEffect(() => {
    editor?.setBPM(props.bpm())
  })

  // Propagate total beats changes
  createEffect(() => {
    editor?.setTotalBeats(props.totalBeats())
  })

  // Propagate playback state changes
  createEffect(() => {
    editor?.setPlaybackState(props.playbackState())
  })

  // Propagate current note index
  createEffect(() => {
    editor?.setCurrentNote(props.currentNoteIndex())
  })

  // Propagate waveform props for recording visualization
  createEffect(() => {
    editor?.setWaveformProps(
      props.isRecording ?? null,
      props.getWaveform ?? null,
    )
  })

  onCleanup(() => {
    editor?.destroy()
    delete (window as PitchPerfectWindow).pianoRollEditor
    delete (window as PitchPerfectWindow).pianoRollGenerateId
    audioEngine?.destroy()
    delete (window as PitchPerfectWindow).pianoRollAudioEngine
  })

  return (
    <div class="piano-roll-wrapper">
      <div ref={containerRef} class="piano-roll-container" />
    </div>
  )
}
