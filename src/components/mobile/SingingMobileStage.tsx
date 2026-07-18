// ============================================================
// SingingMobileStage — the phone-first Singing surface (Phase 1).
// ============================================================
//
// Rendered by App INSTEAD of the desktop #practice-panel on isNarrow()
// viewports (same swap pattern as StemMixer→KaraokeMobileStage; engines
// and playback state live in App/EngineContext above the branch, so
// rotation never restarts audio). Not a StageShell overlay: this stage
// lives in the normal tab flow WITH the BottomTabBar visible below it.
//
// Scope is decision D4 — the core loop on screen (mic, transport, mode,
// song picker, live feedback) plus ONE options sheet (Setup / Playback /
// Guides). Everything else stays desktop-only for now, advertised by the
// DesktopHint. Key/scale/octave/precount reuse the same store paths the
// sidebar uses; App-scope playback handlers arrive as props.

import type { Component, JSX } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { DesktopHint } from '@/components/mobile/DesktopHint'
import { MicSparkleIcon, PauseIcon, PlayIcon } from '@/components/mobile/icons'
import { OptionRow, OptionSection, OptionsSheet, } from '@/components/mobile/OptionsSheet'
import { Scrubber } from '@/components/mobile/Scrubber'
import { TransportBar } from '@/components/mobile/TransportBar'
import { PrecCountButton } from '@/components/PrecCountButton'
import { MidiSongSelectModal } from '@/components/shared/MidiSongSelectModal'
import { MidiTrackPickerModal } from '@/components/shared/MidiTrackPickerModal'
import { PLAYBACK_MODE_ONCE, PLAYBACK_MODE_REPEAT, PLAYBACK_MODE_SESSION, } from '@/features/tabs/constants'
import { haptics } from '@/lib/haptics'
import { KEY_OFFSETS } from '@/lib/scale-data'
import type { MidiSongPicker } from '@/lib/use-midi-song-picker'
import { bpm, getCurrentSessionItem, keyName, practiceSession, scaleType, sessionActive, setBpm, setKeyName, setScaleType, } from '@/stores'
import { melodyStore } from '@/stores/melody-store'
import { savedMidiSongs } from '@/stores/saved-midi-songs-store'
import type { PlaybackMode } from '@/types'
import styles from './SingingMobileStage.module.css'

export interface SingingMobileStageProps {
  // Song / melody picker (the stage hosts the modals itself — the desktop
  // host, SingingStatusBar, is unmounted on narrow viewports)
  picker: MidiSongPicker

  // Progress (in beats — the Scrubber is unit-agnostic)
  currentBeat: () => number
  totalBeats: () => number
  onSeekBeat: (beat: number) => void

  // Canvas + insight hint factories: each mount creates a fresh instance
  // inside this branch (canvases must not be re-parented across branches).
  renderCanvas: () => JSX.Element
  renderMicHint?: () => JSX.Element

  // Live HUD
  liveScore: () => number | null
  targetNoteName: () => string | null

  // Mic
  micActive: () => boolean
  onMicToggle: () => void

  // Transport
  isPlaying: () => boolean
  isPaused: () => boolean
  onPlay: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  isCountingIn: () => boolean
  countInBeat: () => number

  // Mode
  playMode: () => PlaybackMode
  onPlayModeChange: (m: PlaybackMode) => void

  // Session cluster (visibility/label read store-direct, like the
  // desktop status bar does; only the actions are App closures)
  onSessionSkip: () => void
  onSessionEnd: () => void

  // Options sheet — App-scope playback settings (bpm/key/scale/octave
  // read the stores directly, matching the sidebar's wiring)
  speed: () => number
  onSpeedChange: (v: number) => void
  volume: () => number
  onVolumeChange: (v: number) => void
  metronomeEnabled: () => boolean
  onMetronomeToggle: () => void
  onOctaveShift: (delta: number) => void
  onAutoCalibrate: () => void
}

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]

