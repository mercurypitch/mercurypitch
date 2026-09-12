// ============================================================
// The Sing room's HUD — two rows, and nothing that scores you
// ============================================================
//
// Row 1, under the header: the key, what the microphone is doing, the song
// once one is loaded, and room for more. Row 2: the pitch pill, centred — the
// note and how far from it you are, in cents. No score percentage anywhere:
// the mock shows none during a run, and the numbers come at the end (owner
// answer 6).
//
// WHY TWO ROWS (device round 2, R3). One row held all four, and at 390pt with
// a song chip in it they were squeezed edge to edge with nothing between
// them. The pill is also the biggest thing here and the one a singer actually
// watches, so it gets a row of its own, centred, where a glance finds it.
//
// THE PILL IS A BUTTON, and its tap opens "Your takes" (R4). The coach mark
// promised a tap that did nothing; this is what it now promises instead.
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
  onOpenTakes: () => void
}

/**
 * The pitch pill.
 *
 * ITS CONTENT IS CENTRED BY A BOX, not by the pill's own alignment. The pill
 * used to be one flex row at `align-items: baseline`, which lines the pieces
 * up with each other and then leaves the group wherever the tallest of them
 * puts it — at `line-height: 1` that is hard against the top, which is what
 * the owner saw ("the — and the note text sit at the top of the pill"). The
 * pieces still share a baseline; the box that holds them is what the pill
 * centres.
 */
export const NoteChip: Component<NoteChipProps> = (props) => (
  <button
    type="button"
    classList={{
      [styles.noteChip]: true,
      [styles.noteChipIn]: props.signal.variant === 'in',
      [styles.noteChipFlat]: props.signal.variant === 'flat',
      [styles.noteChipSharp]: props.signal.variant === 'sharp',
      [styles.noteChipQuiet]: props.signal.variant === 'quiet',
    }}
    aria-label={`${props.signal.announce}. Tap for your takes`}
    onClick={() => props.onOpenTakes()}
    data-testid="sing-note-chip"
    data-variant={props.signal.variant}
  >
    <span class={styles.noteChipBox} data-testid="sing-note-chip-box">
      <span class={styles.noteChipNote}>
        {props.signal.note}
        <Show when={props.signal.octave !== ''}>
          <sub>{props.signal.octave}</sub>
        </Show>
      </span>
      <span class={styles.noteChipMark} />
      <span class={styles.noteChipCents}>{props.signal.cents}</span>
    </span>
  </button>
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
  onOpenTakes: () => void
}

/** What the state chip promises a tap will do. Null is not a promise. */
function micChipHint(action: MicChipAction): string | undefined {
  if (action === 'mute') return 'Listening. Tap to mute the microphone'
  if (action === 'listen') return 'Microphone off. Tap to listen again'
  if (action === 'start') return 'Microphone off. Tap to sing a note'
  return undefined
}

export const SingRoomHud: Component<SingRoomHudProps> = (props) => (
  <>
    <div class={styles.hud} data-testid="sing-hud">
      <button
        type="button"
        class={styles.chip}
        onClick={() => props.onOpenKey()}
        aria-label={`Key: ${props.keyLabel()}. Tap to change it`}
        data-testid="sing-key-chip"
      >
        <KeyGlyph />
        <span class={styles.chipText}>{props.keyLabel()}</span>
      </button>

      {/* The only visible microphone control in the whole room (owner answer
          8): it says what the mic is doing and a tap mutes or resumes it. A
          mute is not a stop — the take keeps running underneath.

          Where a tap would do NOTHING it is not a button at all. The chip used
          to read "Microphone off. Tap to listen again" in `ended` and
          `denied`, where there is no microphone to listen with and the tap was
          ignored — a promise the room could not keep, announced to a screen
          reader.

          It never shrinks: one word, and the word is the state of the
          microphone. Row 1 gives its width up from the key and the song. */}
      <Show
        when={props.micAction() !== null}
        fallback={
          <span
            classList={{ [styles.chip]: true, [styles.chipFixed]: true }}
            data-testid="sing-state-chip"
          >
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
          classList={{ [styles.chip]: true, [styles.chipFixed]: true }}
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
            <span class={styles.chipText}>{name()}</span>
          </button>
        )}
      </Show>

      {/* The room for more the row is meant to have (R3). It is a real flex
          item with a floor rather than a `justify-content`, so the slack at
          390pt is a number the probe can read off the layout instead of a
          gap that only exists while the chips happen to be short. */}
      <span class={styles.hudSlack} data-testid="sing-hud-slack" />
    </div>

    <div class={styles.pillRow} data-testid="sing-hud-pill-row">
      <NoteChip signal={props.note()} onOpenTakes={props.onOpenTakes} />
    </div>
  </>
)
