// Studio playhead motion tests — one compositor animation follows the clock; a seek, a loop, a stall or a zoom starts it again.
import { createRoot } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { createStudioPlayheadMotion } from './playhead-motion'

const RATE = 48_000

/** The pixels a keyframe moves the line by. */
const shift = (keyframe: Keyframe) =>
  Number(/translateX\(([-\d.e]+)px\)/.exec(String(keyframe.transform))![1])

/**
 * An element whose animations start when the test says: `startTime` is
 * null until the first frame after animate(), as in a browser.
 */
function animatedElement() {
  const started: { keyframes: Keyframe[]; animation: Animation }[] = []
  let startTime: number | null = null
  const element = {
    animate: vi.fn((keyframes: Keyframe[]) => {
      const animation = {
        get startTime() {
          return startTime
        },
        cancel: vi.fn(),
      } as unknown as Animation
      started.push({ keyframes, animation })
      startTime = null
      return animation
    }),
  } as unknown as HTMLElement
  return {
    element,
    started,
    /** The newest animation took its first frame at `ms`. */
    startedAt(ms: number) {
      startTime = ms
    },
  }
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
  it('starts one animation to the song end once the clock moves, and leaves it while they agree', () => {
    createRoot((dispose) => {
      const f = setup()
      // The first reading cannot tell a moving clock from one that waits.
      f.tick(1, 0)
      expect(f.line.started).toHaveLength(0)
      f.tick(1.033, 33)
      expect(f.line.started).toHaveLength(1)
      expect(f.motion.moving()).toBe(true)
      expect(f.line.started[0].keyframes).toEqual([
        { transform: 'translateX(103.3px)' },
        { transform: 'translateX(6000px)' },
      ])
      // A tick before the first frame leaves the waiting animation alone.
      f.tick(1.045, 45)
      expect(f.line.started).toHaveLength(1)
      f.line.startedAt(33)
      // Thirty ticks a second for two seconds, a few ms early or late, on
      // a clock 0.5 % fast, as headless Chromium's is.
      for (let tick = 1; tick <= 60; tick++) {
        const ms = 33 + tick * 33.3 + (tick % 2 ? 4 : -4)
        f.tick(1.033 + ((ms - 33) / 1000) * 1.005, ms)
      }
      expect(f.line.started).toHaveLength(1)
      dispose()
    })
  })

  it('stands still on a seek until the clock moves on from there, then starts again there', () => {
    createRoot((dispose) => {
      const f = setup()
      f.tick(1, 0)
      f.tick(1.033, 33)
      f.line.startedAt(33)
      // A seek moved the heard run to 20 s.
      f.tick(20, 66)
      expect(f.motion.moving()).toBe(false)
      expect(f.line.started[0].animation.cancel).toHaveBeenCalled()
      f.tick(20.033, 99)
      expect(f.line.started).toHaveLength(2)
      expect(shift(f.line.started[1].keyframes[0])).toBeCloseTo(2003.3, 6)
      // A seek whose run is still being built: the clock holds the target.
      f.tick(30, 132)
      f.tick(30, 165)
      f.tick(30, 198)
      expect(f.motion.moving()).toBe(false)
      expect(f.line.started).toHaveLength(2)
      f.tick(30.033, 231)
      expect(f.motion.moving()).toBe(true)
      expect(f.line.started).toHaveLength(3)
      dispose()
    })
  })

  it('starts again from the clock when the line falls behind or the zoom changes, and lets go on stop', () => {
    createRoot((dispose) => {
      const f = setup()
      f.tick(1, 0)
      f.tick(1.033, 33)
      // The page was busy: the first frame came 30 ms late, so the line shows 30 ms less than the clock.
      f.line.startedAt(63)
      f.tick(1.066, 66)
      expect(f.line.started).toHaveLength(2)
      f.zoom(200)
      f.motion.restart()
      expect(f.line.started).toHaveLength(3)
      expect(shift(f.line.started[2].keyframes[0])).toBeCloseTo(213.2, 6)
      f.motion.stop()
      expect(f.motion.moving()).toBe(false)
      expect(f.line.started[2].animation.cancel).toHaveBeenCalled()
      dispose()
    })
  })
})
