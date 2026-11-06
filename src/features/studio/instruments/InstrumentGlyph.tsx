// ============================================================
// Instrument glyphs — one inline SVG per instrument, and the family-tinted chip a lane wears it in
// ============================================================
//
// The drawing is markup (glyph-drawings.ts) set as the SVG's content, its mask
// ids made unique per instance: two lanes drawing the flute would otherwise
// share one mask, and the second lane's holes would come from the first. A
// size class sets the stroke (InstrumentGlyph.module.css): 2.25 units at 16 px,
// where the fine detail drops, 1.5 units at 32 px, 2 between. The glyph is
// decorative; the chip can carry the instrument's name for a screen reader.
import { createUniqueId } from 'solid-js'
import type { InstrumentFamilyId, InstrumentGlyphId, } from '@/lib/studio/instruments/glyph-catalog'
import { instrumentFamily } from '@/lib/studio/instruments/glyph-catalog'
import { INSTRUMENT_DRAWINGS } from './glyph-drawings'
import styles from './InstrumentGlyph.module.css'

export type InstrumentGlyphSize = 16 | 20 | 24 | 32

export function InstrumentGlyph(props: {
  glyph: InstrumentGlyphId
  size: InstrumentGlyphSize
}) {
  const id = `instrument-${createUniqueId()}`
  return (
    <svg
      class={styles.glyph}
      data-size={props.size}
      data-instrument={props.glyph}
      viewBox="0 0 24 24"
      width={props.size}
      height={props.size}
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      // Static drawings from this module, never anyone's text.
      innerHTML={INSTRUMENT_DRAWINGS[props.glyph].replaceAll('$k', id)}
    />
  )
}

/** A chip's side in px, and the glyph it holds. */
const CHIP_GLYPH = { 24: 16, 28: 20, 32: 24, 40: 24 } as const

export type InstrumentChipSize = keyof typeof CHIP_GLYPH

/**
 * The glyph on its family's hue: a ground mixed from the hue and the bar, ink
 * mixed from the hue and the text, so every theme and preset gets a chip on
 * its own colours. Silent lanes turn it neutral. With a label it is an image
 * named for its instrument; without one it is decoration.
 */
export function InstrumentChip(props: {
  glyph: InstrumentGlyphId
  family: InstrumentFamilyId
  size: InstrumentChipSize
  label?: string
  /** Muted, or silent while another lane is soloed. */
  silent?: boolean
  tour?: string
}) {
  return (
    <span
      class={styles.chip}
      data-size={props.size}
      data-silent={props.silent === true ? '' : undefined}
      data-instrument-chip={props.glyph}
      data-tour={props.tour}
      role={props.label === undefined ? undefined : 'img'}
      aria-label={props.label}
      aria-hidden={props.label === undefined ? 'true' : undefined}
      title={props.label}
      style={{
        '--chip-hue': `var(--studio-hue-${instrumentFamily(props.family).hue})`,
      }}
    >
      <InstrumentGlyph glyph={props.glyph} size={CHIP_GLYPH[props.size]} />
    </span>
  )
}
