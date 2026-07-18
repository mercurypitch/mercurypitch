// ============================================================
// PianoMobileStage — the phone-first falling-notes surface (Phase 2).
// ============================================================
//
// Rendered by PianoPage INSTEAD of its desktop tree on isNarrow()
// viewports. The falling-notes controller, song picker, drop zone and
// mic insights are all created in PianoPage above the branch — this
// component is chrome only. The canvas already speaks touch (key taps +
// two-finger pinch zoom), so the stage's job is a clean chip header,
// thin scrubber, glass transport and the one options sheet (D4).

import type { Component, JSX } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { DesktopHint } from '@/components/mobile/DesktopHint'
import { PauseIcon, PlayIcon } from '@/components/mobile/icons'
import { MicSparkleIcon } from '@/components/mobile/icons'
import { OptionRow, OptionSection, OptionsSheet, } from '@/components/mobile/OptionsSheet'
import { Scrubber } from '@/components/mobile/Scrubber'
import { TransportBar } from '@/components/mobile/TransportBar'
import { MidiSongSelectModal } from '@/components/shared/MidiSongSelectModal'
import { MidiTrackPickerModal } from '@/components/shared/MidiTrackPickerModal'
import type { useFallingNotesController } from '@/features/falling-notes/useFallingNotesController'
import { haptics } from '@/lib/haptics'
import type { MidiSongPicker } from '@/lib/use-midi-song-picker'
import { selectedSongName } from '@/stores/falling-notes-store'
import { savedMidiSongs } from '@/stores/saved-midi-songs-store'
import styles from './PianoMobileStage.module.css'
import stageStyles from './SingingMobileStage.module.css'

type FallingNotesController = ReturnType<typeof useFallingNotesController>

export interface PianoMobileStageProps {
  fallingNotes: FallingNotesController
  picker: MidiSongPicker
  onSeek: (beat: number) => void
  volume: () => number
  onVolumeChange: (vol: number) => void
  /** Fresh instances per branch — canvases are never re-parented. */
  renderCanvas: () => JSX.Element
  renderMicHint?: () => JSX.Element
  renderScoreCard: () => JSX.Element
}

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]

