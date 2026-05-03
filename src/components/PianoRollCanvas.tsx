// ============================================================
// PianoRollCanvas — Piano roll editor wrapper
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, onCleanup, onMount } from 'solid-js'
import { AudioEngine } from '@/lib/audio-engine'
import { audioRegistry } from '@/lib/audio-registry'
import type { PlaybackState } from '@/lib/piano-roll'
import { PianoRollEditor } from '@/lib/piano-roll'
import type { MelodyItem, ScaleDegree } from '@/types'
import styles from './PianoRollCanvas.module.css'

interface PianoRollCanvasProps {
  melody: () => MelodyItem[]
  scale: () => ScaleDegree[]
  bpm: () => number
  totalBeats: () => number
  playbackState: () => PlaybackState
  currentNoteIndex: () => number
  currentBeat: () => number
  onMelodyChange: (melody: MelodyItem[]) => void
  onInstrumentChange?: (instrument: string) => void
  /** Called when the editor's internal playback state changes */
  onPlaybackStateChange?: (state: PlaybackState) => void
  isRecording?: () => boolean
  getWaveform?: () => Float32Array | null
  isPlaying?: () => boolean
  isPaused?: () => boolean
  isScrolling?: () => boolean
  targetPitch?: () => number | null
  noteAccuracyMap?: () => Map<number, number>
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
    // Register with typed audio registry so resetPlaybackState can stop it
    // without reading from window. (Phase 13 of refactor v3.)
    audioRegistry.register(audioEngine)
    // NOTE: window assignment kept for piano-roll.ts internals that still
    // read it. Removing those reads is part of a follow-up plan.
    ;(
      window as unknown as { pianoRollAudioEngine: typeof audioEngine }
    ).pianoRollAudioEngine = audioEngine

    editor = new PianoRollEditor({
      container: containerRef,
      onMelodyChange: props.onMelodyChange,
      onInstrumentChange: props.onInstrumentChange,
      onPlaybackStateChange: props.onPlaybackStateChange,
    })
    _onMelodyChange = props.onMelodyChange
    editor.setMelody(props.melody())
    editor.setScale(props.scale())
    editor.setBPM(props.bpm())
    editor.setTotalBeats(props.totalBeats())

    // Expose on window for debugging
    ;(window as unknown as { pianoRollEditor: typeof editor }).pianoRollEditor =
      editor
    ;(
      window as unknown as { pianoRollGenerateId: () => number }
    ).pianoRollGenerateId = () => Date.now()
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

  // Propagate playback state. The piano-roll editor draws its OWN
  // playhead and active-note highlight on its internal canvases via
  // drawWithPlayhead / drawGridWithPlayhead.
  //
  // CRITICAL: piano-roll's drawGridWithPlayhead/drawRulerWithPlayhead
  // call `getCurrentBeat()`, which has two branches:
  //   - if isExternalPlayback: return this.remoteBeat
  //   - else:                  return (now - playStartTime) / beatDur
  //
  // We drive the editor from the App-level playbackController via
  // updatePlaybackPosition(beat) which sets remoteBeat. So we MUST mark
  // playback as external — otherwise getCurrentBeat falls back to the
  // local-timer branch (with playStartTime never set) and draws the
  // playhead at a nonsense position (off the right edge), which looks
  // exactly like "playhead and triangle not visible during playback".
  //
  // If you ever need to re-investigate the editor playhead disappearing,
  // check in this order:
  //   1. piano-roll.ts: PianoRollEditor.getCurrentBeat() branch
  //   2. piano-roll.ts: drawGridWithPlayhead / drawRulerWithPlayhead
  //   3. updatePlaybackPosition() being called every beat
  //   4. setExternalPlayback(true) being set during playing/paused
  createEffect(() => {
    const state = props.playbackState()
    editor?.setExternalPlayback(state === 'playing' || state === 'paused')
    editor?.setPlaybackState(state)
  })

  // Propagate current note index
  createEffect(() => {
    editor?.setCurrentNote(props.currentNoteIndex())
  })

  // Propagate current beat for playhead drawing + active-note highlight.
  // This is THE driver of the editor's playhead — when currentBeat
  // updates from playbackController.on('beat'), updatePlaybackPosition
  // calls handleBeatUpdate -> drawWithPlayhead which redraws the canvas
  // with the new playhead position and the active note in green.
  createEffect(() => {
    const beat = props.currentBeat()
    if (beat >= 0) {
      editor?.updatePlaybackPosition(beat)
    }
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
    delete (window as unknown as { pianoRollEditor?: unknown }).pianoRollEditor
    delete (window as unknown as { pianoRollGenerateId?: () => number })
      .pianoRollGenerateId
    if (audioEngine) {
      audioRegistry.unregister(audioEngine)
      audioEngine.destroy()
    }
    delete (window as unknown as { pianoRollAudioEngine?: unknown })
      .pianoRollAudioEngine
  })

  return (
    <div class={styles.pianoRollWrapper}>
      <div ref={containerRef} class={styles.pianoRollContainer} />
    </div>
  )
}
