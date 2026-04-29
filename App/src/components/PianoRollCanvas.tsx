// ============================================================
// PianoRollCanvas — Piano roll editor wrapper
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js'
import { AudioEngine } from '@/lib/audio-engine'
import { audioRegistry } from '@/lib/audio-registry'
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
  let wrapperRef: HTMLDivElement | undefined
  let editor: PianoRollEditor | null = null
  let _onMelodyChange: ((melody: MelodyItem[]) => void) | null = null
  let audioEngine: AudioEngine | null = null

  // Geometry of the inner .roll-grid-container, measured relative to the
  // outer .piano-roll-wrapper. Used to position the playhead overlay so it
  // starts at the LEFT EDGE of the actual grid (skipping the piano-keys
  // column) and runs the FULL HEIGHT of the grid (skipping the toolbar
  // and ruler bars).
  const [gridRect, setGridRect] = createSignal<{
    top: number
    left: number
    width: number
    height: number
  } | null>(null)

  const measureGrid = () => {
    if (!wrapperRef || !containerRef) return
    const grid = containerRef.querySelector(
      '.roll-grid-container',
    ) as HTMLElement | null
    if (!grid) return
    const wrapperRect = wrapperRef.getBoundingClientRect()
    const gridR = grid.getBoundingClientRect()
    setGridRect({
      top: gridR.top - wrapperRect.top,
      left: gridR.left - wrapperRect.left,
      width: gridR.width,
      height: gridR.height,
    })
  }

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

    // Measure on first paint and again on resize so the playhead overlay
    // tracks the grid position even after layout changes.
    requestAnimationFrame(measureGrid)
    const ro = new ResizeObserver(() => measureGrid())
    if (wrapperRef) ro.observe(wrapperRef)
    onCleanup(() => ro.disconnect())
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
    // Scale changes can resize the grid horizontally; re-measure.
    requestAnimationFrame(measureGrid)
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
  // Only propagate when actually in editor tab and playback is started from editor UI
  createEffect(() => {
    if (typeof window !== 'undefined') {
      const win = window as unknown as {
        __activeTab?: () => string
        __isExternalPlayback?: () => boolean
      }
      const activeTab = win.__activeTab?.() ?? 'editor'
      const isExternal = win.__isExternalPlayback?.() ?? false
      // Only propagate playback state when in editor tab and NOT in external playback mode
      // This ensures editor has its own independent playback state
      if (activeTab === 'editor' && !isExternal) {
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
    if (audioEngine) {
      audioRegistry.unregister(audioEngine)
      audioEngine.destroy()
    }
    delete (window as unknown as { pianoRollAudioEngine?: unknown })
      .pianoRollAudioEngine
  })

  // Position-aware playhead overlay (Solid-rendered, mirrors the look of
  // the practice tab's playhead — vertical line + triangle marker on top).
  // The line is bound to the .roll-grid-container's left edge and width
  // so it spans only the actual grid (not the piano keys column or the
  // ruler/toolbar above it).
  const isActive = () =>
    props.playbackState() === 'playing' || props.playbackState() === 'paused'

  const playheadLeft = () => {
    const rect = gridRect()
    if (!rect) return 0
    const total = props.totalBeats()
    if (total <= 0) return rect.left
    const beat = Math.max(0, Math.min(total, props.currentBeat()))
    return rect.left + (beat / total) * rect.width
  }

  return (
    <div
      ref={wrapperRef}
      class="piano-roll-wrapper"
      style={{ position: 'relative' }}
    >
      <div ref={containerRef} class="piano-roll-container" />

      <Show when={isActive() && gridRect() !== null}>
        <div
          id="editor-playhead"
          class="editor-playhead"
          style={{
            position: 'absolute',
            left: `${playheadLeft()}px`,
            top: `${gridRect()!.top}px`,
            height: `${gridRect()!.height}px`,
            width: '2px',
            'pointer-events': 'none',
            'z-index': '50',
          }}
        >
          {/* Triangle marker at top of the line, matching practice tab */}
          <div class="editor-playhead-marker" />
        </div>
      </Show>
    </div>
  )
}
