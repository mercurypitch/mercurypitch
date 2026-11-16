// ============================================================
// StaffFrame: a staff's five lines, its clef and its key signature
// ============================================================
//
// The part of a staff every line of notes sits on, drawn once for the drills
// that write a line (Sing It in Time's TuneStaff, Sight-Singing's
// SightStaff): the lines, the clef set on its line by Noto Music's own
// measures, and the key's sharps or flats on their places (kit/staff-key.ts),
// each right after the one before. A host draws its notes, bars and metre
// over it, with `staffMeasures` for the same heights and glyph scale.

import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import type { Clef, KeySig } from './staff-kit'
import { F_CLEF_PATH, FLAT_PATH, G_CLEF_PATH, keyPlaces, NOTO_GLYPHS, SHARP_PATH, } from './staff-kit'

/** The staff's five lines, as places. */
const LINE_PLACES = [0, 2, 4, 6, 8] as const

export interface StaffMeasures {
  /** Font units to the picture's: a glyph's scale on this staff. */
  readonly k: number
  /** The y of a place: half a space up for each letter above the bottom line. */
  readonly yOf: (place: number) => number
  /** A glyph's transform, its origin at (x, y). */
  readonly at: (x: number, y: number) => string
  /** The room one sign of a key signature takes. */
  readonly signW: number
}

/** The heights and glyph scale of a staff whose lines are `space` apart, its bottom line at `bottomY`. */
export function staffMeasures(space: number, bottomY: number): StaffMeasures {
  const k = space / NOTO_GLYPHS.space
  return {
    k,
    yOf: (place) => bottomY - (place * space) / 2,
    at: (x, y) =>
      `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${k.toFixed(5)})`,
    signW: (NOTO_GLYPHS.sharp - 50) * k + space * 0.12,
  }
}

export interface StaffFrameProps {
  clef: Clef
  sig: KeySig
  /** The distance between two lines, and the bottom line's y. */
  space: number
  bottomY: number
  /** Where the lines start and end. */
  left: number
  right: number
  /** Where the clef and the first sign of the key stand. */
  clefX: number
  keyX: number
  /** The host's classes for the lines and for the clef and signs. */
  lineClass: string
  glyphClass: string
  /** A test id for each sign of the key. */
  signTestId?: string
}

export function StaffFrame(props: StaffFrameProps): JSX.Element {
  const m = () => staffMeasures(props.space, props.bottomY)
  return (
    <>
      <For each={LINE_PLACES}>
        {(place) => (
          <line
            class={props.lineClass}
            x1={props.left}
            x2={props.right}
            y1={m().yOf(place)}
            y2={m().yOf(place)}
          />
        )}
      </For>
      <path
        class={props.glyphClass}
        d={props.clef === 'treble' ? G_CLEF_PATH : F_CLEF_PATH}
        transform={m().at(
          props.clefX,
          props.bottomY +
            (props.clef === 'treble'
              ? NOTO_GLYPHS.base.g
              : NOTO_GLYPHS.base.f) *
              m().k,
        )}
      />
      <For each={keyPlaces(props.sig, props.clef)}>
        {(place, i) => (
          <path
            class={props.glyphClass}
            data-testid={props.signTestId}
            d={props.sig.sign === 'sharp' ? SHARP_PATH : FLAT_PATH}
            transform={m().at(
              props.keyX + i() * m().signW - 50 * m().k,
              m().yOf(place) + NOTO_GLYPHS.head.cy * m().k,
            )}
          />
        )}
      </For>
    </>
  )
}
