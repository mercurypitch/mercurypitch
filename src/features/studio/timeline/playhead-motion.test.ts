// Studio playhead motion tests — one compositor animation follows the clock from the tick that read it and closes a gap by speed; a seek or a loop wrap moves it back, and a stall holds it where it is drawn.
import { createRoot } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { createStudioPlayheadMotion } from './playhead-motion'

const RATE = 48_000

/** The pixels a keyframe moves the line by. */
const shift = (keyframe: Keyframe) =>
  Number(/translateX\(([-\d.e]+)px\)/.exec(String(keyframe.transform))![1])

/** An element that keeps every animation started on it, with its timing and start time. */
function animatedElement() {
  const started: {
    keyframes: Keyframe[]
    timing: KeyframeAnimationOptions
    animation: Animation
  }[] = []
  const element = {
    animate: vi.fn(
      (keyframes: Keyframe[], timing: KeyframeAnimationOptions) => {
        const animation = {
          startTime: null,
          cancel: vi.fn(),
        } as unknown as Animation
        started.push({ keyframes, timing, animation })
        return animation
      },
    ),
  } as unknown as HTMLElement
  return { element, started }
}

/** Where the newest animation draws the line at page time `ms`, in pixels. */
function drawnBy(
  entry: ReturnType<typeof animatedElement>['started'][0],
  ms: number,
) {
  const from = shift(entry.keyframes[0])
  const to = shift(entry.keyframes[1])
  const progress =
    (ms - (entry.animation.startTime as number)) / Number(entry.timing.duration)
  return from + progress * (to - from)
}

function setup() {
  let frame = 0
  let scale = 100
  const motion = createStudioPlayheadMotion({
    sampleRate: RATE,
    frameNow: () => frame,
    pixels: (at) => (at / RATE) * scale,
    endFrame: () => 60 * RATE,
  })
  const line = animatedElement()
  motion.attach(line.element)
  return {
    motion,
    line,
    /** The clock reads `seconds` when the tick at `ms` checks it. */
    tick(seconds: number, ms: number) {
      frame = Math.round(seconds * RATE)
      motion.check(ms)
    },
    zoom(pixelsPerSecond: number) {
      scale = pixelsPerSecond
    },
  }
}

