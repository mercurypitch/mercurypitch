// ============================================================
// Tune line dress tests — a part's slide and its lights, through the line's core
// ============================================================
//
// What the core does with a shape's dress (tune-line-parts.ts): a part
// whose notes change between two shapes slides the beads that moved, so
// the line asks the page's frame loop for frames over the slide and then
// for none, and lands at once under reduced motion; the gutter the house
// needs moves the columns right; and a played run lights a part's bead
// where the look names its part, in the colour the look gives that note,
// and lights nothing for a note whose colour is null (a passing note's).

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type { HandLoop } from './frame-loop.test-fixtures'
import { COLOR } from './notes'
import type { TuneLine, TuneNote, TuneShape } from './tune-line'
import { pitchY } from './tune-line-layout'
import { HOUSE_GUTTER, SLIDE_SEC } from './tune-line-parts'
import { DRESS } from './tune-line-parts-draw'

const line = (ats: readonly number[]): TuneNote[] =>
  ats.map((at, i) => ({ at, beats: i === ats.length - 1 ? 2 : 1 }))

/** "Twinkle"'s first line, semitones above do. */
const TUNE: readonly TuneNote[][] = [line([0, 0, 7, 7, 9, 9, 7])]

/** Its copy in C major's thirds, and four semitones up: the beads over A move. */
const KEY = [4, 4, 11, 11, 12, 12, 11]
const UP4 = [4, 4, 11, 11, 13, 13, 11]

/** Step 2's state on one band, C4 to D5, the copy as given. */
const withCopy = (at: readonly number[]): TuneShape => ({
  lines: [0],
  window: [60, 74],
  fill: false,
  names: false,
  below: null,
  beadButtons: false,
  gapButtons: false,
  brackets: [],
  ghost: null,
  dress: {
    lanes: [0, 2, 4, 5, 7, 9, 11],
    house: 60,
    label: 'tune',
    parts: [{ line: 0, at, label: 'copy' }],
  },
})

interface Call {
  readonly name: string
  readonly args: readonly unknown[]
  readonly shadow: unknown
}

/** A context recording its calls with the shadow each was made in, kept across save and restore. */
function recorder(): { ctx: CanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = []
  const style: Record<string, unknown> = { shadowColor: '' }
  const saved: Record<string, unknown>[] = []
  const ctx = new Proxy(style, {
    get: (t, k) => {
      if (typeof k !== 'string') return undefined
      if (k in t) return t[k]
      if (k === 'measureText') return () => ({ width: 10 })
      if (k === 'save') return () => saved.push({ ...t })
      if (k === 'restore')
        return () => {
          Object.assign(t, saved.pop() ?? {})
        }
      return (...args: unknown[]) =>
        calls.push({ name: k, args, shadow: t.shadowColor })
    },
    set: (t, k, v: unknown) => {
      t[k as string] = v
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  return { ctx, calls }
}

/** A canvas 390 by 350 px on screen, drawing to `ctx` when given. */
function canvasOf(ctx?: CanvasRenderingContext2D): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () =>
    ({ x: 0, y: 0, top: 0, left: 0, width: 390, height: 350 }) as DOMRect
  if (ctx !== undefined)
    canvas.getContext = (() =>
      ctx) as unknown as HTMLCanvasElement['getContext']
  document.body.append(canvas)
  return canvas
}

/** A fresh loop run by hand, motion on or off, and a line on it. */
async function mounted(
  reduce: boolean,
  shape: TuneShape,
  ctx?: CanvasRenderingContext2D,
): Promise<{ line: TuneLine; hand: HandLoop }> {
  const { handLoop } = await import('./frame-loop.test-fixtures')
  const hand = await handLoop(reduce)
  const fresh = await import('./tune-line')
  const tune = fresh.mountTuneLine({
    canvas: canvasOf(ctx),
    tune: TUNE,
    start: 60,
    shape,
    active: () => true,
    dressPainter: DRESS,
  })
  return { line: tune, hand }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe('mountTuneLine: a part that changes', () => {
  it("slides the beads that moved, asking for frames over the slide's 0.3 s and then for none", async () => {
    // Arrange
    const { line: tune, hand } = await mounted(false, withCopy(KEY))
    const drawn = hand.settle()

    // Act
    tune.setShape(withCopy(UP4))
    const frames = hand.settle()

    // Assert
    expect(drawn).toBeGreaterThan(0)
    expect(frames).toBeGreaterThanOrEqual(Math.floor(SLIDE_SEC / 0.016))
    expect(frames).toBeLessThanOrEqual(Math.ceil(SLIDE_SEC / 0.016) + 2)
    expect(hand.asked).toHaveLength(0)
  })

  it('lands at once under reduced motion: one frame, the new shape', async () => {
    const { line: tune, hand } = await mounted(true, withCopy(KEY))
    hand.settle()
    tune.setShape(withCopy(UP4))
    expect(hand.settle()).toBe(1)
  })

  it('moves the columns right by the gutter the house needs', async () => {
    const { line: tune, hand } = await mounted(true, withCopy(KEY))
    hand.settle()
    expect(tune.layout?.lines[0].cols[0].x).toBe(HOUSE_GUTTER)
    tune.setShape({ ...withCopy(KEY), dress: { parts: [] } })
    hand.settle()
    expect(tune.layout?.lines[0].cols[0].x).toBe(0)
  })
})

describe('mountTuneLine: lights on a part', () => {
  /** The glowing beads of the frame drawn halfway through a run: each glow's centre y. */
  async function glowsOf(look: Parameters<TuneLine['play']>[2]): Promise<{
    ys: number[]
    tune: TuneLine
  }> {
    const r = recorder()
    const { line: tune, hand } = await mounted(true, withCopy(KEY), r.ctx)
    hand.settle()
    r.calls.length = 0
    void tune.play([{ midi: 64, at: 0, dur: 1 }], false, look)
    for (let i = 0; i < 30; i++) hand.frame()
    // a glow is the fill made with a shadow; its pill is the roundRect just before it
    const ys: number[] = []
    r.calls.forEach((c, i) => {
      if (c.name !== 'fill' || c.shadow === '') return
      const pill = r.calls
        .slice(0, i)
        .reverse()
        .find((p) => p.name === 'roundRect')
      const [, y, , h] = (pill?.args ?? []) as number[]
      ys.push(y + h / 2)
    })
    return { ys: [...new Set(ys.map((y) => Math.round(y)))], tune }
  }

  it("lights the part's bead, not the tune's, where the look names its part", async () => {
    // Act
    const { ys, tune } = await glowsOf({
      notes: [0],
      parts: [0],
      colors: [COLOR.gold],
    })

    // Assert: E4's bead, the copy's first, and not C4's under it
    const L = tune.layout?.lines[0]
    if (L === undefined) throw new Error('no layout')
    expect(ys).toEqual([Math.round(pitchY(L, 74, 64))])
  })

  it("lights the tune's bead where the look names no part", async () => {
    const { ys, tune } = await glowsOf({ notes: [0], colors: [COLOR.gold] })
    const L = tune.layout?.lines[0]
    if (L === undefined) throw new Error('no layout')
    expect(ys).toEqual([Math.round(pitchY(L, 74, 60))])
  })

  it('lights nothing for a note whose colour is null: a passing note', async () => {
    const { ys } = await glowsOf({ notes: [0], parts: [0], colors: [null] })
    expect(ys).toEqual([])
  })
})
