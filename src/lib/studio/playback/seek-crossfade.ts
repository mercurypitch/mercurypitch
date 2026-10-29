// ============================================================
// Studio lane crossfade — a lane fades from the sources it plays to new ones, ahead of its chain, so effect tails ring on
// ============================================================
//
// A playing graph keeps its chains, master and meters through a seek or a
// clip edit; only sources change. Each lane takes its sources through two
// gains per set of sources: Play starts one set, and each seek, and each
// edit to that lane's clips, another. The old set's fade-out and the new
// set's fade-in run on the same lane, on the same frames, before the lane's
// chain, so a reverb or delay goes on ringing with what it already had.
//
// Two shapes, for two kinds of change:
//
// - Unrelated material, a seek's two places in the song or a clip moved
//   under the playhead: equal power, not linear. The two sides share
//   nothing, so their powers add, and sin² + cos² holds the level where a
//   linear pair sags 3 dB at its middle. 10 ms, from renders of this fade in
//   Chromium at 5, 10 and 15 ms. Over unrelated material none of them dips
//   beyond the level's own ripple. A shorter fade clicks: a 41 to 110 Hz bass
//   note jumping phase splatters -59 dBFS above 1 kHz at 5 ms, -67 at 10 and
//   -71 at 15. A longer one sags where both sides hold the same tone out of
//   phase: the worst 20 ms window falls 0.8, 1.7 and 2.8 dB. 10 ms keeps that
//   under 2 dB and the click 8 dB under the 5 ms one.
// - The same audio on the same frames, a clip's gain or fade changed: linear
//   over 30 ms, as a handoff between two runs of the same song (handoff.ts).
//   The two sides are one signal at two levels, so the linear sum moves
//   straight from one level to the other; equal power would swell 3 dB half
//   way.
//
// Fade-in and fade-out sit on separate gains so a change that comes while the
// last one is still fading in never schedules over its curve, which Web
// Audio refuses.

export const SEEK_CROSSFADE_SECONDS = 0.01
/** A lane crossing to the same audio at another level: as long as a handoff. */
export const SAME_AUDIO_CROSSFADE_SECONDS = 0.03

/** How a set fades in and how the one it replaces fades out. */
export interface StudioFadeShape {
  readonly seconds: number
  readonly fadeIn: Float32Array
  readonly fadeOut: Float32Array
}

const CURVE_POINTS = 33
const SINE = Float32Array.from({ length: CURVE_POINTS }, (_, index) =>
  Math.sin((Math.PI / 2) * (index / (CURVE_POINTS - 1))),
)

/** Two unrelated places: the powers add, so the gains' squares sum to one. */
export const EQUAL_POWER_FADE: StudioFadeShape = {
  seconds: SEEK_CROSSFADE_SECONDS,
  fadeIn: SINE,
  fadeOut: SINE.slice().reverse(),
}

/** The same audio on the same frames: the gains sum to one. */
export const LINEAR_FADE: StudioFadeShape = {
  seconds: SAME_AUDIO_CROSSFADE_SECONDS,
  fadeIn: Float32Array.of(0, 1),
  fadeOut: Float32Array.of(1, 0),
}

/** Where a lane's sources go, and how much later than the slowest lane they start. */
export interface StudioLaneInput {
  readonly input: AudioNode
  readonly compensation: number
}

/** A started source, the gain that shapes its clip's edges, and when it starts. */
export interface StudioSourceEntry {
  readonly gain: GainNode
  /** The repeat pass it belongs to; the first is 0. */
  pass: number
  readonly when: number
}

/** The sources one Play, seek or clip edit started on a lane, and the gains that fade them as a set. */
export interface StudioSourceSet {
  /** When its first frame enters a lane with no compensation; -Infinity for the set Play started. */
  readonly at: number
  /** The lane input it feeds and that input's compensation. */
  readonly lane: StudioLaneInput
  /** Its sources sum into `fadeOut`, which feeds `fadeIn`, which feeds the lane. */
  readonly fadeOut: GainNode
  readonly fadeIn: GainNode
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
 * A new set's gains on a lane. With a time, it fades in then, at the lane's
 * compensation; without one (Play's set) it is open from the start, as the
 * run's envelope does the attack.
 */
export function openStudioSourceSet(
  ctx: BaseAudioContext,
  lane: StudioLaneInput,
  at: number | null,
  shape: StudioFadeShape = EQUAL_POWER_FADE,
): StudioSourceSet {
  const fadeOut = ctx.createGain()
  const fadeIn = ctx.createGain()
  fadeOut.connect(fadeIn)
  fadeIn.connect(lane.input)
  if (at !== null) {
    fadeIn.gain.value = 0
    fadeIn.gain.setValueCurveAtTime(
      shape.fadeIn,
      at + lane.compensation,
      shape.seconds,
    )
  }
  return {
    at: at ?? -Infinity,
    lane,
    fadeOut,
    fadeIn,
    sources: new Map(),
    retired: false,
  }
}

/**
 * Fade a set out from `at`, at its lane's compensation. Its sources that
 * start before the fade is over stop then; those due to start later never
 * do. Returns whether it still holds a source, so its gains stay connected.
 */
export function retireStudioSourceSet(
  set: StudioSourceSet,
  at: number,
  shape: StudioFadeShape = EQUAL_POWER_FADE,
): boolean {
  set.retired = true
  const start = at + set.lane.compensation
  set.fadeOut.gain.setValueCurveAtTime(shape.fadeOut, start, shape.seconds)
  const fadeEnd = start + shape.seconds
  for (const [source, entry] of set.sources) {
    if (entry.when < fadeEnd) {
      source.stop(fadeEnd)
      continue
    }
    stopStudioSource(source, entry.gain)
    set.sources.delete(source)
  }
  return set.sources.size > 0
}

/** Stop every source in a set and leave its gains as they are, for a newer change to fill. */
export function emptyStudioSourceSet(set: StudioSourceSet): void {
  for (const [source, { gain }] of set.sources) stopStudioSource(source, gain)
  set.sources.clear()
}

/** Take a set's gains out of the graph. Its sources must already have stopped. */
export function closeStudioSourceSet(set: StudioSourceSet): void {
  set.fadeOut.disconnect()
  set.fadeIn.disconnect()
}
