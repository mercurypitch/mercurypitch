// ============================================================
// PianoRollCanvas — Piano roll editor wrapper
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, onCleanup, onMount } from 'solid-js'
import './PianoRollEditor.css'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { AudioEngine } from '@/lib/audio-engine'
import { audioRegistry } from '@/lib/audio-registry'
import type { PlaybackState } from '@/lib/piano-roll'
import { PianoRollEditor } from '@/lib/piano-roll'
import { useConfirm } from '@/lib/use-confirm'
import { composeHintsVisible, gridLinesVisible, setComposeHintsVisible, setGridLinesVisible, } from '@/stores/settings-store'
import type { MelodyItem, MelodyKind, ScaleDegree } from '@/types'
import { AlertTriangle } from './icons'
import styles from './PianoRollCanvas.module.css'

interface PianoRollCanvasProps {
  melody: () => MelodyItem[]
  scale: () => ScaleDegree[]
  /** Editor preset — 'drums' swaps the rows for GM drum lanes. */
  kind?: () => MelodyKind
  /** Store scale type — keeps the editor's optimistic rebuilds and its
   *  toolbar Scale select aligned with scale changes made anywhere. */
  scaleType?: () => string
  bpm: () => number
  totalBeats: () => number
  playbackState: () => PlaybackState
  currentNoteIndex: () => number
  currentBeat: () => number
  countInBeats?: () => number
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
  /** Provisional notes captured live during recording (drawn dashed). */
  previewMelody?: () => MelodyItem[]
  /** Smoothed live pitch (fractional MIDI) for the recording needle. */
  liveMidi?: () => number | null
  // ── A-B loop (beats; 0 = unset). Drawn on the editor's ruler + grid; the
  //    ruler markers are draggable via onMoveLoopA/B. ──
  loopA?: () => number
  loopB?: () => number
  loopEnabled?: () => boolean
  onMoveLoopA?: (beat: number) => void
  onMoveLoopB?: (beat: number) => void
  /** Imperative bridge exposed once the editor is mounted. */
  onEditorReady?: (api: PianoRollEditorApi) => void
}

/** Minimal imperative surface other features (e.g. take-commit) need. */
export interface PianoRollEditorApi {
  /** Replace the melody as a single undoable step. */
  applyMelody: (melody: MelodyItem[]) => void
}

export const PianoRollCanvas: Component<PianoRollCanvasProps> = (props) => {
  let containerRef: HTMLDivElement | undefined
  let editor: PianoRollEditor | null = null
  let audioEngine: AudioEngine | null = null
  const confirm = useConfirm()

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
      onMoveLoopA: (beat) => props.onMoveLoopA?.(beat),
      onMoveLoopB: (beat) => props.onMoveLoopB?.(beat),
      onConfirm: (message, accept) =>
        confirm.request({
          title: 'Trim notes?',
          message,
          confirmLabel: 'Trim notes',
          confirmIcon: <AlertTriangle />,
          onConfirm: accept,
        }),
      // The toolbar grid button flips the persisted setting; the
      // gridLinesVisible effect below round-trips it into setShowGrid so
      // the toolbar, settings panel, and canvas always agree.
      onGridToggle: () => setGridLinesVisible(!gridLinesVisible()),
      // Same round-trip contract for the hover-hints toggle.
      onHoverHintsToggle: () => setComposeHintsVisible(!composeHintsVisible()),
    })
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

    // Imperative bridge for features that commit melodies through the editor's
    // undo history (e.g. keeping a recorded take as one undo step).
    const ed = editor
    props.onEditorReady?.({
      applyMelody: (melody) => ed.applyMelody(melody),
    })
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

  // Propagate the editor preset (melody rows vs drum lanes). On the way back
  // to melody, re-push the store scale: setScale ignores store updates while
  // drums are active, so the editor's rows could be stale otherwise.
  createEffect(() => {
    const k = props.kind?.() ?? 'melody'
    editor?.setKind(k)
    if (k === 'melody') {
      editor?.setScale(props.scale())
    }
  })

  // Propagate the hover-hints setting into the editor (and its toolbar
  // button state).
  createEffect(() => {
    editor?.setHoverHints(composeHintsVisible())
  })

  // Keep the editor's scale type in lockstep with the store, no matter
  // where it was changed (toolbar select, sidebar, scale builder).
  createEffect(() => {
    const st = props.scaleType?.()
    if (st != null && st !== '') editor?.syncScaleType(st)
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

  // Propagate count-in beats for precount visualization.
  // During count-in, the playhead is offset so it sweeps from the left
  // edge into the grid before playback starts.
  createEffect(() => {
    const ci = props.countInBeats?.() ?? 0
    // Only set during external playback when count-in is active
    if (props.playbackState() === 'playing') {
      editor?.setCountInBeats(ci)
    } else {
      editor?.setCountInBeats(0)
    }
  })

  // Propagate current beat for playhead drawing + active-note highlight.
  // This is THE driver of the editor's playhead — when currentBeat
  // updates from playbackController.on('beat'), updatePlaybackPosition
  // calls handleBeatUpdate -> drawWithPlayhead which redraws the canvas
  // with the new playhead position and the active note in green.
  createEffect(() => {
    const beat = props.currentBeat()
    editor?.updatePlaybackPosition(beat)
  })

  // Propagate waveform props for recording visualization
  createEffect(() => {
    editor?.setWaveformProps(
      props.isRecording ?? null,
      props.getWaveform ?? null,
    )
  })

  // Propagate the live recording preview: provisional note blocks (drawn
  // dashed) and the smoothed-pitch needle. These render on top of the grid
  // in the existing playback redraw without touching the committed melody or
  // its undo history.
  createEffect(() => {
    editor?.setPreviewNotes(props.previewMelody?.() ?? [])
  })
  createEffect(() => {
    editor?.setLiveMidi(props.liveMidi?.() ?? null)
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

  // Propagate grid visibility from settings
  createEffect(() => {
    editor?.setShowGrid(gridLinesVisible())
  })

  // Propagate the A-B loop region so the editor draws matching ruler/grid
  // markers (the loop itself runs on the shared PlaybackRuntime).
  createEffect(() => {
    editor?.setLoop(
      props.loopA?.() ?? 0,
      props.loopB?.() ?? 0,
      props.loopEnabled?.() ?? false,
    )
  })

  return (
    <div class={styles.pianoRollWrapper}>
      <div
        ref={containerRef}
        class={styles.pianoRollContainer}
        data-tour="compose.piano-roll"
      />
      <ConfirmDialog
        open={confirm.pending() !== null}
        title={confirm.pending()?.title ?? ''}
        message={confirm.pending()?.message ?? ''}
        confirmLabel={confirm.pending()?.confirmLabel}
        confirmIcon={confirm.pending()?.confirmIcon}
        onConfirm={confirm.accept}
        onCancel={confirm.cancel}
      />
    </div>
  )
}
