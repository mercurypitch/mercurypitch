// ============================================================
// Studio seek crossfade — each lane fades from the sources it plays to the ones a seek starts, ahead of its chain, so effect tails ring on
// ============================================================
//
// A playing graph keeps its chains, master and meters through a seek; only
// its sources change. Every lane takes its sources through two gains per
// set of sources: Play starts one set, each seek another. The old set's
// fade-out and the new set's fade-in run on the same lane, on the same
// frames, before the lane's chain, so a reverb or delay goes on ringing with
// what it already had.
//
// The fade is equal-power, not linear: the two sides of a seek are
// different parts of the song, unrelated, so their powers add, and sin² +
// cos² holds the level where a linear pair sags 3 dB at its middle. (A
// handoff between two runs of the same audio is the opposite case, and
// stays linear: handoff.ts.)
//
// 10 ms, from renders of this fade in Chromium at 5, 10 and 15 ms. Over
// unrelated material none of them dips beyond the level's own ripple. A
// shorter fade clicks: a 41 to 110 Hz bass note jumping phase splatters
// -59 dBFS above 1 kHz at 5 ms, -67 at 10 and -71 at 15. A longer one sags
// where both sides hold the same tone out of phase: the worst 20 ms window
// falls 0.8, 1.7 and 2.8 dB. 10 ms keeps that under 2 dB and the click 8 dB
// under the 5 ms one.
//
// Fade-in and fade-out sit on separate gains so a seek that comes while the
// last one is still fading in never schedules over its curve, which Web
// Audio refuses.

export const SEEK_CROSSFADE_SECONDS = 0.01

const CURVE_POINTS = 33
const FADE_IN = Float32Array.from({ length: CURVE_POINTS }, (_, index) =>
  Math.sin((Math.PI / 2) * (index / (CURVE_POINTS - 1))),
)
const FADE_OUT = FADE_IN.slice().reverse()

/** A built lane: where its sources go, and how much later than the slowest lane they start. */
export interface StudioLaneInput {
  readonly input: AudioNode
  readonly compensation: number
}

/** A started source, the gain that shapes its clip's edges, and when it starts. */
export interface StudioSourceEntry {
  readonly gain: GainNode
  /** The repeat pass it belongs to; the first is 0. */
  readonly pass: number
  readonly lane: number
  readonly when: number
}

/** The sources one Play or one seek started, and the gains that fade them as a set. */
export interface StudioSourceSet {
  /** When its first frame enters a lane with no compensation; -Infinity for the set Play started. */
  readonly at: number
  /** Per lane: its sources sum into `fadeOut`, which feeds `fadeIn`, which feeds the lane. */
  readonly fades: readonly { fadeOut: GainNode; fadeIn: GainNode }[]
  readonly sources: Map<AudioBufferSourceNode, StudioSourceEntry>
  retired: boolean
}

/** Stop a source now, playing or waiting, and take it and its edge gain out of the graph. */
export function stopStudioSource(
  source: AudioBufferSourceNode,
  gain: GainNode,
): void {
  source.onended = null
  try {
    source.stop()
  } catch {
    /* An ended source needs only disconnecting. */
  }
  source.disconnect()
  gain.disconnect()
}

/**
 * A new set's gains on every lane. With a time, it fades in there, each
 * lane at its own compensation; without one (Play's set) it is open from
 * the start, as the run's envelope does the attack.
 */
export function openStudioSourceSet(
  ctx: BaseAudioContext,
  lanes: readonly StudioLaneInput[],
  at: number | null,
): StudioSourceSet {
  const fades = lanes.map(({ input, compensation }) => {
    const fadeOut = ctx.createGain()
    const fadeIn = ctx.createGain()
    fadeOut.connect(fadeIn)
    fadeIn.connect(input)
    if (at !== null) {
      fadeIn.gain.value = 0
      fadeIn.gain.setValueCurveAtTime(
        FADE_IN,
        at + compensation,
        SEEK_CROSSFADE_SECONDS,
      )
    }
    return { fadeOut, fadeIn }
  })
  return { at: at ?? -Infinity, fades, sources: new Map(), retired: false }
}

/**
 * Fade a set out from `at`, each lane at its own compensation. Its sources
 * that start before the fade is over stop then; those due to start later
 * never do. Returns whether it still holds a source, so its gains stay
 * connected.
 */
export function retireStudioSourceSet(
  set: StudioSourceSet,
  lanes: readonly StudioLaneInput[],
  at: number,
): boolean {
  set.retired = true
  for (const [index, { fadeOut }] of set.fades.entries())
    fadeOut.gain.setValueCurveAtTime(
      FADE_OUT,
      at + lanes[index].compensation,
      SEEK_CROSSFADE_SECONDS,
    )
  for (const [source, entry] of set.sources) {
    const fadeEnd = at + lanes[entry.lane].compensation + SEEK_CROSSFADE_SECONDS
    if (entry.when < fadeEnd) {
      source.stop(fadeEnd)
      continue
    }
    stopStudioSource(source, entry.gain)
    set.sources.delete(source)
  }
  return set.sources.size > 0
}

/** Stop every source in a set and leave its gains as they are, for a newer seek to fill. */
export function emptyStudioSourceSet(set: StudioSourceSet): void {
  for (const [source, { gain }] of set.sources) stopStudioSource(source, gain)
  set.sources.clear()
}

/** Take a set's gains out of the graph. Its sources must already have stopped. */
export function closeStudioSourceSet(set: StudioSourceSet): void {
  for (const { fadeOut, fadeIn } of set.fades) {
    fadeOut.disconnect()
    fadeIn.disconnect()
  }
}
