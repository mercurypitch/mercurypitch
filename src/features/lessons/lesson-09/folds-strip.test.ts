// ============================================================
// Lesson 9 folds strip tests — singing slowed, resting apart, two stills
// ============================================================
//
// The strip on a canvas of its own, 300 by 64 px, its frames run by hand
// (kit/frame-loop.test-fixtures.ts) and its drawing read back from a
// recording context: each fold is a closed path filled, so a pair is two
// fills and a gap at the back is the space between their back ends. While
// nothing sounds the folds rest apart and the page asks for no frame
// (WEB-SPEC, Toys 1; the frame loop's rest); while a note sounds they come
// together and open and close at its rate slowed 220 times (FACTS 30);
// under reduced motion a sounding note is two stills, OPEN and CLOSED, and
// nothing moves. No label clips in 64 px: the strip draws none of Lesson
// 3's FRONT, BACK or VOCAL FOLDS.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { foldShapeAt } from '@/features/lessons/kit/folds'
import type { HandLoop } from '@/features/lessons/kit/frame-loop.test-fixtures'
import { handLoop } from '@/features/lessons/kit/frame-loop.test-fixtures'
import { hz } from '@/features/lessons/kit/notes'
import type { FoldsStrip } from './folds-strip'
import { stripMode, stripShape } from './folds-strip'

/** One call a canvas saw: a method and its arguments, or a property set, named `prop=`. */
type Call = readonly [string, ...unknown[]]

/** A context that keeps every call, and draws nothing. */
function recordingContext(canvas: HTMLCanvasElement): {
  ctx: CanvasRenderingContext2D
  calls: Call[]
} {
  const calls: Call[] = []
  const props: Record<string, unknown> = { canvas }
  const ctx = new Proxy(props, {
    get: (target, k) => {
      if (typeof k !== 'string') return undefined
      if (k in target) return target[k]
      return (...args: unknown[]): unknown => {
        calls.push([k, ...args])
        if (k === 'measureText') return { width: 0 }
        return k === 'createLinearGradient'
          ? { addColorStop: (): undefined => undefined }
          : undefined
      }
    },
    set: (target, k, v: unknown) => {
      if (typeof k === 'string') {
        calls.push([`${k}=`, v])
        target[k] = v
      }
      return true
    },
  })
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls }
}

/** The outlines the calls since `from` filled, each its points in order. */
function fills(calls: readonly Call[], from = 0): [number, number][][] {
  const done: [number, number][][] = []
  let path: [number, number][] = []
  for (const [op, a, b] of calls.slice(from)) {
    if (op === 'beginPath') path = []
    else if (op === 'lineTo') path.push([Number(a), Number(b)])
    else if (op === 'fill') done.push(path)
  }
  return done
}

/** The words the calls since `from` wrote. */
const words = (calls: readonly Call[], from = 0): string[] =>
  calls
    .slice(from)
    .filter(([op]) => op === 'fillText')
    .map(([, text]) => String(text))

/** How far apart a pair's inner edges stand at their middle: each fold's 13th point, of 25 along its inner edge. */
const opening = ([left, right]: [number, number][][]): number =>
  right[12][0] - left[12][0]

/** How far apart a pair's inner edges stand at the back: each fold's 25th point. */
const backGap = ([left, right]: [number, number][][]): number =>
  right[24][0] - left[24][0]

const D3 = hz(50)
const A3 = hz(57)

let hand: HandLoop
let strip: FoldsStrip
let calls: Call[]

