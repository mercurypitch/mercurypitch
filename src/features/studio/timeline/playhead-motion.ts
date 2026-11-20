// Studio playhead motion — the playhead line moves on the compositor while the song plays, kept to the audio clock on every transport tick and never stepped back.
//
// Writing the line's transform on every 33 ms tick moved it in steps and
// had the page restyle and composite 30 times a second. Here each line gets
// one linear animation to the end of the song, which the browser runs off
// the main thread. A tick only reads the clock. The line starts moving once
// the clock has moved steadily from one tick to the next.
//
// Each animation starts at the time of the tick that read the clock. Left
// to start itself, an animation starts on the page's next frame, 6 to 31 ms
// after the tick on a busy page (Chromium, Nov 2026), and the line trailed
// the clock by that much from every start.
//
// The audio device's clock still runs a little fast or slow against the
// page's, so the line and the clock part slowly. A line that pulls ahead
// runs a little slower until the clock catches up, and one that drops
// behind runs a little faster: the line never steps back to the clock while
// it plays. Only a line more than DRIFT_SECONDS behind jumps on to it. A
// jump (a seek, a loop) and a clock that stands still (the first frame on
// its way to the speakers, a seek's run being built) stand the line where
// its own style puts it until the clock moves on.
import { createSignal } from 'solid-js'

/** How far the line may fall behind the clock before it jumps on to where the clock is. */
export const STUDIO_PLAYHEAD_DRIFT_SECONDS = 0.02
/**
 * A clock that moved this much more or less than the time between two ticks
 * jumped (a seek, a loop) or stalled: the line stands until it moves on.
 */
export const STUDIO_PLAYHEAD_JUMP_SECONDS = 0.05
/** A gap to the clock changes the line's speed by its own length per this many seconds. */
export const STUDIO_PLAYHEAD_FOLLOW_SECONDS = 1
/** A change of speed smaller than this is not worth starting the line's animations again. */
const SPEED_STEP = 0.005
/** The slowest the line runs while it waits for the clock to catch up. */
const SLOWEST = 0.5

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

/** Where the running animations draw the line: `frame` at page time `at` (ms), moving `speed` times as fast as the song. */
interface Course {
  frame: number
  at: number
  speed: number
}

export function createStudioPlayheadMotion(
  options: StudioPlayheadMotionOptions,
) {
  const elements = new Set<HTMLElement>()
  let animations: Animation[] = []
  // Null while no animation moves the line.
  let course: Course | null = null
  // The clock at the last tick, and when (performance time, ms).
  let last: { frame: number; at: number } | null = null
  const [moving, setMoving] = createSignal(false)
  const drift = STUDIO_PLAYHEAD_DRIFT_SECONDS * options.sampleRate
  const jump = STUDIO_PLAYHEAD_JUMP_SECONDS * options.sampleRate
  const follow = STUDIO_PLAYHEAD_FOLLOW_SECONDS * options.sampleRate

  /** The frame `on` draws the line at, at page time `now`. */
  const drawnAt = (on: Course, now: number) =>
    on.frame + ((now - on.at) / 1000) * options.sampleRate * on.speed

  function cancel(): void {
    for (const animation of animations) animation.cancel()
    animations = []
    course = null
  }

  /** Run `element` along `on`, to `end`; null where it cannot animate. */
  function animate(
    element: HTMLElement,
    on: Course,
    end: number,
  ): Animation | null {
    if (typeof element.animate !== 'function') return null
    const animation = element.animate(
      [
        { transform: `translateX(${options.pixels(on.frame)}px)` },
        { transform: `translateX(${options.pixels(end)}px)` },
      ],
      {
        duration: ((end - on.frame) / options.sampleRate / on.speed) * 1000,
        easing: 'linear',
        // A frame drawn before `at`, on a page that drew late, holds the
        // first place rather than letting the line's own style show.
        fill: 'both',
      },
    )
    animation.startTime = on.at
    return animation
  }

  function run(on: Course): void {
    cancel()
    const end = options.endFrame()
    if (end > on.frame)
      for (const element of elements) {
        const animation = animate(element, on, end)
        if (animation) animations.push(animation)
      }
    course = animations.length > 0 ? on : null
    setMoving(course !== null)
  }

  return {
    /** Whether an animation moves the line: its own style is then left alone. */
    moving,
    /** Move `element` with the others from now on; the returned function lets it go. */
    attach(element: HTMLElement): () => void {
      elements.add(element)
      const end = options.endFrame()
      if (course !== null && end > course.frame) {
        const animation = animate(element, course, end)
        if (animation) animations.push(animation)
      }
      return () => {
        elements.delete(element)
      }
    },
    /** Read the clock on a tick: follow it, stand still with it, or move on from where it went. */
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
        if (course !== null) {
          cancel()
          setMoving(false)
        }
        return
      }
      if (course === null) {
        run({ frame, at: now, speed: 1 })
        return
      }
      const drawn = drawnAt(course, now)
      // Positive while the clock is ahead of the line.
      const gap = frame - drawn
      if (gap > drift) {
        run({ frame, at: now, speed: 1 })
        return
      }
      const speed = Math.max(SLOWEST, 1 + gap / follow)
      if (Math.abs(speed - course.speed) >= SPEED_STEP)
        run({ frame: drawn, at: now, speed })
    },
    /** The zoom or the song's length changed: a moving line goes on from where it is drawn. */
    restart(now: number = performance.now()): void {
      if (course !== null)
        run({ frame: drawnAt(course, now), at: now, speed: course.speed })
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
