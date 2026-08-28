// ============================================================
// INSTRUMENT_ICON — one glyph per bench instrument.
//
// The bench's instrument row and the stage's instrument card draw
// the same icon for a drill, so the map lives beside the catalogue
// of views rather than inside either component.
// ============================================================

import type { JSX } from 'solid-js'
import { VIEW_FOR_DRILL } from './drill-views'
import { IconArc, IconBalance, IconBassLine, IconBeats, IconChain, IconDesk, IconEar, IconFork, IconGears, IconLattice, IconLoupe, IconMetre, IconMetronome, IconNumerals, IconSeal, IconSpan, IconStylus, IconTap, IconTwelve, } from './ear-icons'
import type { InstrumentView } from './instruments'

export type InstrumentIcon = (p: {
  size?: number
  class?: string
}) => JSX.Element

export const INSTRUMENT_ICON: Record<InstrumentView, InstrumentIcon> = {
  hairline: IconLoupe,
  home: IconFork,
  grid: IconLattice,
  leap: IconArc,
  stack: IconGears,
  desk: IconDesk,
  contour: IconStylus,
  pulse: IconTap,
  echo: IconChain,
  span: IconSpan,
  'beat-hunt': IconBeats,
  drift: IconMetronome,
  gravity: IconTwelve,
  'the-pull': IconBalance,
  cadence: IconNumerals,
  bassline: IconBassLine,
  subdivide: IconMetre,
  calibration: IconSeal,
}

function isInstrumentView(view: string): view is InstrumentView {
  return Object.hasOwn(INSTRUMENT_ICON, view)
}

/** The glyph for a drill's stage: its instrument's where it has one
 *  (the desk's drills share the desk's, the Field Book's wild drills
 *  their bench twin's), the ear where none is drawn. */
export function iconForDrill(drillId: string): InstrumentIcon {
  const base = drillId.startsWith('wild-')
    ? drillId.slice('wild-'.length)
    : drillId
  const view = VIEW_FOR_DRILL[base]
  return view !== undefined && isInstrumentView(view)
    ? INSTRUMENT_ICON[view]
    : IconEar
}
