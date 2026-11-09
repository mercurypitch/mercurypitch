// Studio MIDI time — every conversion between a sequence's ticks and 48 kHz frames, at the tempo its ticks were laid on, and a clip's window in ticks.
//
// The one place tick and frame arithmetic lives, so a tempo map later
// changes this module alone (docs/plans/studio-midi.md, decision 3). A
// sequence counts its ticks from its own start: tick 0 is frame 0 of the
// audio rendered from it, and of a recorded take's audio, which is where
// its clip's source frames count from.
import type { StudioClip, StudioSequence } from '../model/types'
import { STUDIO_PPQ, STUDIO_SAMPLE_RATE } from '../model/types'

/** Far below a tick's worth of float noise: a frame on a tick's edge belongs to that tick. */
const EPSILON = 1e-6

/** `frames` in ticks at `tempoBpm`, unrounded. */
function exactTicks(frames: number, tempoBpm: number): number {
  return (frames / STUDIO_SAMPLE_RATE) * (tempoBpm / 60) * STUDIO_PPQ
}

/** Recording: the tick `frames` falls on, to the nearest. */
export function studioFramesToTicks(frames: number, tempoBpm: number): number {
  return Math.round(exactTicks(frames, tempoBpm))
}

/** Rendering and drawing: the frame tick `ticks` sounds on, unrounded. */
export function studioTicksToFrames(ticks: number, tempoBpm: number): number {
  return (ticks / STUDIO_PPQ) * (60 / tempoBpm) * STUDIO_SAMPLE_RATE
}

/** The first whole tick at or after frame `frames`. */
function firstTickFrom(frames: number, tempoBpm: number): number {
  return Math.ceil(exactTicks(frames, tempoBpm) - EPSILON)
}

/** The fewest whole ticks whose render holds `frames` frames: a sequence's length for audio this long. */
export function studioTicksCovering(frames: number, tempoBpm: number): number {
  return Math.max(1, firstTickFrom(frames, tempoBpm))
}

/** The ticks of a sequence a clip plays: a note starting from `startTick` up to, not including, `endTick` is heard. */
export interface StudioTickWindow {
  readonly startTick: number
  readonly endTick: number
}

/** A clip's window in its sequence's ticks, from its source frames. */
export function studioClipTickWindow(
  clip: Pick<StudioClip, 'sourceInFrame' | 'sourceOutFrame'>,
  sequence: Pick<StudioSequence, 'tempoBpm'>,
): StudioTickWindow {
  return {
    startTick: firstTickFrom(clip.sourceInFrame, sequence.tempoBpm),
    endTick: firstTickFrom(clip.sourceOutFrame, sequence.tempoBpm),
  }
}

/** The song frame tick `tick` of the clip's sequence sounds on, unrounded. */
export function studioTickToSongFrame(
  clip: Pick<StudioClip, 'startFrame' | 'sourceInFrame'>,
  sequence: Pick<StudioSequence, 'tempoBpm'>,
  tick: number,
): number {
  return (
    clip.startFrame -
    clip.sourceInFrame +
    studioTicksToFrames(tick, sequence.tempoBpm)
  )
}

/** Where song frame `frame` falls in the clip's sequence, in ticks, unrounded: a playhead over the notes. */
export function studioSongFrameToTick(
  clip: Pick<StudioClip, 'startFrame' | 'sourceInFrame'>,
  sequence: Pick<StudioSequence, 'tempoBpm'>,
  frame: number,
): number {
  return exactTicks(
    frame - (clip.startFrame - clip.sourceInFrame),
    sequence.tempoBpm,
  )
}

/** The song's beats over a clip's sequence: the bar and beat lines a roll draws, in the sequence's ticks. */
export interface StudioSongBeats {
  /** Ticks of the sequence one beat of the song lasts, unrounded. */
  readonly beatTicks: number
  /** The sequence's tick on the song's first frame, where its bar 1 starts: unrounded, and below 0 for a clip later in the song. */
  readonly originTick: number
}

/**
 * The song's beats at `songTempoBpm` counted in the sequence's ticks. They
 * fall on the sequence's own beats only while the song keeps the tempo the
 * sequence was laid on; after a change of the song's tempo the notes stay
 * where they were played, and the song's beats move over them.
 */
export function studioSongBeats(
  clip: Pick<StudioClip, 'startFrame' | 'sourceInFrame'>,
  sequence: Pick<StudioSequence, 'tempoBpm'>,
  songTempoBpm: number,
): StudioSongBeats {
  const originTick = studioSongFrameToTick(clip, sequence, 0)
  const beatFrames = (60 / songTempoBpm) * STUDIO_SAMPLE_RATE
  return {
    beatTicks: studioSongFrameToTick(clip, sequence, beatFrames) - originTick,
    originTick,
  }
}
