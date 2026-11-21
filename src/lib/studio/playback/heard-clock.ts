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
//
// Now and then the first stamp after the audio thread ran late was dated
// far further ahead, 0.15 to 1.8 s, and counting back from it put one
// reading that far back. A stamp dated more than STAMP_AHEAD_LIMIT_MS ahead
// is not believed: the reading goes on from the last stamp that was, on the
// same line. Falling back to heardTime, the render clock less the output
// latency, stepped it back 83 to 96 ms from where the stall had stood it.
import { heardTime } from './run'

/**
 * A stamp dated further than this after the call that reads it was
 * misdated: twice the most a sound stamp was dated ahead.
 */
export const STUDIO_STAMP_AHEAD_LIMIT_MS = 100
/** How long after it was read the last trusted stamp may stand in for one misdated. */
const TRUSTED_FOR_MS = 1000

interface TrustedStamp {
  contextTime: number
  performanceTime: number
  /** The page time it was read at. */
  readAt: number
}

const trusted = new WeakMap<BaseAudioContext, TrustedStamp>()

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
    ) {
      let stamp: Omit<TrustedStamp, 'readAt'> = { contextTime, performanceTime }
      if (performanceTime - now > STUDIO_STAMP_AHEAD_LIMIT_MS) {
        const last = trusted.get(ctx)
        if (last === undefined || now - last.readAt > TRUSTED_FOR_MS)
          return heardTime(ctx)
        stamp = last
      } else trusted.set(ctx, { contextTime, performanceTime, readAt: now })
      return Math.min(
        ctx.currentTime,
        stamp.contextTime + (now - stamp.performanceTime) / 1000,
      )
    }
  }
  // A context that stops, or plays nothing yet, starts a new line after.
  trusted.delete(ctx)
  return heardTime(ctx)
}
