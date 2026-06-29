// ============================================================
// GuitarControlBar — bespoke glass control bar for the Guitar fretboard
// (non-3D) views, in the shared Singing-style. Placed in the panel via a
// static ControlOverlay (the 3D view keeps its own HUD controls). Controls:
// mic, transport, MIDI, note-labels, user-notes; collapsible tempo + volume.
// Controlled/presentational — all state threaded in by GuitarPage.
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { MicButton } from '@/components'
import styles from '@/components/shared/control-bar/control-bar.module.css'
import { IconClock, IconLabels, IconMidi, IconNotes, IconPause, IconPlay, IconStop, IconVolume, } from '@/components/shared/control-bar/icons'
import { NumberStepper } from '@/components/shared/control-bar/NumberStepper'
import { SlidersHorizontal } from '../icons'

interface GuitarControlBarProps {
  isPlaying: () => boolean
  isPaused: () => boolean
  onPlay: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  isCountingIn: () => boolean
  countInBeat: () => number
  volume: () => number
  onVolumeChange: (vol: number) => void
  bpm: () => number
  onBpmChange: (bpm: number) => void
  micActive: () => boolean
  onMicToggle: () => void
  midiConnected: () => boolean
  onMidiToggle: () => void
  showNoteLabels: () => boolean
  onToggleNoteLabels: () => void
  showUserNotes: () => boolean
  onToggleUserNotes: () => void
}

export const GuitarControlBar: Component<GuitarControlBarProps> = (props) => {
  const [pinned, setPinned] = createSignal(false)
  const stopped = () => !props.isPlaying() && !props.isPaused()

  return (
    <div class={styles.bar} data-testid="guitar-control-bar">
      <MicButton
        active={props.micActive()}
        onClick={props.onMicToggle}
        disabled={false}
      />

      {/* Transport */}
      <div class={styles.transport}>
        <Show when={stopped()}>
          <button
            type="button"
            class={`${styles.hero} ${styles.heroPlay}`}
            data-testid="play-btn"
            title="Play"
            aria-label="Play"
            onClick={() => void props.onPlay()}
          >
            <IconPlay />
          </button>
        </Show>
        <Show when={props.isPlaying()}>
          <button
            type="button"
            class={styles.hero}
            data-testid="pause-btn"
            title="Pause"
            aria-label="Pause"
            onClick={() => void props.onPause()}
          >
            <IconPause />
          </button>
        </Show>
        <Show when={props.isPaused()}>
          <button
            type="button"
            class={`${styles.hero} ${styles.heroPlay}`}
            data-testid="resume-btn"
            title="Resume"
            aria-label="Resume"
            onClick={() => void props.onResume()}
          >
            <IconPlay />
          </button>
        </Show>
        <button
          type="button"
          class={`${styles.btn} ${styles.stop}`}
          classList={{ [styles.btnDisabled]: stopped() }}
          data-testid="stop-btn"
          title="Stop"
          aria-label="Stop"
          disabled={stopped()}
          onClick={() => void props.onStop()}
        >
          <IconStop />
        </button>
      </div>

      {/* MIDI + note-labels + user-notes toggles */}
      <button
        type="button"
        class={styles.btn}
        classList={{ [styles.active]: props.midiConnected() }}
        aria-pressed={props.midiConnected()}
        title={
          props.midiConnected()
            ? 'Disconnect MIDI keyboard'
            : 'Connect MIDI keyboard'
        }
        aria-label="Toggle MIDI keyboard"
        onClick={() => props.onMidiToggle()}
      >
        <IconMidi />
      </button>
      <button
        type="button"
        class={styles.btn}
        classList={{ [styles.active]: props.showNoteLabels() }}
        aria-pressed={props.showNoteLabels()}
        title="Toggle note labels"
        aria-label="Toggle note labels"
        onClick={() => props.onToggleNoteLabels()}
      >
        <IconLabels />
      </button>
      <button
        type="button"
        class={styles.btn}
        classList={{ [styles.active]: props.showUserNotes() }}
        aria-pressed={props.showUserNotes()}
        title="Toggle your played notes"
        aria-label="Toggle your played notes"
        onClick={() => props.onToggleUserNotes()}
      >
        <IconNotes />
      </button>

      {/* Count-in badge */}
      <Show when={props.isCountingIn()}>
        <div id="countin-display" class={styles.countin}>
          {props.countInBeat()}
        </div>
      </Show>

      {/* Expand group — tempo / volume */}
      <div class={styles.moreWrap} classList={{ [styles.pinned]: pinned() }}>
        <button
          type="button"
          class={styles.btn}
          classList={{ [styles.active]: pinned() }}
          data-testid="guitar-more-toggle"
          title={pinned() ? 'Hide extra controls' : 'More controls'}
          aria-label={pinned() ? 'Hide extra controls' : 'More controls'}
          aria-expanded={pinned()}
          onClick={() => setPinned((v) => !v)}
        >
          <SlidersHorizontal />
        </button>

        <div class={styles.moreGroup}>
          {/* Tempo */}
          <div class={styles.field} data-testid="tempo-group">
            <IconClock />
            <div class={styles.numWrap}>
              <input
                id="bpm-input"
                class={styles.numInput}
                type="number"
                min="40"
                max="280"
                value={props.bpm()}
                aria-label="BPM"
                onInput={(e) =>
                  props.onBpmChange(
                    Math.max(
                      40,
                      Math.min(280, Number(e.currentTarget.value) || 40),
                    ),
                  )
                }
              />
              <NumberStepper
                value={props.bpm}
                min={40}
                max={280}
                onChange={props.onBpmChange}
              />
            </div>
            <input
              id="tempo"
              class={styles.slider}
              type="range"
              min="40"
              max="280"
              value={props.bpm()}
              aria-label="BPM slider"
              onInput={(e) => props.onBpmChange(Number(e.currentTarget.value))}
            />
          </div>

          {/* Volume */}
          <div class={styles.field}>
            <IconVolume />
            <input
              id="volume"
              class={styles.slider}
              type="range"
              min="0"
              max="80"
              value={props.volume()}
              aria-label="Volume"
              onInput={(e) =>
                props.onVolumeChange(Number(e.currentTarget.value))
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}
