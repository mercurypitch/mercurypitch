// ============================================================
// The bench's instruments — one row per drill, and what each one
// currently reads. The dashboard's strip and the rack drawer both
// draw from this list, so an instrument cannot exist in one and
// not the other.
// ============================================================

import type { FacultyId } from '@/lib/ear/drills'
import { findThresholdDrill } from '@/lib/ear/drills'
import { isProvisional } from '@/lib/ear/elo'
import { clearedSubdivision } from '@/lib/ear/rhythm-take'
import { earPlayerRating, latestCalibration, latestThresholdReading, } from '@/stores/ear-lab-store'

export type InstrumentView =
  | 'hairline'
  | 'home'
  | 'grid'
  | 'leap'
  | 'stack'
  | 'contour'
  | 'pulse'
  | 'calibration'

export interface Instrument {
  view: InstrumentView
  /** Store id; 'the-grid' is not 'grid'. Calibration has none. */
  drillId: string | null
  name: string
  faculty: FacultyId | null
  /** What the instrument measures, as a bench caption. */
  measures: string
  /** How the answer is given. */
  answer: string
}

export interface InstrumentReading {
  /** The number, already formatted for the unit. */
  value: string
  /** Unit or qualifier rendered small after the value; '' for Elo. */
  unit: string
  /** True while an Elo rating is still settling. */
  settling: boolean
}

export const INSTRUMENTS: readonly Instrument[] = [
  {
    view: 'hairline',
    drillId: 'hairline',
    name: 'Hairline',
    faculty: 'resolution',
    measures: 'Resolution · cents',
    answer: 'Two tones — which was higher',
  },
  {
    view: 'home',
    drillId: 'home',
    name: 'Home',
    faculty: 'function',
    measures: 'Function · degree',
    answer: 'A cadence, one note — name the degree, tap or sing',
  },
  {
    view: 'grid',
    drillId: 'the-grid',
    name: 'The Grid',
    faculty: 'time',
    measures: 'Time · milliseconds',
    answer: 'Six clicks — which one left the lattice',
  },
  {
    view: 'leap',
    drillId: 'leap',
    name: 'Leap',
    faculty: 'shape',
    measures: 'Shape · interval',
    answer: 'Two notes — name the interval',
  },
  {
    view: 'stack',
    drillId: 'stack',
    name: 'Stack',
    faculty: 'colour',
    measures: 'Colour · chord quality',
    answer: 'One chord, roved root — name its quality',
  },
  {
    view: 'contour',
    drillId: 'contour',
    name: 'Contour',
    faculty: 'shape',
    measures: 'Shape · direction',
    answer: 'Up, down or level — fast',
  },
  {
    view: 'pulse',
    drillId: 'pulse',
    name: 'Pulse',
    faculty: 'time',
    measures: 'Time · rhythm',
    answer: 'A bar of onsets — tap it back on the beat',
  },
  {
    view: 'calibration',
    drillId: null,
    name: 'Calibration',
    faculty: null,
    measures: 'Sealed · three pooled tracks',
    answer: 'About three minutes. The only reading that marks the glass.',
  },
]

function thresholdReading(drillId: string): InstrumentReading | null {
  const reading = latestThresholdReading(drillId)
  if (!reading) return null
  const unit = findThresholdDrill(drillId)?.unitShort ?? ''
  const decimals = unit === 'ms' ? 0 : 1
  return { value: reading.value.toFixed(decimals), unit, settling: false }
}

function ratingReading(drillId: string): InstrumentReading | null {
  const rating = earPlayerRating(drillId)
  if (rating.attempts === 0) return null
  return {
    value: String(Math.round(rating.rating)),
    unit: '',
    settling: isProvisional(rating),
  }
}

export function dateLabel(at: number): string {
  return new Date(at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

/** What the instrument reads now, or null when it has never been used. */
export function instrumentReading(
  instrument: Instrument,
): InstrumentReading | null {
  switch (instrument.view) {
    case 'hairline':
    case 'grid':
      return thresholdReading(instrument.drillId ?? '')
    case 'home': {
      const ear = ratingReading('home')
      if (ear === null) return null
      const voice = earPlayerRating('home-sing')
      return voice.attempts > 0
        ? { ...ear, unit: `· voice ${Math.round(voice.rating)}` }
        : ear
    }
    case 'leap':
    case 'stack':
    case 'contour':
      return ratingReading(instrument.drillId ?? '')
    case 'pulse': {
      const rating = ratingReading('pulse')
      if (rating === null) return null
      const cleared = clearedSubdivision(earPlayerRating('pulse').rating)
      return cleared ? { ...rating, unit: `· ${cleared}` } : rating
    }
    case 'calibration': {
      const sealed = latestCalibration()
      if (!sealed) return null
      return { value: dateLabel(sealed.at), unit: 'sealed', settling: false }
    }
  }
}

/** The faculty readout in the drill's own unit, for the sub-dials. */
export function facultyReadout(faculty: FacultyId): InstrumentReading | null {
  switch (faculty) {
    case 'resolution':
      return thresholdReading('hairline')
    case 'time':
      return thresholdReading('the-grid')
    case 'function':
      return instrumentReading(INSTRUMENTS[1])
    case 'colour':
      return ratingReading('stack')
    case 'shape': {
      // Leap and Contour average into the faculty; the readout shows
      // whichever exist.
      const parts = ['leap', 'contour']
        .map((id) => earPlayerRating(id))
        .filter((rating) => rating.attempts > 0)
      if (parts.length === 0) return null
      const mean =
        parts.reduce((sum, rating) => sum + rating.rating, 0) / parts.length
      return {
        value: String(Math.round(mean)),
        unit: '',
        settling: parts.some((rating) => isProvisional(rating)),
      }
    }
    case 'wild':
      return null
  }
}
