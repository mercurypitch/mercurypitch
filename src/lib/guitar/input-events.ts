// One shape for everything the room hears a player do.
// ============================================================
//
// A microphone, a plugged-in interface and a MIDI guitar all answer the same
// question — the player did something, here is when and what — and everything
// downstream (Jam Doctor, take history, scoring) should never have to care
// which one it came from. So they all arrive as this.
//
// Two clocks are named separately on purpose, and mixing them up is the
// classic way timing feedback ends up quietly wrong:
//
//   `capturedAt`  when the sample carrying the strike reached us
//   `at`          when the player's hand actually moved
//
// They differ by the route's latency, and `at` is the only one that can be
// compared against a beat. See input-latency.ts for where that number comes
// from and why it is a single round-trip figure rather than a split one.

export type GuitarInputSource = 'microphone' | 'midi' | 'interface'

/**
 * A strike and a note change are not the same event, and Jam Doctor must never
 * treat them as one. A hammer-on, a pull-off and a slide all change the note
 * without anything being picked; counting them as attacks would inflate every
 * timing and spacing reading a player is shown.
 */
export type GuitarInputEventKind = 'attack' | 'pitch-change'

/** Pitch, once the slower analysis path has identified it. */
export interface GuitarInputPitch {
  midi: number
  noteName: string
  cents: number
  clarity: number
}

export interface GuitarInputEvent {
  kind: GuitarInputEventKind
  source: GuitarInputSource
  /** Audio-clock seconds, latency removed: when the string was struck. */
  at: number
  /** Audio-clock seconds, raw: when the sample carrying it arrived. */
  capturedAt: number
  /** Signal level at the strike, roughly 0..1. */
  level: number
  /**
   * What note it turned out to be. Null while unknown — an attack is timed
   * before it is identified, and pretending otherwise would mean either
   * delaying the timestamp or inventing the pitch.
   */
  pitch: GuitarInputPitch | null
}

/**
 * How far either side of a strike a pitch reading can land and still be that
 * strike's. Beyond it the note being heard is a sustain, or a legato move the
 * attack path never saw, and stapling it on would misattribute it.
 *
 * Either side, not just after: pitch is read from an analysis window tens of
 * milliseconds wide, so the moment it names is necessarily fuzzier than the
 * sample-exact moment the strike was found at.
 */
export const PITCH_ATTACH_WINDOW_MS = 90

/** Attack messages from the worklet, timed in absolute audio frames. */
export type GuitarInputWorkletMessage =
  | { type: 'attack'; atFrame: number; level: number }
  | { type: 'level'; atFrame: number; peak: number; noiseFloor: number }

/** Absolute frame count to audio-clock seconds. */
export function frameToSeconds(frame: number, sampleRate: number): number {
  if (!(sampleRate > 0)) return 0
  return frame / sampleRate
}

/**
 * Attach a pitch to the attack it belongs to, if any does. Returns the list
 * unchanged when the reading arrived too late to be that strike's, or when the
 * strike already has a clearer reading than this one.
 */
export function attachPitchToLatestAttack(
  events: readonly GuitarInputEvent[],
  pitch: GuitarInputPitch,
  atSeconds: number,
): readonly GuitarInputEvent[] {
  const index = events.length - 1
  const latest = events[index]
  if (latest === undefined) return events
  if (Math.abs(atSeconds - latest.at) * 1000 > PITCH_ATTACH_WINDOW_MS) {
    return events
  }
  if (latest.pitch !== null && latest.pitch.clarity >= pitch.clarity) {
    return events
  }
  const updated = [...events]
  updated[index] = { ...latest, pitch }
  return updated
}

export type GuitarInputHealth =
  | 'silent'
  | 'quiet'
  | 'good'
  | 'hot'
  | 'clipping'
  | 'noisy'

export interface GuitarInputHealthReading {
  state: GuitarInputHealth
  /** Plain-language, one line, no numbers the player cannot act on. */
  hint: string
}

/**
 * Turn a level and a background estimate into something worth showing. The
 * order of the checks is the order the problems matter in: a clipped signal is
 * unusable, a room louder than the guitar is unusable, and everything else is
 * advice.
 */
export function describeInputHealth(
  peak: number,
  noiseFloor: number,
): GuitarInputHealthReading {
  if (peak >= 0.98) {
    return {
      state: 'clipping',
      hint: 'Too loud to read — turn the input down.',
    }
  }
  if (peak < 0.012) {
    return { state: 'silent', hint: 'Nothing coming in yet.' }
  }
  if (noiseFloor > 0.03 && noiseFloor >= peak * 0.5) {
    return {
      state: 'noisy',
      hint: 'The room is nearly as loud as the guitar — play closer or quieten it.',
    }
  }
  if (peak >= 0.8) {
    return { state: 'hot', hint: 'Close to clipping — ease the input down.' }
  }
  if (peak < 0.05) {
    return { state: 'quiet', hint: 'Very quiet — play harder or move closer.' }
  }
  return { state: 'good', hint: 'Input level looks good.' }
}

/**
 * Background level, estimated from a stream of block peaks. Falls instantly and
 * rises slowly, so it settles onto the quietest thing heard recently rather
 * than onto the playing.
 */
export interface NoiseFloorFollower {
  push(blockPeak: number, blockSeconds: number): number
  value(): number
  reset(): void
}

export function createNoiseFloorFollower(riseSeconds = 3): NoiseFloorFollower {
  let floor = 0
  let seeded = false
  return {
    push(blockPeak, blockSeconds) {
      if (!seeded) {
        floor = blockPeak
        seeded = true
        return floor
      }
      if (blockPeak < floor) {
        floor = blockPeak
        return floor
      }
      const rise =
        riseSeconds > 0 ? 1 - Math.exp(-blockSeconds / riseSeconds) : 1
      floor += (blockPeak - floor) * rise
      return floor
    },
    value: () => floor,
    reset() {
      floor = 0
      seeded = false
    },
  }
}
