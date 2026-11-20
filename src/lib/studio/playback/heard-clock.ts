// Studio heard clock — the render-clock time at the speakers now, smooth between audio callbacks, for a playhead drawn every display frame.
//
// currentTime moves in steps of one audio callback, 10 ms or more, so a
// playhead read from it every display frame stutters. The output timestamp
// says which render time the speakers play at a known performance time;
// counting from there to now gives the time heard now, which never passes
// the render clock itself.
//
// That performance time can lie after the call that reads it: Chromium
// dated 84 % of a six-lane song's timestamps up to 48 ms ahead (headless,
// Nov 2026), each still on the same line of render time against page time.
// Counting back from such a stamp stays on that line. Taking its render
// time as heard now put the reading ahead by however far the stamp was
// dated, a different amount every callback, and the playhead line that
// follows this clock jumped back and forth with it
// (timeline/playhead-motion.ts).
import { heardTime } from './run'

export function smoothHeardTime(
  ctx: BaseAudioContext,
  now: number = performance.now(),
): number {
  const live = ctx as Partial<Pick<AudioContext, 'getOutputTimestamp'>>
  if (
    ctx.state === 'running' &&
    typeof live.getOutputTimestamp === 'function'
  ) {
    const { contextTime, performanceTime } = live.getOutputTimestamp()
    // Zeros until the device has played something; nonsense is ignored too.
    if (
      contextTime !== undefined &&
      performanceTime !== undefined &&
      Number.isFinite(contextTime) &&
      Number.isFinite(performanceTime) &&
      performanceTime > 0
    )
      return Math.min(
        ctx.currentTime,
        contextTime + (now - performanceTime) / 1000,
      )
  }
  return heardTime(ctx)
}
