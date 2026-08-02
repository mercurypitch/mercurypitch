// ============================================================
// Note dial — the geometry, without the DOM
// ============================================================
//
// The dial lays the twelve pitch classes out the way a keyboard does:
// seven naturals evenly spaced on an outer ring, five sharps on an inner
// ring sitting between the two naturals they fall between. That is the
// spatial logic a singer already has in their hands, so C# is where they
// reach for it rather than thirteenth in a list.
//
// Pure functions on purpose. The prototype had a hit-testing bug that
// made every sharp unreachable — resolving a pointer to the nearest of
// the seven NATURALS by angle, which the five sharps can never win. That
// class of bug belongs in a unit test, not in a browser.

/** Chromatic order, sharps spelled sharp (matches midiToNoteName). */
export const PITCH_CLASSES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const

export type PitchClass = (typeof PITCH_CLASSES)[number]

/** The seven that get an outer seat, in the order they ring round. */
const NATURALS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const

/** Each sharp and the two naturals it sits between on a keyboard. */
const SHARP_NEIGHBOURS: Record<string, readonly [string, string]> = {
  'C#': ['C', 'D'],
  'D#': ['D', 'E'],
  'F#': ['F', 'G'],
  'G#': ['G', 'A'],
  'A#': ['A', 'B'],
}

export interface Seat {
  pitchClass: string
  /** Radians, 0 at twelve o'clock, growing clockwise. */
  angle: number
  /** Distance from the hub, as a fraction of the dial radius. */
  radius: number
  sharp: boolean
}

const NATURAL_RADIUS = 0.74
const SHARP_RADIUS = 0.55

/** Twelve seats in chromatic order, positioned like keyboard keys. */
export function dialSeats(): Seat[] {
  const naturalAngle = (pc: string): number =>
    (NATURALS.indexOf(pc as (typeof NATURALS)[number]) / NATURALS.length) *
      Math.PI *
      2 -
    Math.PI / 2

  return PITCH_CLASSES.map((pc) => {
    const neighbours = SHARP_NEIGHBOURS[pc]
    if (neighbours === undefined) {
      return {
        pitchClass: pc,
        angle: naturalAngle(pc),
        radius: NATURAL_RADIUS,
        sharp: false,
      }
    }
    const [lo, hi] = neighbours
    const a1 = naturalAngle(lo)
    let a2 = naturalAngle(hi)
    // B->C wraps; keep the midpoint on the short way round.
    if (a2 < a1) a2 += Math.PI * 2
    return {
      pitchClass: pc,
      angle: (a1 + a2) / 2,
      radius: SHARP_RADIUS,
      sharp: true,
    }
  })
}

/** Seat centre in a unit dial (origin at the hub, radius 1). */
export function seatPoint(seat: Seat): { x: number; y: number } {
  return {
    x: Math.cos(seat.angle) * seat.radius,
    y: Math.sin(seat.angle) * seat.radius,
  }
}

/**
 * The seat under a pointer, or null when it is on the hub or the empty
 * dial. Nearest by DISTANCE across all twelve — resolving by angle to the
 * naturals alone is what made the sharps unclickable.
 *
 * `x`/`y` are relative to the hub in unit-dial space.
 */
export function seatAtPoint(
  x: number,
  y: number,
  seats: readonly Seat[] = dialSeats(),
): Seat | null {
  const fromHub = Math.hypot(x, y)
  // The hub carries the readout and is not a target.
  if (fromHub < 0.34) return null
  let best: Seat | null = null
  let bestDistance = Infinity
  for (const seat of seats) {
    const p = seatPoint(seat)
    const d = Math.hypot(x - p.x, y - p.y)
    if (d < bestDistance) {
      bestDistance = d
      best = seat
    }
  }
  // Beyond this the pointer is on bare dial; snapping would be a guess.
  return bestDistance <= 0.22 ? best : null
}

