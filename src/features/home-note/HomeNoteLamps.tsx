// ============================================================
// Home note's lamps: the intro's chords under the chip, the run's keys at
// its result (home-note-lamps.ts says what each shows)
// ============================================================

import type { JSX } from 'solid-js'
import { For, Index } from 'solid-js'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { chordLampsLabel, chordLampState, keyLampLabel, } from './home-note-lamps'
import type { RoundOutcome } from './home-note-machine'
import type { Chord } from './home-note-rules'
import styles from './HomeNoteLamps.module.css'

export interface ChordLampsProps {
  /** The intro the band plays, in order. */
  chords: readonly Chord[]
  /** How many of its chords have reached the speaker. */
  begun: number
  /** The band has stopped. */
  over: boolean
}

/** One lamp a chord of the intro, lit as the band plays it. */
export function ChordLamps(props: ChordLampsProps): JSX.Element {
  return (
    <div
      class={styles.chords}
      role="img"
      aria-label={chordLampsLabel(props.chords, props.begun, props.over)}
      data-testid="home-note-chords"
    >
      <Index each={props.chords}>
        {(chord, i) => (
          <span
            class={styles.chord}
            data-lamp={chordLampState(i, props.begun, props.over)}
          >
            {chord()}
          </span>
        )}
      </Index>
    </div>
  )
}

export interface KeyLampsProps {
  /** The run's rounds, as they came out. */
  outcomes: readonly RoundOutcome[]
  /** The key heard again now, by its index; null for none. */
  playing: number | null
  /** Hear key `index` again. */
  onPlay: (index: number) => void
}

/** One lamp a key of the run: found or missed, a tap plays it again. */
export function KeyLamps(props: KeyLampsProps): JSX.Element {
  return (
    <ol
      class={styles.keys}
      style={{
        'grid-template-columns': `repeat(${props.outcomes.length}, minmax(0, 1fr))`,
      }}
      aria-label="The run's keys. Tap one to hear its intro and home again"
      data-testid="home-note-keys"
    >
      <For each={props.outcomes}>
        {(outcome, i) => (
          <li>
            <button
              type="button"
              class={styles.key}
              data-found={outcome.landed ? 'true' : 'false'}
              data-playing={props.playing === i() ? 'true' : 'false'}
              aria-label={keyLampLabel(outcome)}
              data-testid="home-note-key"
              onClick={() => props.onPlay(i())}
            >
              <span class={styles.lamp} aria-hidden="true" />
              {midiToNoteNameOctave(outcome.round.home)}
            </button>
          </li>
        )}
      </For>
    </ol>
  )
}
