// ============================================================
// Studio note roll bands — the part of the note roll a press lands on, so the roll gives it to the gesture that owns it: the ruler's seek, the keys' sound, or the editing engine's grid and velocity lane
// ============================================================
//
// One canvas takes every pointer over the roll (StudioNoteRoll.tsx), and a
// pointer belongs to the band it went down in until it is let go,
// wherever it goes while captured. The ruler moves the song's position
// (note-roll-ruler.ts), the keys' column sounds its keys (note-roll-keys.ts),
// and the grid and the velocity lane edit (note-roll-pointers.ts). The
// corner over the keys and the velocity lane's label take no press.
import type { StudioRollRect, StudioRollRegions } from './note-roll-geometry'

export type NoteRollBand = 'ruler' | 'keys' | 'grid' | 'velocity'

function inside(rect: StudioRollRect, x: number, y: number): boolean {
  return (
    x >= rect.x &&
    x < rect.x + rect.width &&
    y >= rect.y &&
    y < rect.y + rect.height
  )
}

/** The band a point at canvas `x`, `y` falls in; null over the corner and the velocity lane's label. */
export function noteRollBandAt(
  regions: Pick<StudioRollRegions, 'ruler' | 'keys' | 'grid' | 'velocity'>,
  x: number,
  y: number,
): NoteRollBand | null {
  if (inside(regions.ruler, x, y)) return 'ruler'
  if (inside(regions.keys, x, y)) return 'keys'
  if (inside(regions.grid, x, y)) return 'grid'
  if (inside(regions.velocity, x, y)) return 'velocity'
  return null
}
