// What each room of the Top Shelf keeps of its best run.
// ============================================================
//
// The twin of `line-stats.ts`. The track (`shelf-track.ts`) keeps one
// number per room, the best grade, and that is all a track should
// know. The walk card wants the units behind it -- cents past the
// shelf, shelves first time -- so those live here, beside the track and
// keyed the same way, kept for the run with the best grade.
// Device-local, like every other preference in this app. A record,
// never a gate.

import type { ShelfStats } from '../sim/shelf-grade'

export const SHELF_STATS_KEY = 'beside-cue:games:shelf-stats'

export type ShelfStatsByRoom = Readonly<Record<string, ShelfStats>>

const isStats = (v: unknown): v is ShelfStats => {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return ['pct', 'overshootCents', 'firstTry', 'shelves'].every(
    (k) => typeof o[k] === 'number' && Number.isFinite(o[k]),
  )
}

const sanitise = (raw: unknown): ShelfStatsByRoom => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  const out: Record<string, ShelfStats> = {}
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (isStats(v)) out[id] = v
  }
  return out
}

/** Keep this run if it is the room's best, by grade. Ties keep the
 * new one: a same-grade run is more recent, and the units may differ. */
export const keepBest = (
  stats: ShelfStatsByRoom,
  id: string,
  run: ShelfStats,
): ShelfStatsByRoom => {
  const had = stats[id]
  if (had !== undefined && had.pct > run.pct) return stats
  return { ...stats, [id]: run }
}

export const readStats = (): ShelfStatsByRoom => {
  try {
    const raw = window.localStorage.getItem(SHELF_STATS_KEY)
    return raw === null ? {} : sanitise(JSON.parse(raw))
  } catch {
    return {}
  }
}

export const writeStats = (stats: ShelfStatsByRoom): void => {
  try {
    window.localStorage.setItem(SHELF_STATS_KEY, JSON.stringify(stats))
  } catch {
    // Storage denied: the run still shows on the card, it is just not kept.
  }
}