/** The strip mounted on screen, its frames by hand; reduced motion as `reduce`. */
async function mount(reduce: boolean): Promise<void> {
  hand = await handLoop(reduce)
  const { mountFoldsStrip } = await import('./folds-strip')
  const canvas = document.createElement('canvas')
  document.body.appendChild(canvas)
  Object.defineProperties(canvas, {
    clientWidth: { value: 300, configurable: true },
    clientHeight: { value: 64, configurable: true },
  })
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 300, 64),
  )
  const recording = recordingContext(canvas)
  calls = recording.calls
  canvas.getContext = (() =>
    recording.ctx) as unknown as HTMLCanvasElement['getContext']
  strip = mountFoldsStrip(canvas, { active: () => true, restHz: () => D3 })
  hand.settle()
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe("Lesson 9's folds strip", () => {
  it('draws the folds apart once while nothing sounds, and then asks for no frame', async () => {
    // Arrange
    await mount(false)
    const from = calls.length

    // Act
    const ran = hand.settle()

    // Assert
    expect(ran).toBe(0)
    expect(hand.asked).toEqual([])
    expect(calls.slice(0, from).filter(([op]) => op === 'fill')).toHaveLength(2)
    expect(backGap(fills(calls))).toBeGreaterThan(10)
    expect(words(calls)).toEqual([])
  })

  it('brings the folds together while a note sounds, opening and closing at its rate slowed 220 times, and keeps asking for frames', async () => {
    // Arrange: A3 opens and closes once a second, slowed
    await mount(false)

    // Act: a quarter into its second cycle, the folds together by then,
    // then three quarters in
    strip.sing(A3)
    for (let i = 0; i < 77; i++) hand.frame()
    let from = calls.length
    hand.frame()
    const open = fills(calls, from)
    for (let i = 0; i < 30; i++) hand.frame()
    from = calls.length
    hand.frame()
    const shut = fills(calls, from)

    // Assert
    expect(backGap(open)).toBeLessThan(4)
    expect(opening(open)).toBeGreaterThan(opening(shut) + 4)
    expect(hand.asked).toHaveLength(1)
    expect(strip.mode).toBe('singing')
  })

  it('rests the folds apart again when the note ends, and the page with them', async () => {
    // Arrange
    await mount(false)
    strip.sing(A3)
    for (let i = 0; i < 10; i++) hand.frame()

    // Act
    strip.rest()
    const ran = hand.settle()
    const from = calls.length
    hand.loop.wake()
    hand.frame()

    // Assert: it eased apart for a few frames, then stopped asking
    expect(ran).toBeGreaterThan(0)
    expect(ran).toBeLessThan(120)
    expect(hand.asked).toEqual([])
    expect(fills(calls, from)).toEqual([])
    expect(strip.mode).toBe('apart')
  })

  it('draws a sounding note as two stills under reduced motion, OPEN and CLOSED, each named beside it, and moves nothing', async () => {
    // Arrange
    await mount(true)
    const from = calls.length

    // Act
    strip.sing(D3)
    const ran = hand.settle()

    // Assert
    expect(ran).toBe(1)
    expect(hand.asked).toEqual([])
    const pairs = fills(calls, from)
    expect(pairs).toHaveLength(4)
    expect(opening(pairs.slice(0, 2))).toBeGreaterThan(
      opening(pairs.slice(2, 4)) + 4,
    )
    expect(words(calls, from)).toEqual(['OPEN', 'CLOSED'])
    expect(strip.mode).toBe('stills')
  })

  it("never writes Lesson 3's FRONT, BACK or VOCAL FOLDS, which clip in 64 px", async () => {
    // Arrange
    await mount(false)

    // Act
    strip.sing(D3)
    for (let i = 0; i < 20; i++) hand.frame()
    strip.rest()
    hand.settle()

    // Assert
    expect(words(calls)).toEqual([])
  })
})

describe('the strip as it is drawn', () => {
  it("draws Lesson 3's folds thinner in proportion to 64 px, their length its own", () => {
    // Act
    const shape = stripShape(64, 0.2, 150)

    // Assert
    const lesson3 = foldShapeAt(64, 0.2, 150)
    expect(shape.th).toBeCloseTo((lesson3.th * 64) / 180, 9)
    expect(shape.len).toBe(lesson3.len)
    expect(stripShape(200, 0.2, 150).th).toBe(foldShapeAt(200, 0.2, 150).th)
  })

  it('sings slowed only while a note sounds, and as two stills under reduced motion', () => {
    // Act
    const modes = [
      stripMode(null, false),
      stripMode(D3, false),
      stripMode(null, true),
      stripMode(D3, true),
    ]

    // Assert
    expect(modes).toEqual(['apart', 'singing', 'apart', 'stills'])
  })
})
