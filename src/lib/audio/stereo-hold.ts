// ============================================================
// Stereo hold — keeps a stereo path at two channels after its sources end
// ============================================================
//
// Chromium resets a DelayNode, a biquad or IIR filter and an oversampled
// WaveShaperNode whenever its input changes channel count. A stereo path
// changes it when its last source ends: one render quantum later the
// finished source's outputs are disabled down to the first node with a tail,
// an input with nothing enabled counts as one channel, and those nodes drop
// what they still hold (an echo's reflections, a delay's last milliseconds,
// a filter's ring). A mono path never changes count, so it loses nothing.
//
// The hold is a zero delay fixed at two channels. It has a tail, so it stays
// enabled for `seconds` after the sources end and keeps everything after it
// at two channels until then. Put it at the head of the path, and give it at
// least the longest delay behind it. It passes audio bit for bit. Studio's
// effect chains hold the same way (`stereoHold` in src/lib/studio-fx/chain.ts).

/** A zero delay fixed at two channels, enabled for `seconds` after its sources end. */
export function createStereoHold(
  ctx: BaseAudioContext,
  seconds: number,
): DelayNode {
  const hold = ctx.createDelay(seconds)
  hold.delayTime.value = 0
  hold.channelCount = 2
  hold.channelCountMode = 'explicit'
  return hold
}
