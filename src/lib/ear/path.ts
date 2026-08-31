// ============================================================
// The Ear Path — the going train on the bench.
//
// A regulator's going train carries the mainspring's power to the
// escapement one wheel at a time; the Lab's carries a listener from
// the first reading to a month of regulation one milestone at a
// time. Every orb is lit from what the store already holds, and
// nothing is locked: the next dark orb points at its instrument, it
// does not gate it. The order is the order a listener tends to meet
// them in, not a syllabus — a desk reading before a seal lights the
// desk's orb and leaves the seal's dark.
// ============================================================

import { DESK_TRACKS } from './desk'
import { FACULTY_LABEL } from './drills'
import type { ColumnFaculty } from './mercury-index'
import { WILD_TRACKS } from './wild'

/** Where an orb points. `regulation` is the bench's own Today plate. */
export type PathView =
  | 'hairline'
  | 'calibration'
  | 'home'
  | 'contour'
  | 'stack'
  | 'grid'
  | 'pulse'
  | 'field-book'
  | 'desk'
  | 'regulation'

export interface PathMilestone {
  id: string
  label: string
  /** What lights it, in the bench's words. */
  note: string
  view: PathView
  lit: boolean
  /** A count toward the milestone, for the one that takes a month. */
  progress?: { done: number; of: number }
}

/** What the path reads from the store. */
export interface PathSnapshot {
  /** Drill and track ids with at least one reading or answer. */
  attempted: ReadonlySet<string>
  /** The faculties each Calibration seal carried, newest first. */
  seals: ReadonlyArray<ReadonlyArray<string>>
  /** Days with a finished regulation. */
  regulationDays: number
}

export const REGULATION_DAYS = 30

/** The Column's faculties, in the order the dials show them. */
export const PATH_FACULTIES: readonly ColumnFaculty[] = [
  'resolution',
  'function',
  'shape',
  'colour',
  'time',
]

/** The instrument a faculty's orb opens: the one with a Calibration
 *  pad where there is one, Home for Function (its calibrated reading
 *  rides on the next seal). */
const FACULTY_VIEW: Record<ColumnFaculty, PathView> = {
  resolution: 'hairline',
  function: 'home',
  shape: 'contour',
  colour: 'stack',
  time: 'grid',
}

/** The Time drills — any take on one is the first rhythm take. */
const RHYTHM_DRILLS = [
  'pulse',
  'chart',
  'subdivide',
  'drift',
  'the-grid',
] as const

function any(attempted: ReadonlySet<string>, ids: readonly string[]): boolean {
  return ids.some((id) => attempted.has(id))
}

export function earPath(snapshot: PathSnapshot): PathMilestone[] {
  const { attempted, seals, regulationDays } = snapshot
  const days = Math.max(0, Math.floor(regulationDays))
  return [
    {
      id: 'first-reading',
      label: 'First reading',
      note: 'Any instrument, any run.',
      view: 'hairline',
      lit: attempted.size > 0,
    },
    {
      id: 'first-seal',
      label: 'First seal',
      note: 'A Calibration run marks the Column.',
      view: 'calibration',
      lit: seals.length > 0,
    },
    ...PATH_FACULTIES.map(
      (faculty): PathMilestone => ({
        id: `sealed-${faculty}`,
        label: `${FACULTY_LABEL[faculty]} sealed`,
        note: `A seal carrying a ${FACULTY_LABEL[faculty]} reading.`,
        view: FACULTY_VIEW[faculty],
        lit: seals.some((parts) => parts.includes(faculty)),
      }),
    ),
    {
      id: 'first-rhythm',
      label: 'First rhythm take',
      note: 'Pulse, The Chart, Subdivide, Drift or the Grid.',
      view: 'pulse',
      lit: any(attempted, RHYTHM_DRILLS),
    },
    {
      id: 'first-wild',
      label: 'First page of the Field Book',
      note: 'A drill on one of your own songs.',
      view: 'field-book',
      lit: any(attempted, WILD_TRACKS),
    },
    {
      id: 'first-desk',
      label: 'First desk reading',
      note: 'Colour, Weight or Critique at the desk.',
      view: 'desk',
      lit: any(attempted, DESK_TRACKS),
    },
    {
      id: 'regulation',
      label: 'Thirty days of regulation',
      note: 'A finished sprint on thirty days.',
      view: 'regulation',
      lit: days >= REGULATION_DAYS,
      progress: { done: Math.min(days, REGULATION_DAYS), of: REGULATION_DAYS },
    },
  ]
}

/** The first dark orb, or null once the train is complete. */
export function nextOnPath(
  milestones: readonly PathMilestone[],
): PathMilestone | null {
  return milestones.find((milestone) => !milestone.lit) ?? null
}

/** How many orbs are lit, and how many there are. */
export function pathCount(milestones: readonly PathMilestone[]): {
  lit: number
  of: number
} {
  return {
    lit: milestones.filter((milestone) => milestone.lit).length,
    of: milestones.length,
  }
}
