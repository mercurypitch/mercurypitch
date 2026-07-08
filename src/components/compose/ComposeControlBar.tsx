// ============================================================
// ComposeControlBar — bespoke glass control bar for the Compose (melody
// editor) tab, in the shared Singing-style. Placed in the panel via a static
// ControlOverlay. Controls: mic, transport, record, mic-waveform, metronome,
// share; collapsible tempo / volume / speed. Transport + editor-specific bits
// are threaded in; BPM / mic-state / waveform read the shared stores (as the
// Singing bar does).
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { MicButton } from '@/components'
import styles from '@/components/shared/control-bar/control-bar.module.css'
import { IconClock, IconMetronome, IconPause, IconPlay, IconRecord, IconShare, IconSpeed, IconStop, IconVolume, IconWave, } from '@/components/shared/control-bar/icons'
import { LoopControls } from '@/components/shared/control-bar/LoopControls'
import { NumberStepper } from '@/components/shared/control-bar/NumberStepper'
import { SafeSelect } from '@/components/shared/SafeSelect'
import { bpm, micActive, micWaveVisible, setBpm, toggleMicWaveVisible, } from '@/stores'
import { SlidersHorizontal } from '../icons'

interface ComposeControlBarProps {
  isPlaying: () => boolean
  isPaused: () => boolean
  onPlay: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  volume: () => number
  onVolumeChange: (vol: number) => void
  speed: () => number
  onSpeedChange: (speed: number) => void
  metronomeEnabled: () => boolean
  onMetronomeToggle: () => void
  isRecording: () => boolean
  onRecordToggle: () => void
  onShareMelody: () => void
  onMicToggle: () => void
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

export const ComposeControlBar: Component<ComposeControlBarProps> = (props) => {
  const [pinned, setPinned] = createSignal(false)
  const stopped = () => !props.isPlaying() && !props.isPaused()

  return (
    <div class={styles.bar} data-testid="compose-control-bar">
      <MicButton
        active={micActive()}
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

      {/* Record */}
      <button
        type="button"
        id="record-btn"
        class={`${styles.btn} ${styles.stop}`}
        classList={{ [styles.active]: props.isRecording() }}
        data-testid="record-btn"
        title={
          props.isRecording() ? 'Stop recording' : 'Record audio to melody'
        }
        aria-label="Record"
        aria-pressed={props.isRecording()}
        onClick={() => props.onRecordToggle()}
      >
        <IconRecord />
      </button>

      {/* Mic waveform + metronome */}
      <button
        type="button"
        class={styles.btn}
        classList={{ [styles.active]: micWaveVisible() }}
        title="Toggle mic waveform"
        aria-label="Toggle mic waveform"
        aria-pressed={micWaveVisible()}
        onClick={toggleMicWaveVisible}
      >
        <IconWave />
      </button>
      <button
        type="button"
        class={styles.btn}
        data-testid="metronome-btn"
        classList={{ [styles.active]: props.metronomeEnabled() }}
        title="Toggle metronome"
        aria-label="Toggle metronome"
        onClick={() => props.onMetronomeToggle()}
      >
        <IconMetronome />
      </button>

      {/* A-B Loop controls */}
      <LoopControls
        loopEnabled={props.loopEnabled}
        loopA={props.loopA}
        loopB={props.loopB}
        onSetLoopA={props.onSetLoopA}
        onSetLoopB={props.onSetLoopB}
        onToggleLoop={props.onToggleLoop}
        onClearLoop={props.onClearLoop}
      />

      {/* Share */}
      <button
        type="button"
        class={styles.btn}
        data-tour="compose.share"
        title="Copy shareable link"
        aria-label="Copy shareable link"
        onClick={() => props.onShareMelody()}
      >
        <IconShare />
      </button>

      {/* Expand group — tempo / volume / speed */}
      <div class={styles.moreWrap} classList={{ [styles.pinned]: pinned() }}>
        <button
          type="button"
          class={styles.btn}
          classList={{ [styles.active]: pinned() }}
          data-testid="compose-more-toggle"
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
                value={bpm()}
                aria-label="BPM"
                onInput={(e) =>
                  setBpm(
                    Math.max(
                      40,
                      Math.min(280, Number(e.currentTarget.value) || 40),
                    ),
                  )
                }
              />
              <NumberStepper value={bpm} min={40} max={280} onChange={setBpm} />
            </div>
            <input
              id="tempo"
              class={styles.slider}
              type="range"
              min="40"
              max="280"
              value={bpm()}
              aria-label="BPM slider"
              onInput={(e) => setBpm(Number(e.currentTarget.value))}
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
        </div>
      </div>
    </div>
  )
}
