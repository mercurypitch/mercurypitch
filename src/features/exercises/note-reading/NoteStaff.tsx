// ============================================================
// NoteStaff: one note on a five-line staff, for Read the Note
// ============================================================
//
// The lessons' staff toy (kit/staff-draw.ts) draws a whole scene: a key
// strip, a grand staff, notes that climb. The drill needs one clef and one
// note, so it draws its own, from the same parts: the kit's places for
// where a note sits and which ledger lines it needs (kit/staff-places.ts),
// and the kit's outlines for the clefs and the notehead, set on the staff
// by Noto Music's own measures (kit/staff-glyphs.ts).
//
// The picture never says the note's name, and neither do its words for a
// screen reader, which give the staff and the place: the name is the answer.

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import styles from './NoteReading.module.css'
import type { Clef } from './staff-kit'
import { F_CLEF_PATH, G_CLEF_PATH, ledgersOf, NOTEHEAD_PATH, NOTO_GLYPHS, placeWords, } from './staff-kit'

/** The picture's box, in its own units. */
const WIDTH = 240
const HEIGHT = 156
/** The distance between two staff lines. */
const SPACE = 14
/** The bottom line's y: room above it for two ledger lines over the staff. */
const BOTTOM_Y = 106
const LEFT = 8
const RIGHT = WIDTH - 8
const CLEF_X = 16
const NOTE_X = 150
/** The staff's five lines, as places. */
const LINE_PLACES = [0, 2, 4, 6, 8] as const
/** A stem's length, in staff spaces: an octave, as engravers set it. */
const STEM_SPACES = 3.5

const SCALE = SPACE / NOTO_GLYPHS.space
const HEAD_HALF = (NOTO_GLYPHS.head.width / 2) * SCALE

/** The y of a place: half a staff space up for each letter. */
const yOf = (place: number): number => BOTTOM_Y - (place * SPACE) / 2

const at = (x: number, y: number): string =>
  `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${SCALE.toFixed(5)})`

export type StaffTone = 'ask' | 'right' | 'wrong'

export interface NoteStaffProps {
  clef: Clef
  /** Letters up from the staff's bottom line (kit/staff-places.ts). */
  place: number
  /** How the note is lit: asked, read right, or missed. */
  tone: StaffTone
  /** The note's letter, drawn beside it once the answer is on show. */
  name?: string
}

/** What a screen reader hears for the picture: the staff and the place. */
export const staffWords = (clef: Clef, place: number): string =>
  `${clef === 'treble' ? 'Treble' : 'Bass'} staff. A note: ${placeWords(place, clef)}.`

export function NoteStaff(props: NoteStaffProps): JSX.Element {
  const y = () => yOf(props.place)
  // A note under the middle line carries its stem up its right side; from
  // the middle line up, down its left.
  const stemUp = () => props.place < 4
  const stemX = () =>
    stemUp() ? NOTE_X + HEAD_HALF - 0.7 : NOTE_X - HEAD_HALF + 0.7
  return (
    <svg
      class={styles.staff}
      classList={{
        [styles.toneRight]: props.tone === 'right',
        [styles.toneWrong]: props.tone === 'wrong',
      }}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={staffWords(props.clef, props.place)}
      data-testid="note-staff"
      data-clef={props.clef}
      data-place={props.place}
    >
      <For each={LINE_PLACES}>
        {(place) => (
          <line
            class={styles.line}
            x1={LEFT}
            x2={RIGHT}
            y1={yOf(place)}
            y2={yOf(place)}
          />
        )}
      </For>
      <Show
        when={props.clef === 'treble'}
        fallback={
          <path
            class={styles.clef}
            d={F_CLEF_PATH}
            transform={at(CLEF_X, BOTTOM_Y + NOTO_GLYPHS.base.f * SCALE)}
          />
        }
      >
        <path
          class={styles.clef}
          d={G_CLEF_PATH}
          transform={at(CLEF_X, BOTTOM_Y + NOTO_GLYPHS.base.g * SCALE)}
        />
      </Show>
      <For each={ledgersOf(props.place, props.clef)}>
        {(place) => (
          <line
            class={styles.ledger}
            data-testid="note-staff-ledger"
            x1={NOTE_X - HEAD_HALF - 5}
            x2={NOTE_X + HEAD_HALF + 5}
            y1={yOf(place)}
            y2={yOf(place)}
          />
        )}
      </For>
      <line
        class={styles.stem}
        data-stem={stemUp() ? 'up' : 'down'}
        x1={stemX()}
        x2={stemX()}
        y1={y()}
        y2={stemUp() ? y() - STEM_SPACES * SPACE : y() + STEM_SPACES * SPACE}
      />
      <path
        class={styles.head}
        d={NOTEHEAD_PATH}
        transform={at(
          NOTE_X - NOTO_GLYPHS.head.cx * SCALE,
          y() + NOTO_GLYPHS.head.cy * SCALE,
        )}
      />
      <Show when={props.name}>
        <text
          class={styles.name}
          x={NOTE_X + HEAD_HALF + 16}
          y={y() + 6}
          aria-hidden="true"
        >
          {props.name}
        </text>
      </Show>
    </svg>
  )
}
