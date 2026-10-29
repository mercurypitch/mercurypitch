// Studio heard clock — the render-clock time at the speakers now, smooth between audio callbacks, for a playhead drawn every display frame.
//
// currentTime moves in steps of one audio callback, 10 ms or more, so a
// playhead read from it every display frame stutters. The output timestamp
// says which render time the speakers played at a known performance time;
// counting on from there gives the time heard now, which never passes the
// render clock itself.
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
        contextTime + Math.max(0, now - performanceTime) / 1000,
      )
  }
  return heardTime(ctx)
}