describe('Studio playhead motion', () => {
  it('starts one animation to the song end at the tick that read the clock, and leaves it while they agree', () => {
    createRoot((dispose) => {
      const f = setup()
      // The first reading cannot tell a moving clock from one that waits.
      f.tick(1, 0)
      expect(f.line.started).toHaveLength(0)
      f.tick(1.033, 33)
      expect(f.line.started).toHaveLength(1)
      expect(f.motion.moving()).toBe(true)
      const [first] = f.line.started
      expect(first.keyframes).toEqual([
        { transform: 'translateX(103.3px)' },
        { transform: 'translateX(6000px)' },
      ])
      // Placed by the tick, at the song's own speed, held at either end.
      expect(first.animation.startTime).toBe(33)
      expect(first.timing).toMatchObject({ easing: 'linear', fill: 'both' })
      expect(first.timing.duration).toBeCloseTo((60 - 1.033) * 1000, 6)
      // Thirty ticks a second for two seconds, a few ms early or late: each
      // reads the clock where the line is.
      for (let tick = 1; tick <= 60; tick++) {
        const ms = 33 + tick * 33.3 + (tick % 2 ? 4 : -4)
        f.tick(1.033 + (ms - 33) / 1000, ms)
        expect(drawnBy(first, ms)).toBeCloseTo(
          (1.033 + (ms - 33) / 1000) * 100,
          1,
        )
      }
      expect(f.line.started).toHaveLength(1)
      dispose()
    })
  })

  it('goes where a seek or a loop wrap moved a running clock once the next tick finds the clock still there', () => {
    createRoot((dispose) => {
      const f = setup()
      const last = () => f.line.started.at(-1)!
      const places = () => last().keyframes.map(shift)
      f.tick(1, 0)
      f.tick(1.033, 33)
      // A seek moved the heard run on to 20 s: the line goes there, held
      // until the next tick, then moves on with it.
      f.tick(20, 66)
      expect(f.line.started[0].animation.cancel).toHaveBeenCalled()
      expect(places()).toEqual([2000, 2000])
      f.tick(20.033, 99)
      expect(f.line.started).toHaveLength(3)
      expect(shift(last().keyframes[0])).toBeCloseTo(2003.3, 6)
      expect(last().timing.duration).toBeCloseTo((60 - 20.033) * 1000, 6)
      // A loop wraps back to 10 s: the line holds where it is drawn, and
      // goes back once the clock runs on from there.
      f.tick(10, 132)
      expect(places()[0]).toBeCloseTo(2006.6, 6)
      expect(places()[1]).toBe(places()[0])
      f.tick(10.033, 165)
      expect(f.line.started).toHaveLength(5)
      expect(shift(last().keyframes[0])).toBeCloseTo(1003.3, 6)
      expect(f.motion.moving()).toBe(true)
      dispose()
    })
  })

  it('holds where a seek put the clock while the seek’s run is built, back or forward', () => {
    createRoot((dispose) => {
      const f = setup()
      const last = () => f.line.started.at(-1)!
      const places = () => last().keyframes.map(shift)
      f.tick(10, 0)
      f.tick(10.033, 33)
      // Forward to 30 s: the clock holds the target for three ticks.
      f.tick(30, 66)
      expect(places()).toEqual([3000, 3000])
      const forward = f.line.started.length
      f.tick(30, 99)
      f.tick(30, 132)
      expect(f.line.started).toHaveLength(forward)
      f.tick(30.033, 165)
      expect(shift(last().keyframes[0])).toBeCloseTo(3003.3, 6)
      expect(last().timing.duration).toBeCloseTo((60 - 30.033) * 1000, 6)
      // Back to 5 s: the line holds where it is drawn for a tick, then
      // where the clock waits, then moves on from there.
      f.tick(30.066, 198)
      f.tick(5, 231)
      expect(places()[0]).toBeCloseTo(3009.9, 6)
      f.tick(5, 264)
      expect(places()).toEqual([500, 500])
      f.tick(5, 297)
      expect(places()).toEqual([500, 500])
      f.tick(5.033, 330)
      expect(shift(last().keyframes[0])).toBeCloseTo(503.3, 6)
      expect(f.motion.moving()).toBe(true)
      dispose()
    })
  })

  it('holds through one reading far behind, as a misdated output timestamp gave, rather than taking it for a seek', () => {
    createRoot((dispose) => {
      const f = setup()
      f.tick(3, 0)
      f.tick(3.033, 33)
      f.tick(3.066, 66)
      // Chromium dated one stamp 1.8 s ahead after its audio thread ran late,
      // and the clock read 1.8 s back for one tick.
      f.tick(3.099 - 1.8, 99)
      expect(f.motion.moving()).toBe(true)
      f.tick(3.132, 132)
      expect(f.motion.moving()).toBe(true)
      f.tick(3.165, 165)
      // No animation started behind where the one before it drew the line,
      // and the last moves on with the clock.
      for (let i = 1; i < f.line.started.length; i++) {
        const at = f.line.started[i].animation.startTime as number
        expect(shift(f.line.started[i].keyframes[0])).toBeGreaterThanOrEqual(
          drawnBy(f.line.started[i - 1], at) - 1e-6,
        )
      }
      const on = f.line.started.at(-1)!
      expect(shift(on.keyframes[0])).toBeCloseTo(316.5, 6)
      expect(on.timing.duration).toBeCloseTo((60 - 3.165) * 1000, 6)
      dispose()
    })
  })

  it('holds the line where it is drawn through a stall, and moves on from there once the clock runs again', () => {
    createRoot((dispose) => {
      const f = setup()
      f.tick(1, 0)
      f.tick(1.033, 33)
      f.tick(1.066, 66)
      // The audio thread runs late: the clock stands still at 1.07 s.
      f.tick(1.07, 99)
      f.tick(1.07, 132)
      const held = f.line.started.at(-1)!
      const [from, to] = held.keyframes.map(shift)
      expect(to).toBe(from)
      // Where the line was drawn at that tick, ahead of the clock.
      expect(from).toBeCloseTo(drawnBy(f.line.started.at(-2)!, 132), 6)
      expect(from).toBeGreaterThan(110)
      expect(f.motion.moving()).toBe(true)
      // The clock comes back short of where it stood, then in a burst: the
      // line holds, then goes forward to it.
      f.tick(1.07, 165)
      f.tick(1.03, 198)
      expect(f.line.started.at(-1)).toBe(held)
      f.tick(1.17, 231)
      const burst = f.line.started.at(-1)!.keyframes.map(shift)
      expect(burst[0]).toBeCloseTo(117, 6)
      expect(burst[1]).toBe(burst[0])
      f.tick(1.203, 264)
      const on = f.line.started.at(-1)!
      expect(shift(on.keyframes[0])).toBeCloseTo(120.3, 6)
      expect(on.timing.duration).toBeCloseTo((60 - 1.203) * 1000, 6)
      // No animation started behind where the one before it drew the line.
      for (let i = 1; i < f.line.started.length; i++) {
        const at = f.line.started[i].animation.startTime as number
        expect(shift(f.line.started[i].keyframes[0])).toBeGreaterThanOrEqual(
          drawnBy(f.line.started[i - 1], at) - 1e-6,
        )
      }
      dispose()
    })
  })

  it('goes back to a clock it finds running half a second behind after a stall: a seek made meanwhile', () => {
    createRoot((dispose) => {
      const f = setup()
      f.tick(1, 0)
      f.tick(1.033, 33)
      f.tick(1.033, 66)
      const held = f.line.started.at(-1)!
      expect(shift(held.keyframes[0])).toBeCloseTo(106.6, 6)
      // Seeked to 0.3 s while it held: further back than a stall leaves it.
      f.tick(0.3, 99)
      expect(f.line.started.at(-1)).toBe(held)
      f.tick(0.333, 132)
      expect(shift(f.line.started.at(-1)!.keyframes[0])).toBeCloseTo(33.3, 6)
      dispose()
    })
  })

  it('slows a line that pulled ahead of the clock instead of stepping it back', () => {
    createRoot((dispose) => {
      const f = setup()
      f.tick(1, 0)
      f.tick(1.033, 33)
      // The clock reads 10 ms short of the line.
      f.tick(1.056, 66)
      expect(f.line.started).toHaveLength(2)
      const [, slower] = f.line.started
      // From where the line is drawn, a hundredth slower than the song.
      expect(shift(slower.keyframes[0])).toBeCloseTo(106.6, 6)
      expect(drawnBy(f.line.started[0], 66)).toBeCloseTo(106.6, 6)
      expect(slower.animation.startTime).toBe(66)
      expect(slower.timing.duration).toBeCloseTo(
        ((60 - 1.066) * 1000) / 0.99,
        6,
      )
      // The clock keeps the song's time from there. Each new speed starts
      // where the last one drew the line, and the two meet.
      for (let ms = 99; ms <= 2066; ms += 33) {
        const before = f.line.started.at(-1)!
        f.tick(1.056 + (ms - 66) / 1000, ms)
        const after = f.line.started.at(-1)!
        if (after !== before)
          expect(shift(after.keyframes[0])).toBeCloseTo(drawnBy(before, ms), 6)
      }
      expect(
        Math.abs(drawnBy(f.line.started.at(-1)!, 2066) - (1.056 + 2) * 100),
      ).toBeLessThan(0.5)
      dispose()
    })
  })

  it('jumps a line that fell behind on to the clock, goes on from where it is on a zoom, and lets go on stop', () => {
    createRoot((dispose) => {
      const f = setup()
      f.tick(1, 0)
      f.tick(1.033, 33)
      // The clock reads 30 ms past the line: too far to catch up by speed.
      f.tick(1.096, 66)
      expect(f.line.started).toHaveLength(2)
      expect(shift(f.line.started[1].keyframes[0])).toBeCloseTo(109.6, 6)
      expect(f.line.started[1].timing.duration).toBeCloseTo(
        (60 - 1.096) * 1000,
        6,
      )
      // A zoom draws the same moment at the new scale.
      f.zoom(200)
      f.motion.restart(76)
      expect(f.line.started).toHaveLength(3)
      expect(shift(f.line.started[2].keyframes[0])).toBeCloseTo(221.2, 6)
      expect(f.line.started[2].animation.startTime).toBe(76)
      f.motion.stop()
      expect(f.motion.moving()).toBe(false)
      expect(f.line.started[2].animation.cancel).toHaveBeenCalled()
      dispose()
    })
  })
})

