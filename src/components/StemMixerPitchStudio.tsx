import type { Component } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import { PITCH_VISUAL_COLORS } from '@/features/stem-mixer/pitch-canvas-visuals'
import type { EditableNote } from '@/features/stem-mixer/pitch-edit-model'
import { midiToNote } from '@/lib/scale-data'
import { CheckSmall, MusicNote, Pause, Play, SkipBack } from './icons'
import { StemMixerEditToolbar } from './StemMixerEditToolbar'
import styles from './StemMixerPitchStudio.module.css'

interface StemMixerPitchStudioProps {
  songTitle: string
  elapsed: number
  duration: number
  playing: boolean
  noteCount: number
  selectedNote: EditableNote | null
  pitchView: 'edited' | 'original' | 'both'
  setPitchView: (view: 'edited' | 'original' | 'both') => void
  hasEdits: boolean
  onDelete: () => void
  onSplit: () => void
  onMerge: () => void
  onUndo: () => void
  onReset: () => void
  onNudgePitch: (semitones: number) => void
  onPlayPause: () => void
  onSeekToStart: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  onDone: () => void
  formatTime: (seconds: number) => string
}

const formatDuration = (seconds: number): string =>
  `${Math.max(0, seconds).toFixed(2)}s`

export const StemMixerPitchStudio: Component<StemMixerPitchStudioProps> = (
  props,
) => {
  const selectedInfo = createMemo(() => {
    const selected = props.selectedNote
    if (selected === null) return null
    const pitch = midiToNote(selected.midi)
    return {
      label: `${pitch.name}${pitch.octave}`,
      start: formatDuration(selected.startBeat),
      end: formatDuration(selected.endBeat),
      length: formatDuration(selected.endBeat - selected.startBeat),
    }
  })

  return (
    <section
      class={styles.studio}
      data-testid="stem-mixer-pitch-studio"
      aria-label="Pitch Studio note editor"
      style={{
        '--pitch-reference': PITCH_VISUAL_COLORS.reference,
        '--pitch-user': PITCH_VISUAL_COLORS.singer,
      }}
    >
      <header class={styles.header}>
        <div class={styles.identity}>
          <span class={styles.mark} aria-hidden="true">
            <MusicNote />
          </span>
          <div>
            <p>Pitch Studio</p>
            <h2>{props.songTitle.replace(/\.[^.]+$/, '')}</h2>
          </div>
        </div>

        <div class={styles.legend} aria-label="Pitch layer legend">
          <span>
            <i class={styles.referenceSwatch} />
            Vocal reference
          </span>
          <span>
            <i class={styles.userSwatch} />
            Your voice
          </span>
        </div>

        <div class={styles.headerMeta}>
          <span>
            {props.formatTime(props.elapsed)} /{' '}
            {props.formatTime(props.duration)}
          </span>
          <span>{props.noteCount} notes</span>
          <button
            type="button"
            class={styles.done}
            onClick={() => props.onDone()}
          >
            <CheckSmall size={15} />
            Done editing
          </button>
        </div>
      </header>

      <aside class={styles.inspector} aria-label="Selected note inspector">
        <div class={styles.inspectorHeading}>
          <p>Inspector</p>
          <span>{selectedInfo() === null ? 'No selection' : 'Selected'}</span>
        </div>

        <Show
          when={selectedInfo()}
          fallback={
            <div class={styles.emptySelection}>
              <span class={styles.emptyGlyph}>N</span>
              <h3>Select a vocal note</h3>
              <p>
                Click an orange note to inspect it. Drag its center to move and
                retune; drag either edge to change its timing.
              </p>
            </div>
          }
        >
          {(note) => (
            <>
              <div class={styles.pitchReadout}>
                <span>Pitch</span>
                <strong>{note().label}</strong>
                <div class={styles.nudge}>
                  <button
                    type="button"
                    aria-label="Lower selected note one semitone"
                    onClick={() => props.onNudgePitch(-1)}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    aria-label="Raise selected note one semitone"
                    onClick={() => props.onNudgePitch(1)}
                  >
                    +
                  </button>
                </div>
              </div>
              <dl class={styles.noteFacts}>
                <div>
                  <dt>Start</dt>
                  <dd>{note().start}</dd>
                </div>
                <div>
                  <dt>End</dt>
                  <dd>{note().end}</dd>
                </div>
                <div>
                  <dt>Length</dt>
                  <dd>{note().length}</dd>
                </div>
              </dl>
              <p class={styles.selectionHint}>
                Drag vertically to retune by semitone. Horizontal movement
                changes timing without losing the selected octave.
              </p>
            </>
          )}
        </Show>

        <div class={styles.gestureMap}>
          <p>Canvas controls</p>
          <span>
            <kbd>Drag note</kbd>
            Move and retune
          </span>
          <span>
            <kbd>Drag edge</kbd>
            Resize timing
          </span>
          <span>
            <kbd>Wheel</kbd>
            Zoom around pointer
          </span>
          <span>
            <kbd>Esc</kbd>
            Finish editing
          </span>
        </div>
      </aside>

      <footer class={styles.commandDeck}>
        <div class={styles.transport} aria-label="Pitch Studio transport">
          <button
            type="button"
            aria-label="Return to start"
            title="Return to start"
            onClick={() => props.onSeekToStart()}
          >
            <SkipBack />
          </button>
          <button
            type="button"
            class={styles.play}
            aria-label={props.playing ? 'Pause playback' : 'Play track'}
            onClick={() => props.onPlayPause()}
          >
            {props.playing ? <Pause /> : <Play />}
          </button>
          <span>{props.formatTime(props.elapsed)}</span>
        </div>

        <StemMixerEditToolbar
          embedded
          showDone={false}
          pitchView={props.pitchView}
          setPitchView={props.setPitchView}
          hasEdits={props.hasEdits}
          hasSelection={props.selectedNote !== null}
          onDelete={props.onDelete}
          onSplit={props.onSplit}
          onMerge={props.onMerge}
          onUndo={props.onUndo}
          onReset={props.onReset}
          onDone={props.onDone}
        />

        <div class={styles.zoom} aria-label="Timeline zoom">
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => props.onZoomOut()}
          >
            −
          </button>
          <button
            type="button"
            class={styles.fit}
            onClick={() => props.onFit()}
          >
            Fit song
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => props.onZoomIn()}
          >
            +
          </button>
        </div>
      </footer>
    </section>
  )
}
