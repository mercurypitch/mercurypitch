// ============================================================
// The Sing room's HUD — three chips, and nothing that scores you
// ============================================================
//
// Note (with the cents), key, and what the microphone is doing. No score
// percentage anywhere: the mock shows none during a run, and the numbers
// come at the end (owner answer 6). The song chip joins the row only once a
// melody is loaded, which is the one thing that turns a free run into a
// melody run.
//
// Every one of these is a thin reading of `hud-signals.ts`. Nothing here
// decides anything.

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { MicIcon, PauseIcon } from '@/components/mobile/icons'
import type { MicChipState, NoteChipSignal } from './hud-signals'
import { stateChipLabel } from './hud-signals'
import type { MicChipAction } from './room-machine'
import styles from './sing-room.module.css'

/** The kit's key glyph: two barlines and the two slanted staff strokes. */
const KeyGlyph: Component = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <path d="M9 4v16M15 4v16M5 9.5l14-3M5 16.5l14-3" />
  </svg>
)

interface NoteChipProps {
  signal: NoteChipSignal
}

export const NoteChip: Component<NoteChipProps> = (props) => (
  <span
    classList={{
      [styles.noteChip]: true,
      [styles.noteChipIn]: props.signal.variant === 'in',
      [styles.noteChipFlat]: props.signal.variant === 'flat',
      [styles.noteChipSharp]: props.signal.variant === 'sharp',
      [styles.noteChipQuiet]: props.signal.variant === 'quiet',
    }}
    data-testid="sing-note-chip"
    data-variant={props.signal.variant}
  >
    <span class={styles.noteChipNote}>
      {props.signal.note}
      <Show when={props.signal.octave !== ''}>
        <sub>{props.signal.octave}</sub>
      </Show>
    </span>
    <span class={styles.noteChipMark} />
    <span class={styles.noteChipCents}>{props.signal.cents}</span>
  </span>
)

interface SingRoomHudProps {
  note: () => NoteChipSignal
  keyLabel: () => string
  micState: () => MicChipState
  /** What a tap does, or null where it would do nothing. */
  micAction: () => MicChipAction
  songName: () => string | null
  onOpenKey: () => void
  onToggleMic: () => void
  onOpenSong: () => void
}

/** What the state chip promises a tap will do. Null is not a promise. */
function micChipHint(action: MicChipAction): string | undefined {
  if (action === 'mute') return 'Listening. Tap to mute the microphone'
  if (action === 'listen') return 'Microphone off. Tap to listen again'
  if (action === 'start') return 'Microphone off. Tap to sing a note'
  return undefined
}

export const SingRoomHud: Component<SingRoomHudProps> = (props) => (
  <div class={styles.hud} data-testid="sing-hud">
    <NoteChip signal={props.note()} />

    <button
      type="button"
      class={styles.chip}
      onClick={() => props.onOpenKey()}
      aria-label={`Key: ${props.keyLabel()}. Tap to change it`}
      data-testid="sing-key-chip"
    >
      <KeyGlyph />
      {props.keyLabel()}
    </button>

    {/* The only visible microphone control in the whole room (owner answer 8):
        it says what the mic is doing and a tap mutes or resumes it. A mute is
        not a stop — the take keeps running underneath.

        Where a tap would do NOTHING it is not a button at all. The chip used
        to read "Microphone off. Tap to listen again" in `ended` and `denied`,
        where there is no microphone to listen with and the tap was ignored —
        a promise the room could not keep, announced to a screen reader. */}
    <Show
      when={props.micAction() !== null}
      fallback={
        <span class={styles.chip} data-testid="sing-state-chip">
          <Show
            when={props.micState() !== 'paused'}
            fallback={<PauseIcon size={16} />}
          >
            <MicIcon size={16} />
          </Show>
          {stateChipLabel(props.micState())}
        </span>
      }
    >
      <button
        type="button"
        class={styles.chip}
        onClick={() => props.onToggleMic()}
        aria-label={micChipHint(props.micAction())}
        aria-pressed={
          props.micAction() === 'start'
            ? undefined
            : props.micState() === 'listening'
        }
        data-testid="sing-state-chip"
      >
        <Show
          when={props.micState() !== 'paused'}
          fallback={<PauseIcon size={16} />}
        >
          <MicIcon size={16} />
        </Show>
        {stateChipLabel(props.micState())}
      </button>
    </Show>

    {/* Only once a melody has been chosen IN THE ROOM. The app always has
        one loaded, and a chip naming it on a fresh boot is a melody run
        announced to somebody the brief opens as a free tracker. */}
    <Show when={props.songName()}>
      {(name) => (
        <button
          type="button"
          class={styles.chip}
          onClick={() => props.onOpenSong()}
          aria-label={`Melody: ${name()}. Tap to choose another`}
          data-testid="sing-song-chip"
        >
          {name()}
        </button>
      )}
    </Show>
  </div>
)