/**
 * A page that draws every `frameMs` on its own clock, as Chromium does: an
 * animation started without a start time starts on the first frame after
 * it, and every frame draws the newest running animation at the frame's
 * time, held at either end only where its fill says so. With no animation
 * it draws the line where `style` puts it, if given.
 */
function drawingPage(
  frameMs: number,
  offsetMs = 0,
  style?: (ms: number) => number,
) {
  const started: {
    keyframes: Keyframe[]
    timing: KeyframeAnimationOptions
    animation: { startTime: number | null; cancel: () => void }
    cancelled: boolean
  }[] = []
  const element = {
    animate: (keyframes: Keyframe[], timing: KeyframeAnimationOptions) => {
      const entry = {
        keyframes,
        timing,
        cancelled: false,
        animation: {
          startTime: null as number | null,
          cancel: () => {
            entry.cancelled = true
          },
        },
      }
      started.push(entry)
      return entry.animation as unknown as Animation
    },
  } as unknown as HTMLElement
  let nextFrame = offsetMs
  return {
    element,
    started,
    /** Draw every frame due up to `ms`; each drawn place is handed to `drawn`. */
    drawUntil(ms: number, drawn: (at: number, x: number | null) => void) {
      for (; nextFrame <= ms; nextFrame += frameMs) {
        const live = started.filter((each) => !each.cancelled)
        for (const each of live) each.animation.startTime ??= nextFrame
        const newest = live.at(-1)
        if (!newest) {
          drawn(nextFrame, style ? style(nextFrame) : null)
          continue
        }
        const from = shift(newest.keyframes[0])
        const to = shift(newest.keyframes[1])
        const progress =
          (nextFrame - newest.animation.startTime!) /
          Number(newest.timing.duration)
        const holds =
          progress < 0
            ? newest.timing.fill === 'both' ||
              newest.timing.fill === 'backwards'
            : progress <= 1 ||
              newest.timing.fill === 'both' ||
              newest.timing.fill === 'forwards'
        drawn(
          nextFrame,
          holds
            ? from + Math.min(1, Math.max(0, progress)) * (to - from)
            : null,
        )
      }
    },
  }
}

