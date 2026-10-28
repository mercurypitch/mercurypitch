// ============================================================
// Where the singer is in the Ear Lab with Merc, across the room and
// the tab: the origin a run was opened from (so Done goes back there,
// the new number lit), and what today's three moved (for the day's
// close). The tab and the room unmount in turn, so this outlives both.
// ============================================================

import { createSignal } from 'solid-js'
import type { RoomPlate } from '@/features/ear-lab/stage-room'
import { createPersistedSignal } from '@/lib/storage'
import type { RoomOrigin } from './room-policy'

const [origin, setOrigin] = createSignal<RoomOrigin>({ kind: 'bench' })

/** Where the run now opening came from. */
export const roomOrigin = origin

export function setRoomOrigin(next: RoomOrigin): void {
  setOrigin(next)
}

/** What the tab shows as it comes back: the station sheet to reopen and
 *  the drill whose number to light, once. */
export interface ReturnNote {
  origin: RoomOrigin
  /** Null when the run kept nothing: nothing to light. */
  drillId: string | null
  /** Show the day's close over the tab. */
  todayDone?: boolean
}

const [returning, setReturning] = createSignal<ReturnNote | null>(null)

export function noteReturn(note: ReturnNote): void {
  setReturning(note)
}

/** The note, consumed. */
export function takeReturn(): ReturnNote | null {
  const note = returning()
  setReturning(null)
  return note
}

/** One of today's moves: where a drill's number stood before its run
 *  today, and where the run left it. */
export interface TodayMove {
  drillId: string
  before: string | null
  after: string
  /** "finer is better", "rating". */
  caption: string
}

/** What a finished run moved, from its plate: a rating from and to, or
 *  a staircase's reading before and after, each in its unit. Null when
 *  the run measured nothing. */
export function todayMoveOf(
  drillId: string,
  plate: RoomPlate,
): TodayMove | null {
  if (plate.kind === 'rating') {
    if (plate.rounds <= 0) return null
    return {
      drillId,
      before: String(plate.before),
      after: String(plate.rating),
      caption: plate.settling === null ? 'rating' : 'rating, settling',
    }
  }
  const { value, previous } = plate
  if (value === null) return null
  const said = (reading: number): string =>
    `${plate.format(reading)} ${plate.unitShort.trim()}`.trim()
  return {
    drillId,
    before: previous === null ? null : said(previous),
    after: said(value),
    caption: plate.provisional ? 'provisional' : 'practice',
  }
}

interface TodayMoves {
  day: string
  moves: TodayMove[]
  /** Path milestones lit as the day opened. */
  litAtOpen: string[] | null
}

const [moves, setMoves] = createPersistedSignal<TodayMoves | null>(
  'mercurypitch_ear_merc_today',
  null,
)

/** Today's moves, or none once the day has turned. */
export function todayMoves(day: string): TodayMove[] {
  const stored = moves()
  return stored !== null && stored.day === day ? stored.moves : []
}

export function recordTodayMove(day: string, move: TodayMove): void {
  setMoves((stored) => {
    const current =
      stored !== null && stored.day === day
        ? stored
        : { day, moves: [], litAtOpen: null }
    const kept = current.moves.filter((m) => m.drillId !== move.drillId)
    // A second run of the same drill keeps the day's first "before",
    // and a first reading (no before) stays one.
    const earlier = current.moves.find((m) => m.drillId === move.drillId)
    const before = earlier !== undefined ? earlier.before : move.before
    return {
      ...current,
      moves: [...kept, { ...move, before }],
    }
  })
}

/** The milestones lit when the day opened, noted once a day. */
export function litAtOpen(day: string, lit: readonly string[]): string[] {
  const stored = moves()
  if (stored !== null && stored.day === day && stored.litAtOpen !== null) {
    return stored.litAtOpen
  }
  const next = [...lit]
  setMoves((now) =>
    now !== null && now.day === day
      ? { ...now, litAtOpen: next }
      : { day, moves: [], litAtOpen: next },
  )
  return next
}
