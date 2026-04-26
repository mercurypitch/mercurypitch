// ============================================================
// PianoRollCanvas — Piano roll editor wrapper
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, onCleanup, onMount } from 'solid-js'
import { AudioEngine } from '@/lib/audio-engine'
import type { PlaybackState } from '@/lib/piano-roll'
import { PianoRollEditor } from '@/lib/piano-roll'
import type { MelodyItem, ScaleDegree } from '@/types'

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
    ;(
      window as unknown as { pianoRollAudioEngine: typeof audioEngine }
    ).pianoRollAudioEngine = audioEngine

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

  // Subscribe to PlaybackRuntime events for external playback
  createEffect(() => {
    const playbackState = props.playbackState()

    if (typeof window !== 'undefined') {
      const win = window as unknown as {
        __playbackRuntime?: {
          on: (event: string, handler: (e: unknown) => void) => void
        }
      }
      const playbackRuntime = win.__playbackRuntime

      if (playbackRuntime) {
        // Subscribe to beat events (during actual melody playback)
        playbackRuntime.on('beat', (e: unknown) => {
          editor?.setRemoteBeat((e as { beat: number }).beat)
        })

        // Subscribe to count-in events (during precount phase)
        // This ensures playhead updates during count-in so it's visible
        playbackRuntime.on('countIn', (e: unknown) => {
          const countIn = (e as { countIn: number }).countIn
          // During count-in, playhead shows the remaining count-in beats
          // For example, with 4 count-in beats: 4 → 3 → 2 → 1 → 0
          editor?.setRemoteBeat(countIn)
        })

        // Subscribe to state events to manage external playback mode
        playbackRuntime.on('state', (e: unknown) => {
          if ((e as { state: string }).state === 'paused') {
            editor?.setExternalPlayback(false)
          }
        })
      }

      if (playbackRuntime && playbackState === 'playing') {
        // Enable external playback mode
        editor?.setExternalPlayback(true)
      } else {
        // Disable external playback mode
        editor?.setExternalPlayback(false)
      }

      // Cleanup on state change
      return () => {
        editor?.setExternalPlayback(false)
      }
    }
  })

  // Propagate playback state changes
  // Only propagate state when in editor tab (not from practice tab)
  createEffect(() => {
    // Only set editor state when currently showing editor view
    // Don't propagate practice tab's playback state to editor
    if (typeof window !== 'undefined') {
      const win = window as unknown as {
        __activeTab?: () => string
      }
      const activeTab = win.__activeTab?.() ?? 'editor'
      if (activeTab === 'editor') {
        editor?.setPlaybackState(props.playbackState())
      }
    } else {
      editor?.setPlaybackState(props.playbackState())
    }
  })

  // Propagate current note index
  createEffect(() => {
    editor?.setCurrentNote(props.currentNoteIndex())
  })

  // Propagate current beat for editor playback
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
    audioEngine?.destroy()
    delete (window as unknown as { pianoRollAudioEngine?: unknown })
      .pianoRollAudioEngine
  })

  return (
    <div class="piano-roll-wrapper">
      <div ref={containerRef} class="piano-roll-container" />
    </div>
  )
}