/** Split a note name like 'C#4' into its pitch class and octave. */
export function splitNote(
  note: string,
): { pitchClass: string; octave: number } | null {
  const m = /^([A-G]#?)(-?\d+)$/.exec(note.trim())
  if (m === null) return null
  return { pitchClass: m[1]!, octave: Number(m[2]) }
}

/** The octaves offered by a note list, ascending and deduplicated. */
export function octavesIn(notes: readonly string[]): number[] {
  const set = new Set<number>()
  for (const n of notes) {
    const parsed = splitNote(n)
    if (parsed !== null) set.add(parsed.octave)
  }
  return [...set].sort((a, b) => a - b)
}

/**
 * The note to select when a pitch class is picked.
 *
 * Prefers the current octave, then the nearest octave that actually
 * offers that pitch class — picking "A" should never fail just because
 * the current octave stops at G.
 */
export function resolvePick(
  pitchClass: string,
  currentNote: string,
  available: readonly string[],
): string | null {
  const current = splitNote(currentNote)
  const inSet = new Set(available)
  const preferred = current?.octave
  if (preferred !== undefined && inSet.has(`${pitchClass}${preferred}`)) {
    return `${pitchClass}${preferred}`
  }
  const octaves = octavesIn(available)
  let best: string | null = null
  let bestDistance = Infinity
  for (const octave of octaves) {
    const candidate = `${pitchClass}${octave}`
    if (!inSet.has(candidate)) continue
    const d = preferred === undefined ? octave : Math.abs(octave - preferred)
    if (d < bestDistance) {
      bestDistance = d
      best = candidate
    }
  }
  return best
}

/** True when any octave in the list offers this pitch class. */
export function pitchClassAvailable(
  pitchClass: string,
  available: readonly string[],
): boolean {
  return available.some((n) => splitNote(n)?.pitchClass === pitchClass)
}

/**
 * Where a note sits within the offered range, 0 (lowest) to 1 (highest).
 * A single-note list has no span to sit in, so it reads as the middle.
 */
export function rangePosition(
  note: string,
  available: readonly string[],
  toMidi: (note: string) => number,
): number {
  const values = available.map(toMidi).filter((n) => Number.isFinite(n))
  if (values.length === 0) return 0.5
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  if (hi === lo) return 0.5
  const here = toMidi(note)
  if (!Number.isFinite(here)) return 0.5
  return Math.min(1, Math.max(0, (here - lo) / (hi - lo)))
}

/** Low / mid / high, for the word under the note name. */
export function rangeBand(position: number): 'low' | 'mid' | 'high' {
  if (position < 1 / 3) return 'low'
  return position < 2 / 3 ? 'mid' : 'high'
}

/**
 * SVG path for the arc that sweeps the rim to show where the selected
 * note falls in the range — 12 o'clock is the bottom of the range, and
 * it fills clockwise.
 *
 * Returns '' for an empty sweep, and closes the full circle with two
 * half-arcs because a single arc from a point back to itself is
 * degenerate and renders as nothing.
 */
export function arcPath(
  position: number,
  cx: number,
  cy: number,
  r: number,
): string {
  const p = Math.min(1, Math.max(0, position))
  if (p <= 0.0005) return ''
  const start = -Math.PI / 2
  const at = (a: number): string =>
    `${(cx + Math.cos(a) * r).toFixed(3)} ${(cy + Math.sin(a) * r).toFixed(3)}`
  if (p >= 0.9995) {
    // Two half-turns, so the circle actually draws.
    return `M ${at(start)} A ${r} ${r} 0 1 1 ${at(start + Math.PI)} A ${r} ${r} 0 1 1 ${at(start)}`
  }
  const end = start + p * Math.PI * 2
  const largeArc = p > 0.5 ? 1 : 0
  return `M ${at(start)} A ${r} ${r} 0 ${largeArc} 1 ${at(end)}`
}

/** The lowest and highest notes a list offers, by pitch. */
export function rangeEnds(
  available: readonly string[],
  toMidi: (note: string) => number,
): { low: string; high: string } | null {
  const sorted = available
    .filter((n) => Number.isFinite(toMidi(n)))
    .sort((a, b) => toMidi(a) - toMidi(b))
  if (sorted.length === 0) return null
  return { low: sorted[0]!, high: sorted[sorted.length - 1]! }
}