export const PianoMobileStage: Component<PianoMobileStageProps> = (props) => {
  // Stable controller created once in AppShell — aliasing it is safe (it
  // never changes), same as PianoPage does.
  // eslint-disable-next-line solid/reactivity
  const fn = props.fallingNotes

  const [optionsOpen, setOptionsOpen] = createSignal(false)

  const playing = (): boolean => fn.gameState() === 'playing'
  const paused = (): boolean => fn.gameState() === 'paused'

  const playPauseLabel = (): string =>
    playing() ? 'Pause' : paused() ? 'Resume' : 'Play'

  const onPlayPause = (): void => {
    haptics.tapLight()
    if (playing()) {
      fn.pauseGame()
    } else if (paused()) {
      fn.resumeGame()
    } else {
      fn.setPianoCurrentCycle(1)
      void fn.startGame()
    }
  }

  const onMicToggle = (): void => {
    haptics.tapLight()
    if (fn.isMicActive()) fn.stopMic()
    else void fn.startMic()
  }

  const songLabel = (): string => {
    const name = selectedSongName()
    return name !== '' ? name : 'Pick a song'
  }

  return (
    <div class={styles.stage} data-testid="piano-mobile-stage">
      {/* ── Status chips ─────────────────────────────────── */}
      <div class={stageStyles.chips} data-tour="piano-mobile-chips">
        <button
          class={stageStyles.chip}
          onClick={() => setOptionsOpen(true)}
          aria-label="Tempo and playback options"
        >
          {Math.round(fn.currentSongBpm())} BPM · {fn.zoomPercent()}%
        </button>
        <button
          classList={{
            [stageStyles.chip]: true,
            [stageStyles.chipAccent]: true,
          }}
          onClick={() => props.picker.setIsModalOpen(true)}
          aria-label="Choose a song"
          data-tour="piano-songs"
        >
          ♪ {songLabel()}
        </button>
      </div>

      {/* ── Progress strip ───────────────────────────────── */}
      <Scrubber
        class={stageStyles.progress}
        value={fn.playheadBeat()}
        duration={fn.totalBeats()}
        onSeek={props.onSeek}
      />

      {/* ── Canvas (touch keys + pinch zoom live in-canvas) ── */}
      <div class={styles.canvasWrap} data-stage-canvas>
        {props.renderCanvas()}
        {props.renderMicHint?.()}
        {props.renderScoreCard()}
      </div>

      {/* ── Transport ────────────────────────────────────── */}
      <TransportBar class={stageStyles.transport}>
        <button
          classList={{
            [stageStyles.roundBtn]: true,
            [stageStyles.micBtn]: true,
            [stageStyles.micOn]: fn.isMicActive(),
          }}
          onClick={onMicToggle}
          title={fn.isMicActive() ? 'Stop the mic' : 'Sing the notes'}
          aria-label={fn.isMicActive() ? 'Stop the mic' : 'Start the mic'}
          aria-pressed={fn.isMicActive()}
          data-tour="piano-transport"
        >
          <MicSparkleIcon size={19} />
        </button>

        <button
          classList={{
            [stageStyles.roundBtn]: true,
            [stageStyles.playBtn]: true,
          }}
          onClick={onPlayPause}
          title={playPauseLabel()}
          aria-label={playPauseLabel()}
        >
          <Show when={playing()} fallback={<PlayIcon size={26} />}>
            <PauseIcon size={26} />
          </Show>
        </button>

        <Show when={playing() || paused()}>
          <button
            classList={{
              [stageStyles.roundBtn]: true,
              [stageStyles.stopBtn]: true,
            }}
            onClick={() => fn.resetGame()}
            title="Stop"
            aria-label="Stop"
          >
            <span class={stageStyles.stopGlyph} />
          </button>
        </Show>

        <button
          classList={{
            [stageStyles.modeBtn]: true,
            [styles.labelsOn]: fn.showNoteLabels(),
          }}
          onClick={() => fn.toggleNoteLabels()}
          title="Note labels"
          aria-label="Toggle note labels"
          aria-pressed={fn.showNoteLabels()}
        >
          Labels
        </button>

        <button
          classList={{
            [stageStyles.roundBtn]: true,
            [stageStyles.moreBtn]: true,
          }}
          onClick={() => setOptionsOpen(true)}
          title="Practice options"
          aria-label="Practice options"
          data-tour="piano-options"
        >
          <span class={stageStyles.moreGlyph}>
            <i />
            <i />
            <i />
          </span>
        </button>

        <Show when={fn.isCountingIn()}>
          <span class={stageStyles.countBadge}>{fn.countInBeat()}</span>
        </Show>
      </TransportBar>

      {/* ── The one options sheet (D4) ───────────────────── */}
      <OptionsSheet
        isOpen={optionsOpen()}
        close={() => setOptionsOpen(false)}
        ariaLabel="Practice options"
      >
        <OptionSection label="Playback">
          <OptionRow label={`Tempo ${Math.round(fn.currentSongBpm())} BPM`}>
            <input
              type="range"
              min="40"
              max="220"
              step="1"
              value={fn.currentSongBpm()}
              onInput={(e) => fn.setBpm(Number(e.currentTarget.value))}
            />
          </OptionRow>
          <OptionRow label="Speed">
            <select
              class="dropdown-select-style"
              value={String(fn.speed())}
              onChange={(e) => fn.setSpeed(Number(e.currentTarget.value))}
            >
              <For each={SPEEDS}>
                {(s) => <option value={String(s)}>{s}×</option>}
              </For>
            </select>
          </OptionRow>
          <OptionRow label="Play mode">
            <select
              class="dropdown-select-style"
              value={fn.pianoPlayMode()}
              onChange={(e) => {
                const mode =
                  e.currentTarget.value === 'repeat' ? 'repeat' : 'once'
                fn.setPianoPlayMode(mode)
                if (mode === 'repeat') fn.setPianoCurrentCycle(1)
              }}
            >
              <option value="once">Once</option>
              <option value="repeat">Repeat</option>
            </select>
          </OptionRow>
          <Show when={fn.pianoPlayMode() === 'repeat'}>
            <OptionRow
              label={`Cycles (${fn.pianoCurrentCycle()}/${fn.pianoRepeatCycles()})`}
            >
              <button
                class={stageStyles.stepBtn}
                onClick={() =>
                  fn.setPianoRepeatCycles(
                    Math.max(1, fn.pianoRepeatCycles() - 1),
                  )
                }
                aria-label="Fewer cycles"
              >
                −
              </button>
              <span class={stageStyles.stepValue}>
                {fn.pianoRepeatCycles()}
              </span>
              <button
                class={stageStyles.stepBtn}
                onClick={() =>
                  fn.setPianoRepeatCycles(fn.pianoRepeatCycles() + 1)
                }
                aria-label="More cycles"
              >
                +
              </button>
            </OptionRow>
          </Show>
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
        </OptionSection>

        <OptionSection label="Display">
          <OptionRow label="Note labels">
            <button
              classList={{
                [stageStyles.toggle]: true,
                [stageStyles.toggleOn]: fn.showNoteLabels(),
              }}
              onClick={() => fn.toggleNoteLabels()}
              role="switch"
              aria-checked={fn.showNoteLabels()}
              aria-label="Note labels"
            >
              <i />
            </button>
          </OptionRow>
          <OptionRow label={`Zoom ${fn.zoomPercent()}%`}>
            <button
              class={stageStyles.stepBtn}
              onClick={() => fn.zoomOut()}
              aria-label="Zoom out"
            >
              −
            </button>
            <button
              class={stageStyles.stepBtn}
              onClick={() => fn.zoomIn()}
              aria-label="Zoom in"
            >
              +
            </button>
          </OptionRow>
        </OptionSection>

        <OptionSection label="Input">
          <OptionRow label="MIDI keyboard">
            <button
              classList={{
                [stageStyles.toggle]: true,
                [stageStyles.toggleOn]: fn.midiConnected(),
              }}
              onClick={() => {
                if (fn.midiConnected()) fn.midiDisconnect()
                else void fn.midiConnect()
              }}
              role="switch"
              aria-checked={fn.midiConnected()}
              aria-label="MIDI keyboard"
            >
              <i />
            </button>
          </OptionRow>
        </OptionSection>

        <DesktopHint message="A-B loops, per-track mixing & more — on desktop." />
      </OptionsSheet>

      {/* ── Song / track picker modals (stage hosts them — the desktop
             host, MidiSongStatusBar, is unmounted on narrow) ── */}
      <Show when={props.picker.isModalOpen()}>
        <MidiSongSelectModal
          prefix="pms"
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
            prefix="pms"
            radioName="piano-stage-score-track"
            pendingScoreId={props.picker.pendingScoreId}
            setPendingScoreId={props.picker.setPendingScoreId}
            pendingBackingIds={props.picker.pendingBackingIds}
            setPendingBackingIds={props.picker.setPendingBackingIds}
            onApply={props.picker.applyTrackSelection}
            onClose={() => props.picker.setTrackModalSong(null)}
            scoreHint="the track you play against"
          />
        )}
      </Show>
    </div>
  )
}
