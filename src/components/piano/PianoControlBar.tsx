// ============================================================
// PianoControlBar — bespoke glass control bar for the Piano (falling-notes)
// tab, in the shared Singing-style. Sits inside a ControlOverlay on the
// falling-notes canvas. Primary cluster: mic, transport, play-mode (once /
// repeat), cycles, MIDI, note-labels. Collapsible "more": tempo, volume,
// speed, zoom. A controlled/presentational component — all state is threaded
// in by PianoPage from the falling-notes controller.
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { MicButton } from '@/components'
import styles from '@/components/shared/control-bar/control-bar.module.css'
import { IconClear, IconClock, IconLabels, IconLoopPoint, IconMidi, IconOnce, IconPause, IconPlay, IconRepeat, IconSpeed, IconStop, IconVolume, IconZoomIn, IconZoomOut, } from '@/components/shared/control-bar/icons'
import { NumberStepper } from '@/components/shared/control-bar/NumberStepper'
import { SafeSelect } from '@/components/shared/SafeSelect'
import { PLAYBACK_MODE_ONCE, PLAYBACK_MODE_REPEAT, } from '@/features/tabs/constants'
import type { PlaybackMode } from '@/types'
import { SlidersHorizontal } from '../icons'

interface PianoControlBarProps {
  isPlaying: () => boolean
  isPaused: () => boolean
  onPlay: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  playMode: () => PlaybackMode
  playModeChange: (mode: PlaybackMode) => void
  practiceCycles: () => number
  onCyclesChange: (cycles: number) => void
  currentCycle: () => number
  isCountingIn: () => boolean
  countInBeat: () => number
  volume: () => number
  onVolumeChange: (vol: number) => void
  speed: () => number
  onSpeedChange: (speed: number) => void
  bpm: () => number
  onBpmChange: (bpm: number) => void
  micActive: () => boolean
  onMicToggle: () => void
  midiConnected: () => boolean
  onMidiToggle: () => void
  showNoteLabels: () => boolean
  onToggleNoteLabels: () => void
  zoomPercent: () => number
  onZoomIn: () => void
  onZoomOut: () => void
  // A-B Loop
  loopEnabled: () => boolean
  loopA: () => number
  loopB: () => number
  onSetLoopA: () => void
  onSetLoopB: () => void
  onToggleLoop: () => void
  onClearLoop: () => void
}

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]

export const PianoControlBar: Component<PianoControlBarProps> = (props) => {
  const [pinned, setPinned] = createSignal(false)
  const stopped = () => !props.isPlaying() && !props.isPaused()

  return (
    <div class={styles.bar} data-testid="piano-control-bar">
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

      {/* Play mode (once / repeat) */}
      <div class={styles.segment} role="group" aria-label="Play mode">
        <button
          type="button"
          id="btn-once"
          data-testid="btn-once"
          class={styles.segBtn}
          classList={{
            [styles.active]: props.playMode() === PLAYBACK_MODE_ONCE,
          }}
          title="Play once"
          aria-label="Play once"
          onClick={() => props.playModeChange(PLAYBACK_MODE_ONCE)}
        >
          <IconOnce />
        </button>
        <button
          type="button"
          id="btn-repeat"
          data-testid="btn-repeat"
          class={styles.segBtn}
          classList={{
            [styles.active]: props.playMode() === PLAYBACK_MODE_REPEAT,
          }}
          title="Repeat loop"
          aria-label="Repeat loop"
          onClick={() => props.playModeChange(PLAYBACK_MODE_REPEAT)}
        >
          <IconRepeat />
        </button>
      </div>

      {/* Cycles — repeat mode only */}
      <Show when={props.playMode() === PLAYBACK_MODE_REPEAT}>
        <div class={styles.cyclesGroup}>
          <div class={styles.numWrap}>
            <input
              id="cycles"
              class={styles.cyclesInput}
              type="number"
              min="2"
              max="100"
              value={props.practiceCycles()}
              aria-label="Repeat cycles"
              onInput={(e) =>
                props.onCyclesChange(
                  Math.max(
                    2,
                    Math.min(100, Number(e.currentTarget.value) || 2),
                  ),
                )
              }
            />
            <NumberStepper
              value={props.practiceCycles}
              min={2}
              max={100}
              onChange={props.onCyclesChange}
            />
          </div>
          <span
            class={styles.cyclesProgress}
            data-testid="cycle-progress-value"
          >
            {props.currentCycle()}/{props.practiceCycles()}
          </span>
        </div>
      </Show>

      {/* MIDI + note-labels toggles */}
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

      {/* A-B Loop controls */}
      <button
        type="button"
        class={styles.btn}
        classList={{ [styles.active]: props.loopA() > 0 }}
        data-testid="loop-a-btn"
        title="Set loop start (A)"
        aria-label="Set loop start (A)"
        onClick={() => props.onSetLoopA()}
      >
        <IconLoopPoint label="A" set={props.loopA() > 0} />
      </button>
      <button
        type="button"
        class={styles.btn}
        classList={{ [styles.active]: props.loopB() > 0 }}
        data-testid="loop-b-btn"
        title="Set loop end (B)"
        aria-label="Set loop end (B)"
        onClick={() => props.onSetLoopB()}
      >
        <IconLoopPoint label="B" set={props.loopB() > 0} />
      </button>
      <Show when={props.loopA() > 0 && props.loopB() > 0}>
        <button
          type="button"
          class={styles.btn}
          classList={{ [styles.active]: props.loopEnabled() }}
          data-testid="loop-toggle-btn"
          title={props.loopEnabled() ? 'Disable loop' : 'Enable loop'}
          aria-label={props.loopEnabled() ? 'Disable loop' : 'Enable loop'}
          onClick={() => props.onToggleLoop()}
        >
          <IconRepeat />
        </button>
        <button
          type="button"
          class={styles.btn}
          data-testid="loop-clear-btn"
          title="Clear loop points"
          aria-label="Clear loop points"
          onClick={() => props.onClearLoop()}
        >
          <IconClear />
        </button>
      </Show>

      {/* Count-in badge */}
      <Show when={props.isCountingIn()}>
        <div id="countin-display" class={styles.countin}>
          {props.countInBeat()}
        </div>
      </Show>

      {/* Expand group — tempo / volume / speed / zoom */}
      <div class={styles.moreWrap} classList={{ [styles.pinned]: pinned() }}>
        <button
          type="button"
          class={styles.btn}
          classList={{ [styles.active]: pinned() }}
          data-testid="piano-more-toggle"
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

          {/* Speed */}
          <div class={styles.field}>
            <IconSpeed />
            <SafeSelect
              id="speed-select"
              class={styles.select}
              value={props.speed().toString()}
              aria-label="Playback speed"
              onChange={(e) =>
                props.onSpeedChange(parseFloat(e.currentTarget.value))
              }
            >
              <For each={SPEEDS}>
                {(s) => <option value={s.toString()}>{s}x</option>}
              </For>
            </SafeSelect>
          </div>

          {/* Zoom */}
          <div class={styles.field}>
            <button
              type="button"
              class={styles.btn}
              title="Zoom out"
              aria-label="Zoom out"
              onClick={() => props.onZoomOut()}
            >
              <IconZoomOut />
            </button>
            <span class={styles.cyclesProgress}>{props.zoomPercent()}%</span>
            <button
              type="button"
              class={styles.btn}
              title="Zoom in"
              aria-label="Zoom in"
              onClick={() => props.onZoomIn()}
            >
              <IconZoomIn />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