/**
 * Play for `seconds` with the clock at `clockAt(ms)` seconds, ticking every
 * 33.3 ms; the page draws as `page` says. Returns every drawn place of the
 * line beside the clock's, in pixels at 100 px a second.
 */
function playOn(
  page: ReturnType<typeof drawingPage>,
  clockAt: (ms: number) => number,
  seconds: number,
) {
  let clock = clockAt(0) * RATE
  const motion = createStudioPlayheadMotion({
    sampleRate: RATE,
    frameNow: () => Math.round(clock),
    pixels: (frame) => (frame / RATE) * 100,
    endFrame: () => 600 * RATE,
  })
  motion.attach(page.element)
  const drawn: { at: number; x: number | null; clock: number }[] = []
  for (let ms = 0; ms <= seconds * 1000; ms += 1000 / 30) {
    page.drawUntil(ms, (at, x) =>
      drawn.push({ at, x, clock: clockAt(at) * 100 }),
    )
    clock = clockAt(ms) * RATE
    motion.check(ms)
  }
  return { motion, drawn: drawn.filter((each) => each.x !== null) }
}

/** Every drawn place behind the one before it. */
function stepsBack(drawn: readonly { x: number | null }[]) {
  let back = 0
  for (let i = 1; i < drawn.length; i++)
    if (drawn[i].x! < drawn[i - 1].x! - 1e-9) back++
  return back
}

describe('Studio playhead motion on a page that draws on its own clock', () => {
  it('follows a clock slower than the song without ever stepping back', () => {
    createRoot((dispose) => {
      // A device clock 0.2 % slow against the page's, which a line run at
      // the song's own rate passes by 20 ms every ten seconds.
      const page = drawingPage(1000 / 60, 5)
      const { drawn } = playOn(page, (ms) => 10 + (ms / 1000) * 0.998, 40)
      expect(stepsBack(drawn)).toBe(0)
      // And it stays with the clock: within 10 ms, a pixel at this zoom.
      const settled = drawn.filter((each) => each.at > 1000)
      for (const each of settled)
        expect(Math.abs(each.x! - each.clock)).toBeLessThan(1)
      dispose()
    })
  })

  it('places the line by the tick that read the clock, however late the page draws', () => {
    createRoot((dispose) => {
      // A busy page: 30 frames a second, each 25 ms after a tick.
      const page = drawingPage(1000 / 30, 25)
      const { drawn } = playOn(page, (ms) => 10 + ms / 1000, 10)
      const settled = drawn.filter((each) => each.at > 1000)
      for (const each of settled)
        expect(Math.abs(each.x! - each.clock)).toBeLessThan(0.5)
      // One animation for the whole stretch: nothing starts it again.
      expect(page.started.length).toBeLessThanOrEqual(2)
      dispose()
    })
  })

  it('holds through a stall of the audio thread, where standing on its style stepped it back', () => {
    createRoot((dispose) => {
      // As Chromium's clock went when its audio thread ran 150 ms late at
      // 2 s: on to the render clock, 98 ms ahead, standing there until the
      // thread caught up; one reading 0.3 s short of that, from a stamp dated
      // ahead, then on its old line again.
      const line = (ms: number) => 10 + ms / 1000
      const clockAt = (ms: number) =>
        ms < 2000 || ms >= 2180
          ? line(ms)
          : ms < 2163
            ? Math.min(line(2098), line(ms))
            : line(2098) - 0.297
      // The line's own style: the readouts' playhead, ten times a second.
      const page = drawingPage(
        1000 / 60,
        5,
        (ms) => clockAt(Math.floor(ms / 100) * 100) * 100,
      )
      const { drawn } = playOn(page, clockAt, 4)
      expect(stepsBack(drawn)).toBe(0)
      // And on with the clock again within a second.
      for (const each of drawn.filter(({ at }) => at > 3200))
        expect(Math.abs(each.x! - each.clock)).toBeLessThan(1)
      dispose()
    })
  })
})
