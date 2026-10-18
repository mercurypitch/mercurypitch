// ============================================================
// The voiceprint's picture: a print drawn from the range (pure)
// ============================================================
//
// The reveal's card (S7b beat 5, concept 04) carries a print, ridges around
// a core like a fingertip's, so "That's your voiceprint" has something to
// point at. It is drawn from the measured range and nothing else: a wider
// range has more ridges, and the two notes seed the print's tilt, the
// breaks in its ridges and their wobble. One range always draws the same
// print, and a range that moves as the singer practices draws a new one,
// which is what Merc's line promises.
//
// The paths are in a PRINT_SIZE square, for an SVG whose stroke runs from
// teal at its foot to violet at its top, as the ladder's rungs do.

/** The print's square, in its own units. */
export const PRINT_SIZE = 200
/** How far from the centre the print reaches, in its own units. */
export const PRINT_REACH = 97
/** The fewest ridges and the most, the most from two octaves up. */
export const MIN_RIDGES = 8
export const MAX_RIDGES = 18
/** Points along one ridge. */
const POINTS = 56

export interface PrintRidge {
  /** The ridge, an open curve, as an SVG path. */
  readonly d: string
  /** Inner ridges are brighter than outer ones. */
  readonly opacity: number
}

export interface VoiceprintArt {
  readonly ridges: readonly PrintRidge[]
  /** Degrees the whole print leans. */
  readonly tilt: number
}

/** A small seeded generator, so one range always draws one print. */
function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    // xorshift32
    s ^= s << 13
    s >>>= 0
    s ^= s >>> 17
    s ^= s << 5
    s >>>= 0
    return s / 0x1_0000_0000
  }
}

/** How many ridges a range of this many semitones draws. */
export function ridgeCount(semitones: number): number {
  return Math.min(
    MAX_RIDGES,
    Math.max(MIN_RIDGES, Math.round(semitones / 2) + 6),
  )
}

const fmt = (n: number): string => (Math.round(n * 10) / 10).toString()

/** The print for a range, low and high as MIDI notes. */
export function voiceprintArt(
  lowMidi: number,
  highMidi: number,
): VoiceprintArt {
  const low = Math.round(lowMidi)
  const high = Math.round(Math.max(lowMidi, highMidi))
  const random = seeded(low * 7919 + high * 104_729)
  const count = ridgeCount(high - low)
  const tilt = Math.round((random() * 2 - 1) * 16)

  // The outer ridge, wobble and all, stays within PRINT_REACH of the centre,
  // so the print fits its square at any tilt.
  const cx = PRINT_SIZE / 2
  const cy = PRINT_SIZE / 2
  const inner = PRINT_SIZE * 0.06
  const outer = PRINT_SIZE * 0.38
  const step = (outer - inner) / Math.max(1, count - 1)

  const ridges: PrintRidge[] = []
  for (let i = 0; i < count; i++) {
    const rx = inner + i * step
    const ry = rx * 1.15
    // Each ridge is open where a fingertip's loops break: a gap below and
    // to one side, a little wider on the outer ridges.
    const gapAt = Math.PI * (0.5 + (random() * 2 - 1) * 0.18)
    const gap = 0.5 + random() * 0.5 + (i / count) * 0.4
    const from = gapAt + gap / 2
    const sweep = Math.PI * 2 - gap
    const phaseA = random() * Math.PI * 2
    const phaseB = random() * Math.PI * 2
    const points: string[] = []
    for (let p = 0; p <= POINTS; p++) {
      const angle = from + (sweep * p) / POINTS
      const wobble =
        1 +
        0.035 * Math.sin(3 * angle + phaseA) +
        0.02 * Math.sin(5 * angle + phaseB)
      const x = cx + Math.cos(angle) * rx * wobble
      const y = cy + Math.sin(angle) * ry * wobble
      points.push(`${fmt(x)} ${fmt(y)}`)
    }
    ridges.push({
      d: `M${points.join(' L')}`,
      opacity:
        Math.round((1 - (0.45 * i) / Math.max(1, count - 1)) * 100) / 100,
    })
  }
  return { ridges, tilt }
}
