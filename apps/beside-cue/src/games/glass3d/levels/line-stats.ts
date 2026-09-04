// What each room of the Sorting Line keeps of its best run.
// ============================================================
//
// The track (`line-track.ts`) keeps one number per room, the best
// grade, and that is all a track should know. The walk card wants the
// units behind it -- cents past the gate, gates first time, drops --
// so those live here, beside the track and keyed the same way, kept
// for the run with the best grade. Device-local, like every other
// preference in this app. A record, never a gate.

import type { RoomStats } from '../sim/line-grade'

export const LINE_STATS_KEY = 'beside-cue:games:line-stats'

export type LineStats = Readonly<Record<string, RoomStats>>

const isStats = (v: unknown): v is RoomStats => {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return ['pct', 'overshootCents', 'firstTry', 'gates', 'drops'].every(
    (k) => typeof o[k] === 'number' && Number.isFinite(o[k]),
  )
}

const sanitise = (raw: unknown): LineStats => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  const out: Record<string, RoomStats> = {}
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (isStats(v)) out[id] = v
  }
  return out
}

/** Keep this run if it is the room's best, by grade. Ties keep the
 * new one: a same-grade run is more recent, and the units may differ. */
export const keepBest = (
  stats: LineStats,
  id: string,
  run: RoomStats,
): LineStats => {
  const had = stats[id]
  if (had !== undefined && had.pct > run.pct) return stats
  return { ...stats, [id]: run }
}

export const readStats = (): LineStats => {
  try {
    const raw = window.localStorage.getItem(LINE_STATS_KEY)
    return raw === null ? {} : sanitise(JSON.parse(raw))
  } catch {
    return {}
  }
}

export const writeStats = (stats: LineStats): void => {
  try {
    window.localStorage.setItem(LINE_STATS_KEY, JSON.stringify(stats))
  } catch {
    // Storage denied: the run still shows on the card, it is just not kept.
  }
}
