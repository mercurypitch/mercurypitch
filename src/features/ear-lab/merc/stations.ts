// ============================================================
// The six stations — the bench's nineteen instruments grouped by the
// faculty each one measures, in fixed slots, each with the one number
// that stands for it and where that number comes from.
//
// A drill sits at the station of its faculty in the drill catalogue
// (lib/ear/drills.ts), the same faculty its readings count toward:
// Cadence and Bassline are Colour there, so they are Colour here too
// (owner, 28 Oct), and Function keeps Home, Gravity and The Pull.
//
// A station's number comes from its own instruments and from no
// others: Hairline's cents for Resolution, the Grid's milliseconds for
// Time, and the mean of the rated drills played at Function, Shape and
// Colour. Sealed when the last calibration carried the faculty,
// practice otherwise, and said so. Wild reads the Field Book's own
// rating.
//
// Each station may have a painting of its own (owner, 28 Oct): a
// portrait dropped in ./paintings as <faculty>.webp is the world of
// every drill at that station, with no change here. Until one is, the
// Regulator Room stands in, and Wild keeps the glasshouse.
// ============================================================

import type { Instrument } from '@/features/ear-lab/instruments'
import { instrumentReading, INSTRUMENTS, wildMeanRating, } from '@/features/ear-lab/instruments'
import { fieldBookSessions } from '@/features/ear-lab/wild-store'
import type { FacultyId } from '@/lib/ear/drills'
import { FACULTY_LABEL, findIdentificationDrill, findThresholdDrill, } from '@/lib/ear/drills'
import { isProvisional } from '@/lib/ear/elo'
import { earPlayerRating, latestCalibration, latestThresholdReading, } from '@/stores/ear-lab-store'

/** The stations, in their slots: two columns, three rows. */
export const STATION_ORDER: readonly FacultyId[] = [
  'resolution',
  'function',
  'shape',
  'colour',
  'time',
  'wild',
]

/** The station's own title. Colour is spelled as the app spells it. */
export function stationTitle(faculty: FacultyId): string {
  return faculty === 'wild' ? 'Wild' : FACULTY_LABEL[faculty]
}

/** The station a drill sits at: its catalogue faculty, the one its
 *  readings count toward. The desk's drills and the Field Book's are
 *  catalogued apart, and say so by their ids. */
export function stationOf(drillId: string | null): FacultyId | null {
  if (drillId === null) return null
  if (drillId.startsWith('wild')) return 'wild'
  if (drillId.startsWith('desk')) return 'colour'
  return (
    findThresholdDrill(drillId)?.faculty ??
    findIdentificationDrill(drillId)?.faculty ??
    INSTRUMENTS.find((instrument) => instrument.drillId === drillId)?.faculty ??
    null
  )
}

/** A drill's name as the bench says it: the catalogue's, or its
 *  instrument's for the desk's and the Field Book's. */
export function drillName(drillId: string): string {
  return (
    findThresholdDrill(drillId)?.name ??
    findIdentificationDrill(drillId)?.name ??
    INSTRUMENTS.find((instrument) => instrument.drillId === drillId)?.name ??
    drillId
  )
}

/** The instrument a station leads with: its card's icon and the first
 *  name in its cast. */
const LEAD: Partial<Record<FacultyId, Instrument['view']>> = {
  resolution: 'hairline',
  function: 'home',
  shape: 'leap',
  colour: 'stack',
  time: 'grid',
}

/** The instruments at a station: its lead, then the bench's order, the
 *  Desk (which needs a song of yours) last. */
export function stationInstruments(faculty: FacultyId): Instrument[] {
  const rank = (instrument: Instrument): number =>
    instrument.view === LEAD[faculty] ? 0 : instrument.view === 'desk' ? 2 : 1
  return INSTRUMENTS.filter(
    (instrument) => stationOf(instrument.drillId) === faculty,
  ).sort((a, b) => rank(a) - rank(b))
}

/** The Desk's name is capitalised as the station reads it. */
export function instrumentName(instrument: Instrument): string {
  return instrument.view === 'desk' ? 'The Desk' : instrument.name
}

/** "Leap + 3", "Hairline + 1", "The Field Book". */
export function stationCast(faculty: FacultyId): string {
  if (faculty === 'wild') return 'The Field Book'
  const [lead, ...rest] = stationInstruments(faculty)
  if (lead === undefined) return ''
  if (rest.length === 0) return instrumentName(lead)
  return `${instrumentName(lead)} + ${rest.length}`
}

