// Studio playhead motion — the playhead line moves on the compositor while the song plays, checked against the audio clock on every transport tick.
//
// Writing the line's transform on every 33 ms tick moved it in steps and
// had the page restyle and composite 30 times a second. Here each line gets
// one linear animation from the frame heard now to the end of the song, at
// the song's own rate, which the browser runs off the main thread. A tick
// only reads the clock and the animation's time. The line starts moving once
// the clock has moved steadily from one tick to the next, and starts again
// from the clock when the two part by more than DRIFT_SECONDS or the zoom
// changes. A jump (a seek, a loop) and a clock that stands still (the first
// frame on its way to the speakers, a seek's run being built) stand the line
// where its own style puts it until the clock moves on.
import { createSignal } from 'solid-js'

/** How far the line may run from the clock before it starts again where the clock is. */
export const STUDIO_PLAYHEAD_DRIFT_SECONDS = 0.02
/**
 * A clock that moved this much more or less than the time between two ticks
 * jumped (a seek, a loop) or stalled: the line stands until it moves on.
 */
export const STUDIO_PLAYHEAD_JUMP_SECONDS = 0.05

/** What the line follows: the frame heard now, and a call on every transport tick. */
export interface StudioPlayheadClock {
  frameNow(): number
  ticks(tick: () => void): () => void
}

interface StudioPlayheadMotionOptions {
  sampleRate: number
  frameNow(): number
  /** Where a frame sits on the line's axis, in pixels. */
  pixels(frame: number): number
  /** The last frame the line moves to. */
  endFrame(): number
}

export function createStudioPlayheadMotion(
  options: StudioPlayheadMotionOptions,
) {
  const elements = new Set<HTMLElement>()
  let animations: Animation[] = []
  // The frame the running animations started from.
  let origin: number | null = null
  // The clock at the last tick, and when (performance time, ms).
  let last: { frame: number; at: number } | null = null
  const [moving, setMoving] = createSignal(false)
  const drift = STUDIO_PLAYHEAD_DRIFT_SECONDS * options.sampleRate
  const jump = STUDIO_PLAYHEAD_JUMP_SECONDS * options.sampleRate

  function cancel(): void {
    for (const animation of animations) animation.cancel()
    animations = []
    origin = null
  }

  function start(frame: number): void {
    cancel()
    const end = options.endFrame()
    if (end > frame) {
      const keyframes = [
        { transform: `translateX(${options.pixels(frame)}px)` },
        { transform: `translateX(${options.pixels(end)}px)` },
      ]
      const timing: KeyframeAnimationOptions = {
        duration: ((end - frame) / options.sampleRate) * 1000,
        easing: 'linear',
        fill: 'forwards',
      }
      for (const element of elements)
        if (typeof element.animate === 'function')
          animations.push(element.animate(keyframes, timing))
    }
    origin = animations.length > 0 ? frame : null
    setMoving(origin !== null)
  }

  /**
   * The frame the animations show at `now`: null when none runs, undefined
   * while one waits for its first frame. currentTime would not do: on this
   * thread it stands at the last frame drawn, up to a frame behind the clock.
   */
  function animatedFrame(now: number): number | null | undefined {
    if (origin === null) return null
    const started = animations[0]?.startTime
    if (typeof started !== 'number') return undefined
    return origin + ((now - started) / 1000) * options.sampleRate
  }

  return {
    /** Whether an animation moves the line: its own style is then left alone. */
    moving,
    /** Move `element` with the others from now on; the returned function lets it go. */
    attach(element: HTMLElement): () => void {
      elements.add(element)
      if (origin !== null) start(options.frameNow())
      return () => {
        elements.delete(element)
      }
    },
    /** Read the clock on a tick: follow it, stand still with it, or start again where it went. */
    check(now: number = performance.now()): void {
      const frame = options.frameNow()
      const previous = last
      last = { frame, at: now }
      const steady =
        previous !== null &&
        frame > previous.frame &&
        Math.abs(
          frame -
            previous.frame -
            ((now - previous.at) / 1000) * options.sampleRate,
        ) <= jump
      if (!steady) {
        if (origin !== null) {
          cancel()
          setMoving(false)
        }
        return
      }
      const shown = animatedFrame(now)
      if (
        shown === null ||
        (shown !== undefined && Math.abs(shown - frame) > drift)
      )
        start(frame)
    },
    /** The zoom or the song's length changed: a moving line starts again from the clock. */
    restart(): void {
      if (origin !== null) start(options.frameNow())
    },
    /** The song stopped, or the line is being dragged: it stands where its style puts it. */
    stop(): void {
      cancel()
      last = null
      setMoving(false)
    },
  }
}

export type StudioPlayheadMotion = ReturnType<typeof createStudioPlayheadMotion>
