// ============================================================
// Lesson listener — the microphone, one take at a time
// ============================================================
//
// The first lesson code that listens. It is its own chunk, imported only when
// the viewer presses Start, so a page that is only read never loads the
// microphone, the pitch detector or Voice Mirror's scorer (`take.ts`, which
// this re-exports so a page needs one import).
//
// It reuses the app's own chain (FACTS 57): the one shared owner of the
// device, `micManager`, with echo cancellation, noise suppression and gain
// control off for analysis, under the page's consumer id; the YIN-only F0
// stream built for standalone pages (no model weights, `pitch-core`), on the
// page's one AudioContext (`Sound.context()`), so every note the page sings
// and every frame it hears share a clock. It registers with the mic
// sentinel like every surface that holds the device.
//
// Nothing is recorded or kept: a take is the pitch frames of one reply,
// held in memory until it is read and then dropped (REQ-GVC-004), and
// nothing leaves the device (REQ-GVC-003). The page lets go of the device
// when its run ends, when the viewer leaves the section, when the tab is
// hidden and when the page is hidden for good (`release`, `releaseNow`).

import { micManager } from '@/lib/mic-manager'
import { registerMicIndicator } from '@/lib/mic-sentinel'
import type { F0Frame } from '@/lib/mirror/metrics'
import { CONF_MIN } from '@/lib/mirror/metrics'
import type { F0Stream, PitchFrame } from '@/lib/pitch-f0-stream'
import { createF0Stream } from '@/lib/pitch-f0-stream'

export * from './take'
export { foldCents, hzToCents } from '@/lib/mirror/metrics'
export type { PitchFrame }

export interface Listener {
  /** True while this page holds the microphone. */
  readonly holding: boolean
  /** The newest frame, smoothed for drawing (never for reading). */
  latest(): PitchFrame | null
  /** Lets go of the microphone; the device closes after the manager's short linger. */
  release(): void
  /** Lets go now, with no linger: the tab is hidden or the page is going. */
  releaseNow(): void
}

let current: (Listener & { stream: F0Stream }) | null = null

/**
 * Holds the microphone for `id` (the page's consumer id, `lesson-03`) on
 * `context`, or rejects: permission refused, no device, another tab holding
 * it. Asked for only from the tap that starts a run.
 */
export async function listen(
  id: string,
  context: AudioContext,
): Promise<Listener> {
  if (current?.holding === true) return current
  const media = await micManager.acquire(id)
  const stream = createF0Stream(context, media)
  let holding = true
  let unregister: () => void = () => undefined
  const letGo = (now: boolean): void => {
    if (!holding) return
    holding = false
    stream.dispose()
    unregister()
    if (now) void micManager.forceReleaseAll()
    else micManager.release(id)
  }
  const listener = {
    stream,
    get holding() {
      return holding
    },
    latest: () => stream.latestSmoothed(),
    release: () => letGo(false),
    releaseNow: () => letGo(true),
  }
  unregister = registerMicIndicator(
    id,
    () => holding,
    () => letGo(true),
  )
  current = listener
  return listener
}

export interface TakeOptions {
  /** Seconds to wait for the first voiced frame (6). */
  readonly wait: number
  /** Seconds of the take once the voice has started (3). */
  readonly run: number
  /**
   * Ends the take early once the voice, having started, has been silent this
   * many seconds on the frames' clock: a hold the singer stops (Lesson 5's
   * one second). Absent, a take always runs `run` seconds.
   */
  readonly quiet?: number
  /** Every animation frame while the take is open: the newest frame, and when the voice began (null before). */
  readonly onFrame?: (frame: PitchFrame | null, voicedAt: number | null) => void
  /** Ends the take early, with nothing to read: the viewer left. */
  readonly cancelled: () => boolean
}

const voiced = (f: F0Frame): boolean => f.f0 > 0 && f.conf >= CONF_MIN

/**
 * The next animation frame, or 100 ms, whichever comes first: a page that
 * stops compositing (a hidden tab) stops its frames, and a take must still
 * see that it was cancelled (MISTAKES.md, "requestAnimationFrame never fires
 * when the page is not compositing").
 */
function soon(fn: () => void): void {
  let done = false
  const run = (): void => {
    if (done) return
    done = true
    window.clearTimeout(timer)
    cancelAnimationFrame(frame)
    fn()
  }
  const frame = requestAnimationFrame(run)
  const timer = window.setTimeout(run, 100)
}

/** The newest voiced frame's time, or null for none. */
function lastVoiced(frames: readonly F0Frame[]): number | null {
  for (let i = frames.length - 1; i >= 0; i--)
    if (voiced(frames[i])) return frames[i].t
  return null
}

/** Whether a take is over: no voice in time, its run done, or (with `quiet`) the voice stopped. */
function takeOver(
  frames: readonly F0Frame[],
  voicedAt: number | null,
  waited: number,
  o: TakeOptions,
): boolean {
  if (voicedAt === null) return waited >= o.wait
  const last = frames[frames.length - 1]?.t ?? 0
  if (last >= voicedAt + o.run) return true
  if (o.quiet === undefined) return false
  return last - (lastVoiced(frames) ?? voicedAt) > o.quiet
}

/**
 * One take: waits up to `wait` seconds for the voice, then runs `run`
 * seconds from its first voiced frame, timed on the frames' own clock, or
 * less with `quiet` when the voice stops. Resolves with the raw frames, or
 * null if it was cancelled.
 */
export function takeFrames(
  l: Listener,
  o: TakeOptions,
): Promise<PitchFrame[] | null> {
  const stream = (l as Listener & { stream: F0Stream }).stream
  stream.startTask()
  const t0 = performance.now()
  return new Promise((resolve) => {
    let voicedAt: number | null = null
    const tick = (): void => {
      if (o.cancelled() || !l.holding) {
        stream.takeFrames()
        resolve(null)
        return
      }
      const frames = stream.peekFrames()
      if (voicedAt === null) voicedAt = frames.find(voiced)?.t ?? null
      o.onFrame?.(stream.latestSmoothed(), voicedAt)
      const waited = (performance.now() - t0) / 1000
      if (takeOver(frames, voicedAt, waited, o)) {
        resolve(stream.takeFrames())
        return
      }
      soon(tick)
    }
    soon(tick)
  })
}
