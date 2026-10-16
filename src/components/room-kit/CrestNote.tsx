// ============================================================
// CrestNote: the note an arch climbs to, written under its crest
// ============================================================
//
// The glide rooms write each arch's top note under the middle of its
// crest (Lip roll's waves, Ng slides' arches), so the singer reads the
// note to reach before reaching it (owner, 15 Oct 2026). One style for
// both: Ng slides' storyboard note names (the body face at 600, a cap
// height of CREST_NOTE.capW), with a dark halo under the letters so a
// name reads on lit water and lit glass as well as on the night's dark.
// Notes are named as the rooms name them elsewhere (the intro line's
// {top}): midiToNoteNameOctave of the rounded MIDI.
//
// An SVG <text> for the room's own world SVG, so the name scrolls with its
// arch. The room places it, by props or, every frame, by its `ref`.

import type { JSX } from 'solid-js'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import styles from './CrestNote.module.css'

export const CREST_NOTE = {
  /** Cap height, W (Ng slides' storyboard names, screen 1). */
  capW: 0.0428,
  /** The face's cap height over its size. */
  capShare: 0.72,
  /** The halo's width over the size. */
  haloShare: 0.16,
  /** Name centre below the crest line, W (screen 1's top name, mirrored). */
  belowW: 0.0733,
} as const

/** The name for a top note, MIDI (fractional rounds to the nearest). */
export function crestNoteName(midi: number): string {
  return midiToNoteNameOctave(Math.round(midi))
}

/** The names' font size, px, for a room `unit` px wide. */
export function crestNoteFontPx(unit: number): number {
  return (CREST_NOTE.capW / CREST_NOTE.capShare) * unit
}

export interface CrestNoteProps {
  /** The top note, MIDI. */
  readonly midi: number
  /** Px per W: the room's width. */
  readonly unit: number
  /** The name's colour: the room's own. */
  readonly fill: string
  /** Its centre in the SVG, px; a room that moves it every frame uses `ref`. */
  readonly x?: number
  readonly y?: number
  readonly testId: string
  readonly ref?: (el: SVGTextElement) => void
}

export function CrestNote(props: CrestNoteProps): JSX.Element {
  const size = (): number => crestNoteFontPx(props.unit)
  return (
    <text
      ref={(el) => props.ref?.(el)}
      class={styles.note}
      x={props.x?.toFixed(1)}
      y={props.y?.toFixed(1)}
      font-size={size().toFixed(1)}
      stroke-width={(size() * CREST_NOTE.haloShare).toFixed(2)}
      fill={props.fill}
      text-anchor="middle"
      dominant-baseline="central"
      data-testid={props.testId}
    >
      {crestNoteName(props.midi)}
    </text>
  )
}