// ── A painting per station ──────────────────────────────────────

/** Whatever paintings have been dropped in, by file: none yet. */
const PAINTINGS: Record<string, string> = import.meta.glob<string>(
  './paintings/*.webp',
  { eager: true, query: '?url', import: 'default' },
)

const REGULATOR_ROOM = '/ear-lab/regulator-room-portrait.webp'
const GLASSHOUSE = '/ear-lab/glasshouse-bench-portrait.webp'

/** The world a station's drills sit in. */
export function stationPainting(faculty: FacultyId | null): string {
  const own =
    faculty === null ? undefined : PAINTINGS[`./paintings/${faculty}.webp`]
  if (own !== undefined) return own
  return faculty === 'wild' ? GLASSHOUSE : REGULATOR_ROOM
}

// ── A station's number ──────────────────────────────────────────

/** A station's number, said in full. */
export interface StationReading {
  /** "9.4", "1240". */
  value: string
  /** "¢", "ms", or '' for a rating. */
  unit: string
  /** "sealed", "practice", "settling", or the rating's source. */
  status: string
  /** "Home", "3 drills": where the number comes from. */
  source: string
  /** "lower is finer", "higher is stronger". */
  direction: string
  sealed: boolean
}

function thresholdStation(
  drillId: string,
  source: string,
  faculty: FacultyId,
): StationReading | null {
  const reading = latestThresholdReading(drillId)
  if (reading === null) return null
  const sealed =
    reading.source === 'calibration' &&
    latestCalibration()?.parts[faculty] !== undefined
  const instrument = INSTRUMENTS.find((i) => i.drillId === drillId)
  const shown = instrument ? instrumentReading(instrument) : null
  return {
    value: shown?.value ?? reading.value.toFixed(1),
    unit: shown?.unit ?? '',
    status: sealed ? 'sealed' : 'practice',
    source,
    direction: 'lower is finer',
    sealed,
  }
}

function ratingStation(drillIds: readonly string[]): StationReading | null {
  const played = drillIds
    .map((id) => ({ id, rating: earPlayerRating(id) }))
    .filter((entry) => entry.rating.attempts > 0)
  if (played.length === 0) return null
  const mean =
    played.reduce((sum, entry) => sum + entry.rating.rating, 0) / played.length
  const settling = played.some((entry) => isProvisional(entry.rating))
  const source =
    played.length === 1
      ? (INSTRUMENTS.find((i) => i.drillId === played[0].id)?.name ??
        played[0].id)
      : `${played.length} drills`
  return {
    value: String(Math.round(mean)),
    unit: '',
    status: settling ? 'settling' : `from ${source}`,
    source,
    direction: 'higher is stronger',
    sealed: false,
  }
}

/** The rated drills at a station: its own, and only its own. */
function ratedAt(faculty: FacultyId): string[] {
  return stationInstruments(faculty)
    .map((instrument) => instrument.drillId)
    .filter(
      (drillId): drillId is string =>
        drillId !== null && findIdentificationDrill(drillId) !== undefined,
    )
}

/** The station's number, or null when nothing there was ever measured. */
export function stationReading(faculty: FacultyId): StationReading | null {
  switch (faculty) {
    case 'resolution':
      return thresholdStation('hairline', 'Hairline', faculty)
    case 'time':
      return thresholdStation('the-grid', 'The Grid', faculty)
    case 'function':
    case 'colour':
    case 'shape':
      return ratingStation(ratedAt(faculty))
    case 'wild': {
      const mean = wildMeanRating()
      if (mean === null) return null
      return {
        value: String(Math.round(mean)),
        unit: '',
        status: 'Field Book',
        source: 'the Field Book',
        direction: 'rated per song',
        sealed: false,
      }
    }
  }
}

/** Wild's caption under its title: the songs read so far. */
export function wildSongs(): string {
  const count = fieldBookSessions().length
  if (count === 0) return 'No songs yet'
  return `${count} song${count === 1 ? '' : 's'} read`
}

/** The instrument's own reading, for a station row. */
export function rowReading(
  instrument: Instrument,
): { value: string; unit: string; settling: boolean } | null {
  return instrumentReading(instrument)
}
