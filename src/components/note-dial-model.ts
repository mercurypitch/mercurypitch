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

/**
 * The hub, as a fraction of the dial radius. It carries the readout and
 * is not a target, so hit-testing and the drawn circle read it from here
 * rather than each keeping its own number — they were 0.34 in two files,
 * which is a dead zone that drifts the moment one of them is tuned.
 */
export const HUB_RADIUS = 0.37

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
  if (fromHub < HUB_RADIUS) return null
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

// ── Octave segments on the rim ───────────────────────────────────
//
// Octave and range position are the same axis, so the rim can carry
// both: the sweep fills to where the selected note sits, and the rim
// beneath it is divided into one segment per octave. The octave
// boundary becomes a tick on the gauge instead of a fact stated
// separately by a row of chips.
//
// The segments are PROPORTIONAL to each octave's share of the range,
// not equal slices. A comfortable range rarely starts on a C — split
// C3-B5 into equal thirds and it happens to be right, but split
// E2-G5 into equal quarters and the marker sits in the wrong segment,
// which turns the one claim this design rests on into a lie.

/** Twelve o'clock, in the absolute radians the arc helpers use. */
const TOP = -Math.PI / 2

export interface OctaveArc {
  octave: number
  /** Absolute radians, TOP is twelve o'clock, growing clockwise. */
  start: number
  end: number
  /** Midpoint of the drawn arc — where the numeral goes. */
  mid: number
}

/** Gap between neighbouring segments, so the boundary is visible. */
const ARC_GAP = 0.055

/**
 * One arc per octave, sized by how much of the range that octave holds.
 *
 * Returns [] when there is no span to divide — a single note, or a list
 * with one octave in it, has no boundary worth drawing.
 */
export function octaveArcs(
  available: readonly string[],
  toMidi: (note: string) => number,
): OctaveArc[] {
  const notes = available.filter((n) => Number.isFinite(toMidi(n)))
  const octaves = octavesIn(notes)
  if (octaves.length < 2) return []
  const values = notes.map(toMidi)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  if (hi === lo) return []

  // Each octave's own notes, then the territory between them. A segment
  // runs to the MIDPOINT of the semitone separating it from its
  // neighbour, not to its own last note — B3 to C4 is a real step, and
  // stopping short of it leaves a band of dead ring at every boundary
  // where a tap resolves to nothing.
  const held = octaves.map((octave) => {
    const own = notes.filter((n) => splitNote(n)?.octave === octave).map(toMidi)
    return { octave, min: Math.min(...own), max: Math.max(...own) }
  })

  const turn = Math.PI * 2
  return held.map((h, i) => {
    const below = held[i - 1]
    const above = held[i + 1]
    const fromMidi = below === undefined ? lo : (below.max + h.min) / 2
    const toMidi_ = above === undefined ? hi : (h.max + above.min) / 2
    const from = (fromMidi - lo) / (hi - lo)
    const to = (toMidi_ - lo) / (hi - lo)
    // A gap wider than the segment would invert it, so an octave holding
    // a single note keeps a sliver rather than drawing backwards.
    const gap = Math.min(ARC_GAP, (to - from) * turn * 0.3)
    const start = TOP + from * turn + gap / 2
    const end = TOP + to * turn - gap / 2
    return {
      octave: h.octave,
      start,
      end: Math.max(start, end),
      mid: (start + end) / 2,
    }
  })
}

/** SVG path for one octave segment at radius `r`. */
export function octaveArcPath(
  arc: OctaveArc,
  cx: number,
  cy: number,
  r: number,
): string {
  const at = (a: number): string =>
    `${(cx + Math.cos(a) * r).toFixed(3)} ${(cy + Math.sin(a) * r).toFixed(3)}`
  const largeArc = arc.end - arc.start > Math.PI ? 1 : 0
  return `M ${at(arc.start)} A ${r} ${r} 0 ${largeArc} 1 ${at(arc.end)}`
}

/** A point on the dial, in unit-dial space (origin at the hub, radius 1). */
export function polarPoint(
  angle: number,
  radius: number,
): { x: number; y: number } {
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
}

/** Where the octave ring accepts a pointer, as fractions of the dial radius. */
const RING_INNER = 0.92
const RING_OUTER = 1.4

/**
 * The octave segment under a pointer, or null.
 *
 * Only the band outside the seats counts: the outermost natural reaches
 * 0.9 of the radius, so a ring starting at 0.92 cannot steal a seat's
 * tap. That separation is why the two hit-tests never have to arbitrate.
 */
export function octaveAtPoint(
  x: number,
  y: number,
  arcs: readonly OctaveArc[],
): OctaveArc | null {
  const fromHub = Math.hypot(x, y)
  if (fromHub < RING_INNER || fromHub > RING_OUTER) return null
  // atan2 gives (-PI, PI] from three o'clock; the arcs run from TOP.
  let angle = Math.atan2(y, x)
  while (angle < TOP) angle += Math.PI * 2
  while (angle >= TOP + Math.PI * 2) angle -= Math.PI * 2
  let best: OctaveArc | null = null
  let bestGap = Infinity
  for (const arc of arcs) {
    if (angle >= arc.start && angle <= arc.end) return arc
    // Inside a gap between segments: give it to the nearer neighbour
    // rather than swallowing the tap.
    const gap = Math.min(Math.abs(angle - arc.start), Math.abs(angle - arc.end))
    if (gap < bestGap) {
      bestGap = gap
      best = arc
    }
  }
  return bestGap <= ARC_GAP ? best : null
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
