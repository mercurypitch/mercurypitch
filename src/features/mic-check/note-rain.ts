// ============================================================
// Note rain — the notes a held voice throws off, landing on its key
// ============================================================
//
// While someone holds a note, the ribbon tosses note glyphs up off its crest.
// Each one arcs over and comes down on the key being sung, and splashes into
// sparks when it lands. The launch solves for the flight: given where a note
// starts, how hard it is thrown and where the key is, the sideways speed is
// whatever lands it on that key. However wide the spray, every note says
// which key it belongs to.
//
// Pure: CSS pixels, seconds, randomness passed in, so the motion can be
// tested without a canvas. Both lists are capped, and the oldest goes first,
// so a long held note cannot grow them without limit.

/** Downward acceleration, px/s². Brisk enough that a note is on its key
 *  well under a second after it leaves the ribbon. */
export const GRAVITY = 1400
export const MAX_NOTES = 40
export const MAX_SPARKS = 96
const SPARKS_PER_LANDING = 5
const SPARK_LIFE_S = 0.45

export interface RainNote {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  spin: number
  /** Glyph height in px. */
  size: number
  midi: number
  /** The note name, carried by the glyph that marks an onset. */
  label: string | null
}

export interface RainSpark {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  midi: number
}

export interface NoteRain {
  notes: RainNote[]
  sparks: RainSpark[]
}

export interface Landing {
  midi: number
  x: number
}

export const createNoteRain = (): NoteRain => ({ notes: [], sparks: [] })

export interface EmitOptions {
  /** Launch point: on the ribbon's crest, above the sung pitch. */
  x: number
  y: number
  /** Centre of the key the note must land on. */
  targetX: number
  /** Top edge of the keyboard. */
  floorY: number
  /** Top edge of the stage: no throw carries a glyph past it. */
  ceilingY: number
  midi: number
  /** Voice level, 0..1. A louder voice throws bigger notes higher. */
  level: number
  label: string | null
  random: () => number
}

/** Seconds until something thrown up at `lift` px/s from `y` falls back
 *  down to `floorY`. */
export function flightTime(y: number, lift: number, floorY: number): number {
  const drop = Math.max(0, floorY - y)
  return (lift + Math.sqrt(lift * lift + 2 * GRAVITY * drop)) / GRAVITY
}

export function emitNote(rain: NoteRain, options: EmitOptions): void {
  const level = Math.min(1, Math.max(0, options.level))
  const size = (options.label === null ? 13 : 20) + level * 10
  // Upward speed, positive up: enough to clear the ribbon, and never so much
  // that the glyph's stem (reaching about 0.6 of its size above the point it
  // is thrown from) crosses the top of the stage at the top of its arc.
  const highest = options.ceilingY + size * 0.6
  const ceilingLift = Math.sqrt(2 * GRAVITY * Math.max(0, options.y - highest))
  const lift = Math.min(ceilingLift, 260 + level * 260 + options.random() * 120)
  const x = options.x + (options.random() - 0.5) * 28
  const time = flightTime(options.y, lift, options.floorY)
  rain.notes.push({
    x,
    y: options.y,
    vx: time > 0 ? (options.targetX - x) / time : 0,
    vy: -lift,
    angle: (options.random() - 0.5) * 0.5,
    spin: (options.random() - 0.5) * 3,
    size,
    midi: options.midi,
    label: options.label,
  })
  if (rain.notes.length > MAX_NOTES) {
    rain.notes.splice(0, rain.notes.length - MAX_NOTES)
  }
}

/**
 * Advance everything by `dt` seconds. Notes that reach the keyboard become
 * sparks and are returned, so the caller can light the key they hit.
 */
export function stepNoteRain(
  rain: NoteRain,
  dt: number,
  floorY: number,
  random: () => number,
): Landing[] {
  const landings: Landing[] = []
  const flying: RainNote[] = []
  for (const note of rain.notes) {
    note.vy += GRAVITY * dt
    note.x += note.vx * dt
    note.y += note.vy * dt
    note.angle += note.spin * dt
    // Only a note on its way down can land: one still rising past the
    // keyboard's edge (a very low ribbon) must not splash on the way up.
    if (note.vy > 0 && note.y >= floorY) {
      landings.push({ midi: note.midi, x: note.x })
      for (let i = 0; i < SPARKS_PER_LANDING; i++) {
        rain.sparks.push({
          x: note.x,
          y: floorY,
          vx: (random() - 0.5) * 240,
          vy: -(120 + random() * 220),
          age: 0,
          midi: note.midi,
        })
      }
    } else {
      flying.push(note)
    }
  }
  rain.notes = flying

  const alive: RainSpark[] = []
  for (const spark of rain.sparks) {
    spark.age += dt
    if (spark.age >= SPARK_LIFE_S) continue
    spark.vy += GRAVITY * 0.6 * dt
    spark.x += spark.vx * dt
    spark.y += spark.vy * dt
    alive.push(spark)
  }
  rain.sparks =
    alive.length > MAX_SPARKS ? alive.slice(alive.length - MAX_SPARKS) : alive
  return landings
}

/** A spark's remaining strength, 1 when new and 0 when gone. */
export const sparkStrength = (spark: RainSpark): number =>
  Math.max(0, 1 - spark.age / SPARK_LIFE_S)
