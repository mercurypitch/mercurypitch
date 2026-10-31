// ============================================================
// Studio whole frames — every buffer source starts on a frame of the audio clock, never between two
// ============================================================
//
// A buffer source started between two frames plays its whole clip by linear
// interpolation, a fractional delay that dulls the treble by however far
// between the frames it started: at half a frame, 5 dB down at 15 kHz on a
// 48 kHz clock. So a Play that took a place half a frame off sounded duller
// than one that did not: the same dry lane 2.0 dB down at 10 kHz and 5.1 dB
// down at 15 kHz (scripts/check-studio-epoch-browser.mjs).
//
// Measured on OfflineAudioContext, 48 and 44.1 kHz: Chromium 148 and
// WebKitGTK 2.54 start a source asked for up to 3e-4 of a frame past a
// frame on that frame, an exact copy, and interpolate one asked for 1e-10
// of a frame or more before it. Firefox 150 rounds every start to the
// nearest frame. So a start time goes on its frame or a hair past it, never
// a hair before (frameTime).
//
// A run takes a fresh place on the clock on a whole frame
// (wholeFrameAtOrAfter): a Play, a Play after Pause, a seek. Everything it
// times from that place (a clip, a pass of a loop, a re-plan, a chain swap,
// a handover) is whole frames of Studio's 48 kHz timeline later, which on a
// 48 kHz clock are whole frames of the clock, so each source starts on its
// sample once float noise is taken off (onWholeFrame). A clock at another
// rate, 44.1 kHz, resamples every 48 kHz take as it plays: its sources keep
// their exact places between frames, and the whole-frame place makes every
// Play interpolate them the same way.

/** Float noise a time may carry and still count as on its frame, in frames: far under the 3e-4 a browser forgives. */
const FRAME_NOISE = 1e-5

/** When frame `frame` of a `rate` clock plays: on it or a hair past it, never a hair before (see the header). */
export function frameTime(frame: number, rate: number): number {
  let time = frame / rate
  // Under the frame by float noise, which a browser would interpolate: an
  // ulp or two up puts it on.
  while (time * rate < frame) time += time * Number.EPSILON
  return time
}

/** The first whole frame of a `rate` clock at or after `time`; float noise past a frame counts as on it. */
export function wholeFrameAtOrAfter(time: number, rate: number): number {
  return frameTime(Math.ceil(time * rate - FRAME_NOISE), rate)
}

/** `time` on its frame of a `rate` clock when float noise is all that holds it off one; a time between frames stays as it is. */
export function onWholeFrame(time: number, rate: number): number {
  const frames = time * rate
  const frame = Math.round(frames)
  return Math.abs(frames - frame) <= FRAME_NOISE ? frameTime(frame, rate) : time
}
