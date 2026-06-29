// ============================================================
// SingingControlBar — bespoke, glass control bar for the Singing
// tab, mirroring the Guitar 3D HUD. Primary controls (mic, transport,
// mode, metronome, focus) are always visible; the value controls
// (tempo, volume, speed, rest) live in a group that expands on hover
// or when pinned. No divider rulers; sliders have no number boxes
// (except BPM); the mic-sensitivity control is gone (it's in the
// sidebar). Reuses the existing App handlers. Compose/Piano/Guitar
// each have their own bespoke bar in the same shared glass style.
//
// Preserves every e2e test-id the singing suite depends on:
//   play-btn, pause-btn, resume-btn, stop-btn, focus-btn,
//   metronome-btn, btn-once/repeat/session, tempo-group, bpm-input,
//   #tempo, speed-select, cycles, cycle-progress-value,
//   practice-sub-mode, countin-display, practice-header-bar,
//   plus btn-mic / btn-precount via MicButton / PrecCountButton.
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { MicButton } from '@/components'
import { PrecCountButton } from '@/components/PrecCountButton'
import styles from '@/components/shared/control-bar/control-bar.module.css'
import { IconAnchor, IconClock, IconFocus, IconMetronome, IconOnce, IconPause, IconPlay, IconRepeat, IconRest, IconSession, IconSpeed, IconStop, IconVolume, IconWave, } from '@/components/shared/control-bar/icons'
import { NumberStepper } from '@/components/shared/control-bar/NumberStepper'
import { SafeSelect } from '@/components/shared/SafeSelect'
import { PLAYBACK_MODE_ONCE, PLAYBACK_MODE_REPEAT, PLAYBACK_MODE_SESSION, } from '@/features/tabs/constants'
import { bpm, enterFocusMode, micActive, micWaveVisible, setBpm, settings, toggleMicWaveVisible, } from '@/stores'
import { setTonicAnchor } from '@/stores/settings-store'
import type { PracticeSubMode } from '@/types'
import type { PlaybackMode, SpacedRestMode } from '@/types'
import { SlidersHorizontal } from '../icons'

interface SingingControlBarProps {
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
  practiceSubMode: () => PracticeSubMode
  onPracticeSubModeChange: (mode: PracticeSubMode) => void
  spacedRestMode: () => SpacedRestMode
  onSpacedRestModeChange: (mode: SpacedRestMode) => void
  isCountingIn: () => boolean
  countInBeat: () => number
  metronomeEnabled: () => boolean
  onMetronomeToggle: () => void
  volume: () => number
  onVolumeChange: (vol: number) => void
  speed: number
  onSpeedChange: (speed: number) => void
  onMicToggle: () => void
}

// Glyphs + NumberStepper are shared across the per-tab bars — see
// @/components/shared/control-bar/{icons,NumberStepper}.

export const SingingControlBar: Component<SingingControlBarProps> = (props) => {
  const [pinned, setPinned] = createSignal(false)
  const stopped = () => !props.isPlaying() && !props.isPaused()

  return (
    <div class={styles.bar} data-testid="practice-header-bar">
      {/* Mic */}
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

      {/* Play mode (segmented) */}
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
        <button
          type="button"
          id="btn-session"
          data-testid="btn-session"
          class={styles.segBtn}
          classList={{
            [styles.active]: props.playMode() === PLAYBACK_MODE_SESSION,
          }}
          title="Practice session"
          aria-label="Practice session"
          onClick={() => props.playModeChange(PLAYBACK_MODE_SESSION)}
        >
          <IconSession />
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

      {/* Session sub-mode (session) / spaced rest (once) — kept next to the
          play-mode toggle since they're mode-related. */}
      <Show when={props.playMode() === PLAYBACK_MODE_SESSION}>
        <div class={styles.field}>
          <IconRest />
          <SafeSelect
            id="practice-sub-mode"
            class={styles.select}
            value={props.practiceSubMode()}
            aria-label="Session mode"
            onChange={(e) =>
              props.onPracticeSubModeChange(
                e.currentTarget.value as PracticeSubMode,
              )
            }
          >
            <option value="all">All Notes</option>
            <option value="random">Random (50%)</option>
            <option value="focus">Focus Errors</option>
            <option value="reverse">Reverse</option>
          </SafeSelect>
        </div>
      </Show>
      <Show when={props.playMode() === PLAYBACK_MODE_ONCE}>
        <div class={styles.field}>
          <IconRest />
          <SafeSelect
            id="spaced-rest-mode"
            class={styles.select}
            value={props.spacedRestMode()}
            aria-label="Spaced rest"
            onChange={(e) =>
              props.onSpacedRestModeChange(
                e.currentTarget.value as SpacedRestMode,
              )
            }
          >
            <option value="none">None</option>
            <option value="fourth">Fourth rest</option>
            <option value="half">Half rest</option>
            <option value="full">Full bar rest</option>
          </SafeSelect>
        </div>
      </Show>

      {/* Quick toggles: precount, anchor, metronome, wave */}
      <PrecCountButton />
      <button
        type="button"
        id="btn-anchor-tone"
        class={styles.btn}
        classList={{ [styles.active]: settings().tonicAnchor === true }}
        title="Anchor tone"
        aria-label="Anchor tone"
        onClick={() => setTonicAnchor(settings().tonicAnchor !== true)}
      >
        <IconAnchor />
      </button>
      <button
        type="button"
        class={styles.btn}
        classList={{ [styles.active]: props.metronomeEnabled() }}
        data-testid="metronome-btn"
        title="Toggle metronome"
        aria-label="Toggle metronome"
        onClick={() => props.onMetronomeToggle()}
      >
        <IconMetronome />
      </button>
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

      {/* Focus */}
      <button
        type="button"
        class={styles.btn}
        data-testid="focus-btn"
        title="Enter Focus Mode (minimal UI)"
        aria-label="Enter Focus Mode (minimal UI)"
        onClick={() => enterFocusMode()}
      >
        <IconFocus />
      </button>

      {/* Count-in badge */}
      <Show when={props.isCountingIn()}>
        <div id="countin-display" class={styles.countin}>
          {props.countInBeat()}
        </div>
      </Show>

      {/* Expand group — secondary controls (click the toggle to reveal).
          The sliders button lights up (.active) while the group is open, so
          it doubles as the open/closed indicator — no separate chevron. */}
      <div class={styles.moreWrap} classList={{ [styles.pinned]: pinned() }}>
        <button
          type="button"
          class={styles.btn}
          classList={{ [styles.active]: pinned() }}
          data-testid="singing-more-toggle"
          title={pinned() ? 'Hide extra controls' : 'More controls'}
          aria-label={pinned() ? 'Hide extra controls' : 'More controls'}
          aria-expanded={pinned()}
          onClick={() => setPinned((v) => !v)}
        >
          <SlidersHorizontal />
        </button>

        <div class={styles.moreGroup}>
          {/* Tempo (keeps the BPM number box + slider) */}
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

          {/* Volume (slider only) */}
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
              value={props.speed.toString()}
              aria-label="Playback speed"
              onChange={(e) =>
                props.onSpeedChange(parseFloat(e.currentTarget.value))
              }
            >
              <option value="0.25">0.25x</option>
              <option value="0.5">0.5x</option>
              <option value="0.75">0.75x</option>
              <option value="1">1x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="1.75">1.75x</option>
              <option value="2">2x</option>
            </SafeSelect>
          </div>
        </div>
      </div>
    </div>
  )
}