export const SingingMobileStage: Component<SingingMobileStageProps> = (
  props,
) => {
  const [optionsOpen, setOptionsOpen] = createSignal(false)

  const playPauseLabel = (): string =>
    props.isPlaying() ? 'Pause' : props.isPaused() ? 'Resume' : 'Play'

  const onPlayPause = (): void => {
    haptics.tapLight()
    if (props.isPlaying()) props.onPause()
    else if (props.isPaused()) props.onResume()
    else props.onPlay()
  }

  const changeKey = (newKey: string): void => {
    setKeyName(newKey)
    melodyStore.refreshScale(
      newKey,
      melodyStore.getCurrentOctave(),
      scaleType(),
    )
  }

  const changeScale = (st: string): void => {
    setScaleType(st)
    melodyStore.refreshScale(keyName(), melodyStore.getCurrentOctave(), st)
  }

  const songName = (): string =>
    melodyStore.currentMelody()?.name ?? 'Pick a song'

  const modeLabel = (m: PlaybackMode): string =>
    m === PLAYBACK_MODE_ONCE
      ? 'Once'
      : m === PLAYBACK_MODE_REPEAT
        ? 'Repeat'
        : 'Session'

  return (
    <div class={styles.stage} data-testid="singing-mobile-stage">
      {/* ── Status chips ─────────────────────────────────── */}
      <div class={styles.chips} data-tour="singing-mobile-chips">
        <button
          class={styles.chip}
          onClick={() => setOptionsOpen(true)}
          aria-label="Key, scale and playback options"
        >
          {keyName()} {scaleType() === 'major' ? 'Major' : 'Minor'} · {bpm()}{' '}
          BPM
        </button>
        <button
          classList={{ [styles.chip]: true, [styles.chipAccent]: true }}
          onClick={() => props.picker.setIsModalOpen(true)}
          aria-label="Choose a song"
          data-tour="singing-songs"
        >
          {songName()}
        </button>
      </div>

      {/* ── Progress strip (beats; A-B loops stay on desktop) ── */}
      <Scrubber
        class={styles.progress}
        value={props.currentBeat()}
        duration={props.totalBeats()}
        onSeek={props.onSeekBeat}
      />

      {/* ── Canvas ───────────────────────────────────────── */}
      <div class={styles.canvasWrap} data-stage-canvas>
        {props.renderCanvas()}
        {props.renderMicHint?.()}
        <div class={styles.hud} aria-hidden="true">
          <Show
            when={
              (props.isPlaying() || props.isPaused()) &&
              props.liveScore() !== null
            }
          >
            <span class={styles.hudChip}>
              {Math.round(props.liveScore() ?? 0)}%
            </span>
          </Show>
          <Show when={props.targetNoteName()}>
            <span class={styles.hudChip}>♪ {props.targetNoteName()}</span>
          </Show>
        </div>
      </div>

      {/* ── Session cluster (slim pill) ──────────────────── */}
      <Show when={sessionActive()}>
        <div class={styles.sessionPill}>
          <span class={styles.sessionLabel}>
            {getCurrentSessionItem()?.label ??
              practiceSession()?.name ??
              'Session'}
          </span>
          <button
            class={styles.sessionBtn}
            onClick={() => props.onSessionSkip()}
          >
            Skip
          </button>
          <button
            classList={{
              [styles.sessionBtn]: true,
              [styles.sessionEnd]: true,
            }}
            onClick={() => props.onSessionEnd()}
          >
            End
          </button>
        </div>
      </Show>

      {/* ── Transport ────────────────────────────────────── */}
      <TransportBar class={styles.transport}>
        <button
          classList={{
            [styles.roundBtn]: true,
            [styles.micBtn]: true,
            [styles.micOn]: props.micActive(),
          }}
          onClick={() => {
            haptics.tapLight()
            props.onMicToggle()
          }}
          title={props.micActive() ? 'Stop the mic' : 'Start the mic'}
          aria-label={props.micActive() ? 'Stop the mic' : 'Start the mic'}
          aria-pressed={props.micActive()}
          data-tour="singing-transport"
        >
          <MicSparkleIcon size={19} />
        </button>

        <button
          classList={{ [styles.roundBtn]: true, [styles.playBtn]: true }}
          onClick={onPlayPause}
          title={playPauseLabel()}
          aria-label={playPauseLabel()}
        >
          <Show when={props.isPlaying()} fallback={<PlayIcon size={26} />}>
            <PauseIcon size={26} />
          </Show>
        </button>

        <Show when={props.isPlaying() || props.isPaused()}>
          <button
            classList={{ [styles.roundBtn]: true, [styles.stopBtn]: true }}
            onClick={() => props.onStop()}
            title="Stop"
            aria-label="Stop"
          >
            <span class={styles.stopGlyph} />
          </button>
        </Show>

        <button
          class={styles.modeBtn}
          onClick={() => {
            const order: PlaybackMode[] = [
              PLAYBACK_MODE_ONCE,
              PLAYBACK_MODE_REPEAT,
              PLAYBACK_MODE_SESSION,
            ]
            const next =
              order[(order.indexOf(props.playMode()) + 1) % order.length]
            props.onPlayModeChange(next)
          }}
          title="Play mode"
          aria-label={`Play mode: ${modeLabel(props.playMode())}. Tap to change`}
        >
          {modeLabel(props.playMode())}
        </button>

        <button
          classList={{ [styles.roundBtn]: true, [styles.moreBtn]: true }}
          onClick={() => setOptionsOpen(true)}
          title="Practice options"
          aria-label="Practice options"
          data-tour="singing-options"
        >
          <span class={styles.moreGlyph}>
            <i />
            <i />
            <i />
          </span>
        </button>

        <Show when={props.isCountingIn()}>
          <span class={styles.countBadge}>{props.countInBeat()}</span>
        </Show>
      </TransportBar>

      {/* ── The one options sheet (D4) ───────────────────── */}
      <OptionsSheet
        isOpen={optionsOpen()}
        close={() => setOptionsOpen(false)}
        ariaLabel="Practice options"
      >
        <OptionSection label="Setup">
          <OptionRow label="Key">
            <select
              class="dropdown-select-style"
              value={keyName()}
              onChange={(e) => changeKey(e.currentTarget.value)}
            >
              <For each={Object.keys(KEY_OFFSETS)}>
                {(k) => <option value={k}>{k}</option>}
              </For>
            </select>
          </OptionRow>
          <OptionRow label="Scale">
            <select
              class="dropdown-select-style"
              value={scaleType()}
              onChange={(e) => changeScale(e.currentTarget.value)}
            >
              <option value="major">Major</option>
              <option value="natural-minor">Minor (Natural)</option>
              <option value="harmonic-minor">Harmonic Minor</option>
              <option value="melodic-minor">Melodic Minor</option>
            </select>
          </OptionRow>
          <OptionRow label="Octave">
            <button
              class={styles.stepBtn}
              onClick={() => props.onOctaveShift(-1)}
              aria-label="Octave down"
            >
              −
            </button>
            <span class={styles.stepValue}>
              {melodyStore.getCurrentOctave()}
            </span>
            <button
              class={styles.stepBtn}
              onClick={() => props.onOctaveShift(1)}
              aria-label="Octave up"
            >
              +
            </button>
          </OptionRow>
        </OptionSection>

        <OptionSection label="Playback">
          <OptionRow label={`Tempo ${bpm()} BPM`}>
            <input
              type="range"
              min="40"
              max="220"
              step="1"
              value={bpm()}
              onInput={(e) => setBpm(Number(e.currentTarget.value))}
            />
          </OptionRow>
          <OptionRow label="Speed">
            <select
              class="dropdown-select-style"
              value={String(props.speed())}
              onChange={(e) =>
                props.onSpeedChange(Number(e.currentTarget.value))
              }
            >
              <For each={SPEEDS}>
                {(s) => <option value={String(s)}>{s}×</option>}
              </For>
            </select>
          </OptionRow>
          <OptionRow label={`Volume ${props.volume()}%`}>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={props.volume()}
              onInput={(e) =>
                props.onVolumeChange(Number(e.currentTarget.value))
              }
            />
          </OptionRow>
          <OptionRow label="Precount">
            <PrecCountButton />
          </OptionRow>
          <OptionRow label="Metronome">
            <button
              classList={{
                [styles.toggle]: true,
                [styles.toggleOn]: props.metronomeEnabled(),
              }}
              onClick={() => props.onMetronomeToggle()}
              role="switch"
              aria-checked={props.metronomeEnabled()}
              aria-label="Metronome"
            >
              <i />
            </button>
          </OptionRow>
        </OptionSection>

        <OptionSection label="Mic">
          <OptionRow label="Auto-calibrate sensitivity">
            <button
              class={styles.stepBtn}
              onClick={() => props.onAutoCalibrate()}
            >
              Run
            </button>
          </OptionRow>
        </OptionSection>

        <DesktopHint message="A-B loops, session modes, custom scales & more — on desktop." />
      </OptionsSheet>

      {/* ── Song / track picker modals (same wiring as the desktop
             SingingStatusBar host — only one host mounts per viewport).
             prefix="fn" reuses the shared MIDI-picker styling the desktop
             status bars already use; a bespoke prefix has no CSS. ── */}
      <Show when={props.picker.isModalOpen()}>
        <MidiSongSelectModal
          prefix="fn"
          melodies={props.picker.melodies}
          savedSongs={savedMidiSongs}
          selectedId={props.picker.selectedId}
          onClose={() => props.picker.setIsModalOpen(false)}
          onPickMelody={(id) => {
            props.picker.setSelectedId(id)
            props.picker.loadMelody(id)
            props.picker.setIsModalOpen(false)
          }}
          onPickSaved={(s) => {
            props.picker.loadSavedSong(s)
            props.picker.setIsModalOpen(false)
          }}
          onOpenTracks={(s) => props.picker.openTrackModal(s)}
          onDeleteSaved={(id) => props.picker.deleteSong(id)}
        />
      </Show>

      <Show when={props.picker.trackModalSong()}>
        {(song) => (
          <MidiTrackPickerModal
            song={song}
            prefix="fn"
            radioName="singing-stage-score-track"
            pendingScoreId={props.picker.pendingScoreId}
            setPendingScoreId={props.picker.setPendingScoreId}
            pendingBackingIds={props.picker.pendingBackingIds}
            setPendingBackingIds={props.picker.setPendingBackingIds}
            onApply={props.picker.applyTrackSelection}
            onClose={() => props.picker.setTrackModalSong(null)}
            scoreHint="the track you sing against"
          />
        )}
      </Show>
    </div>
  )
}
