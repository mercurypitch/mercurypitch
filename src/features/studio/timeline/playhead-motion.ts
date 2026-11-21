// Studio playhead motion — the playhead line moves on the compositor while the song plays, kept to the audio clock on every transport tick: it holds where it is drawn through a stall, and moves back only to a clock that went back and stayed there, as a seek or a loop wrap moves it.
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
// behind runs a little faster. Only a line more than DRIFT_SECONDS behind
// jumps, forward, on to the clock.
//
// A clock that stops moving steadily has stalled, or was moved. When the
// audio thread ran 150 or 300 ms late, the clock ran on to the render clock
// and stood there until the thread caught up, then jumped on. Now and then
// the first output timestamp after it was dated 0.15 to 1.8 s ahead, which
// put one reading that far back (headless Chromium, Nov 2026). The line
// holds where it is drawn until the clock runs steadily again, then moves
// on from there, or jumps forward to a clock ahead of it. Standing it on its
// own style instead, the readouts' playhead, put it up to 168 ms back.
//
// A clock that was running steadily and jumps more than SEEK_SECONDS from
// the line was moved by a seek or a loop wrap, or read once wrong: the line
// holds, and goes there if the next tick finds the clock still there or
// running on from there. A clock found running steadily more than
// LOST_SECONDS behind the line, as after a seek made while it stood still,
// takes the line back too. While a song plays, nothing else moves the line
// back; Stop and a drag stand it on its own style (StudioTimeline.tsx).
import { createSignal } from 'solid-js'

/** How far the line may fall behind the clock before it jumps on to where the clock is. */
export const STUDIO_PLAYHEAD_DRIFT_SECONDS = 0.02
/**
 * A clock that moved this much more or less than the time between two ticks
 * stalled, or was moved by a seek or a loop wrap.
 */
export const STUDIO_PLAYHEAD_JUMP_SECONDS = 0.05
/**
 * A clock that was running steadily and jumps this far from the line, then
 * stays there or runs on from there, was moved by a seek or a loop wrap:
 * just under the shortest loop (STUDIO_MIN_LOOP_FRAMES), a wrap moving the
 * clock back by the loop's length. A smaller jump is a stall's.
 */
export const STUDIO_PLAYHEAD_SEEK_SECONDS = 0.2
/**
 * A clock found running steadily this far behind the line, as after a seek
 * made while it stood still, takes the line back to it.
 */
export const STUDIO_PLAYHEAD_LOST_SECONDS = 0.5
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

/**
 * Where the running animations draw the line: `frame` at page time `at`
 * (ms), moving `speed` times as fast as the song. Speed 0 holds it there.
 */
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
  // Null while no animation moves or holds the line.
  let course: Course | null = null
  // The clock at the last tick, and when (performance time, ms).
  let last: { frame: number; at: number } | null = null
  // Whether the clock moved steadily up to the last tick.
  let running = false
  // Where the clock jumped to at the last tick, from steady running, far
  // from the line: a seek or a loop wrap, if the next tick agrees.
  let jumpedTo: number | null = null
  const [moving, setMoving] = createSignal(false)
  const drift = STUDIO_PLAYHEAD_DRIFT_SECONDS * options.sampleRate
  const jump = STUDIO_PLAYHEAD_JUMP_SECONDS * options.sampleRate
  const seek = STUDIO_PLAYHEAD_SEEK_SECONDS * options.sampleRate
  const lost = STUDIO_PLAYHEAD_LOST_SECONDS * options.sampleRate
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
    const held = on.speed === 0
    const animation = element.animate(
      [
        { transform: `translateX(${options.pixels(on.frame)}px)` },
        { transform: `translateX(${options.pixels(held ? on.frame : end)}px)` },
      ],
      {
        duration: held
          ? 1000
          : ((end - on.frame) / options.sampleRate / on.speed) * 1000,
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

  /**
   * The clock stands where a seek or a loop wrap took it, or runs on from
   * there, and this tick agrees with the last: the line goes there.
   */
  function goToJump(on: Course, frame: number, now: number): void {
    if (running || on.speed > 0 || on.frame !== frame)
      run({ frame, at: now, speed: running ? 1 : 0 })
  }

  /**
   * A stall, or a jump the next tick has yet to confirm: the line holds where
   * it is drawn, or where a clock ahead of it went.
   */
  function holdThroughStall(
    on: Course,
    tick: { frame: number; drawn: number; now: number; ran: boolean },
  ): void {
    const { frame, drawn, now, ran } = tick
    if (ran && Math.abs(frame - drawn) > seek) jumpedTo = frame
    const place = Math.max(drawn, frame)
    if (on.speed > 0 || place > on.frame)
      run({ frame: place, at: now, speed: 0 })
  }

  return {
    /** Whether an animation moves or holds the line: its own style is then left alone. */
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
    /** Read the clock on a tick: follow it, hold through a stall, or go where a seek or a loop wrap moved it. */
    check(now: number = performance.now()): void {
      const frame = options.frameNow()
      const previous = last
      const ran = running
      const jumped = jumpedTo
      last = { frame, at: now }
      jumpedTo = null
      if (previous === null) {
        running = false
        return
      }
      // The frames the song played since the last tick.
      const played = ((now - previous.at) / 1000) * options.sampleRate
      running =
        frame > previous.frame &&
        Math.abs(frame - previous.frame - played) <= jump
      if (course === null) {
        if (running) run({ frame, at: now, speed: 1 })
        return
      }
      if (
        jumped !== null &&
        frame >= jumped - jump &&
        frame - jumped <= played + jump
      ) {
        goToJump(course, frame, now)
        return
      }
      const drawn = drawnAt(course, now)
      if (!running) {
        holdThroughStall(course, { frame, drawn, now, ran })
        return
      }
      // Positive while the clock is ahead of the line.
      const gap = frame - drawn
      if (gap > drift || gap < -lost) {
        run({ frame, at: now, speed: 1 })
        return
      }
      const speed = Math.max(SLOWEST, 1 + gap / follow)
      if (Math.abs(speed - course.speed) >= SPEED_STEP)
        run({ frame: drawn, at: now, speed })
    },
    /** The zoom or the song's length changed: a moving or held line goes on from where it is drawn. */
    restart(now: number = performance.now()): void {
      if (course !== null)
        run({ frame: drawnAt(course, now), at: now, speed: course.speed })
    },
    /** The song stopped, or the line is being dragged: it stands where its style puts it. */
    stop(): void {
      cancel()
      last = null
      running = false
      jumpedTo = null
      setMoving(false)
    },
  }
}

export type StudioPlayheadMotion = ReturnType<typeof createStudioPlayheadMotion>
