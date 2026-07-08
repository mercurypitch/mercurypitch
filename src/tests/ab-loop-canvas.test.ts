// ============================================================
// Tests for the shared A-B loop canvas helper (draw + hit-test). The pure
// geometry is now testable in isolation, unlike the old per-canvas copies.
// ============================================================

import { describe, expect, it } from 'vitest'
import { drawAbLoopOverlay, hitTestAbLoopMarker, LOOP_MARKER_HIT_PX, } from '@/lib/ab-loop-canvas'

// Minimal recording 2D context — captures fillRect calls and line segments so
// we can assert geometry without a real canvas.
function makeCtx() {
  const fillRects: [number, number, number, number][] = []
  const lines: [number, number, number, number][] = []
  const roundRects: [number, number, number, number][] = []
  const texts: { text: string; x: number; y: number }[] = []
  let mx = 0
  let my = 0
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    shadowColor: '',
    shadowBlur: 0,
    font: '',
    textAlign: '',
    textBaseline: '',
    save() {},
    restore() {},
    beginPath() {},
    stroke() {},
    fill() {},
    roundRect: (x: number, y: number, w: number, h: number) =>
      roundRects.push([x, y, w, h]),
    fillText: (text: string, x: number, y: number) =>
      texts.push({ text, x, y }),
    measureText: (t: string) => ({ width: t.length * 6 }),
    fillRect: (x: number, y: number, w: number, h: number) =>
      fillRects.push([x, y, w, h]),
    moveTo: (x: number, y: number) => {
      mx = x
      my = y
    },
    lineTo: (x: number, y: number) => lines.push([mx, my, x, y]),
  }
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    fillRects,
    lines,
    roundRects,
    texts,
  }
}

describe('hitTestAbLoopMarker', () => {
  const posOf = (beat: number) => beat * 10 // beat → px

  it('returns null when nothing is set', () => {
    expect(hitTestAbLoopMarker(50, 0, 0, posOf)).toBeNull()
  })

  it('grabs A within tolerance', () => {
    // A at px 40; pointer 45 is 5px away (<= 8)
    expect(hitTestAbLoopMarker(45, 4, 9, posOf)).toBe('A')
  })

  it('grabs B within tolerance', () => {
    // B at px 90; pointer 86 is 4px away
    expect(hitTestAbLoopMarker(86, 4, 9, posOf)).toBe('B')
  })

  it('returns null when the pointer is beyond tolerance of both', () => {
    expect(hitTestAbLoopMarker(65, 4, 9, posOf)).toBeNull()
  })

  it('picks the closer marker when both are within tolerance', () => {
    // A at 40, B at 44; pointer 43 is 3 from A, 1 from B → B wins
    const closePosOf = (beat: number) => (beat === 4 ? 40 : 44)
    expect(hitTestAbLoopMarker(43, 4, 9, closePosOf)).toBe('B')
  })

  it('ignores an unset boundary (0)', () => {
    // Only B set; pointer near where A would be (0) must not match
    expect(hitTestAbLoopMarker(2, 0, 9, posOf)).toBeNull()
  })

  it('honours the boundary exactly at the tolerance edge', () => {
    // A at 40, pointer 40 + LOOP_MARKER_HIT_PX is exactly on the edge (<=)
    expect(hitTestAbLoopMarker(40 + LOOP_MARKER_HIT_PX, 4, 9, posOf)).toBe('A')
    expect(
      hitTestAbLoopMarker(40 + LOOP_MARKER_HIT_PX + 1, 4, 9, posOf),
    ).toBeNull()
  })
})

describe('drawAbLoopOverlay region geometry', () => {
  it('fills the region across the full height for a vertical (x) axis', () => {
    const { ctx, fillRects, lines } = makeCtx()
    drawAbLoopOverlay(ctx, {
      a: 2,
      b: 6,
      enabled: true,
      posOf: (v) => v * 10, // A→20, B→60
      orientation: 'vertical',
      crossExtent: 300, // height
      clipMin: 0,
      clipMax: 200, // width
      flag: 'none',
    })
    // Region rect: x from 20 to 60, full height
    expect(fillRects).toContainEqual([20, 0, 40, 300])
    // Two vertical boundary lines at x=20 and x=60
    expect(lines).toContainEqual([20, 0, 20, 300])
    expect(lines).toContainEqual([60, 0, 60, 300])
  })

  it('orders positions for an INVERTED horizontal (y) axis (Piano)', () => {
    const { ctx, fillRects, lines } = makeCtx()
    // Piano: larger beat → smaller y. A(beat 2)→y240, B(beat 6)→y120.
    const posOf = (v: number) => 300 - v * 30
    drawAbLoopOverlay(ctx, {
      a: 2,
      b: 6,
      enabled: false,
      posOf,
      orientation: 'horizontal',
      crossExtent: 400, // width
      clipMin: 0,
      clipMax: 300, // note-area height
      flag: 'none',
    })
    // Region spans y from 120 (B) to 240 (A), full width — lo/hi ordered
    expect(fillRects).toContainEqual([0, 120, 400, 120])
    // Horizontal boundary lines at y=240 (A) and y=120 (B)
    expect(lines).toContainEqual([0, 240, 400, 240])
    expect(lines).toContainEqual([0, 120, 400, 120])
  })

  it('skips the region when only one bound is set', () => {
    const { ctx, fillRects, lines } = makeCtx()
    drawAbLoopOverlay(ctx, {
      a: 3,
      b: 0,
      enabled: true,
      posOf: (v) => v * 10,
      orientation: 'vertical',
      crossExtent: 100,
      clipMin: 0,
      clipMax: 200,
      flag: 'none',
    })
    expect(fillRects).toHaveLength(0) // no region
    expect(lines).toContainEqual([30, 0, 30, 100]) // A line still drawn
  })

  it('draws nothing when unset', () => {
    const { ctx, fillRects, lines } = makeCtx()
    drawAbLoopOverlay(ctx, {
      a: 0,
      b: 0,
      enabled: false,
      posOf: (v) => v * 10,
      orientation: 'vertical',
      crossExtent: 100,
      clipMin: 0,
      clipMax: 200,
    })
    expect(fillRects).toHaveLength(0)
    expect(lines).toHaveLength(0)
  })

  it('culls a boundary line more than 2px outside the clip range', () => {
    const { ctx, lines } = makeCtx()
    drawAbLoopOverlay(ctx, {
      a: 2, // posOf 20 → in range
      b: 25, // posOf 250 → clipMax 200, 50px past → culled
      enabled: false,
      posOf: (v) => v * 10,
      orientation: 'vertical',
      crossExtent: 100,
      clipMin: 0,
      clipMax: 200,
      flag: 'none',
    })
    expect(lines).toContainEqual([20, 0, 20, 100]) // A drawn
    // B's line (x≈250) is culled — only the A line exists.
    expect(lines).toHaveLength(1)
  })
})

describe('drawAbLoopOverlay flags & options', () => {
  const base = {
    a: 2,
    b: 6,
    enabled: false,
    posOf: (v: number) => v * 10, // A→20, B→60
    crossExtent: 300,
    clipMin: 0,
    clipMax: 200,
  } as const

  it("'pill' on a vertical axis draws a rounded pill at the top with the label", () => {
    const { ctx, roundRects, texts } = makeCtx()
    drawAbLoopOverlay(ctx, { ...base, orientation: 'vertical', flag: 'pill' })
    // Two pills (A, B), each a roundRect near the top (y=1).
    expect(roundRects).toHaveLength(2)
    expect(roundRects.every((r) => r[1] === 1)).toBe(true)
    expect(texts.map((t) => t.text).sort()).toEqual(['A', 'B'])
  })

  it("'pill' on a horizontal axis pins the pill to the left edge (x=6)", () => {
    const { ctx, roundRects } = makeCtx()
    drawAbLoopOverlay(ctx, {
      ...base,
      orientation: 'horizontal',
      crossExtent: 400,
      clipMax: 300,
      flag: 'pill',
    })
    expect(roundRects).toHaveLength(2)
    expect(roundRects.every((r) => r[0] === 6)).toBe(true)
  })

  it("'ruler' draws plain-rect flags: A right of its line, B to the left", () => {
    const { ctx, roundRects, fillRects } = makeCtx()
    drawAbLoopOverlay(ctx, {
      ...base,
      orientation: 'vertical',
      flag: 'ruler',
      region: false,
    })
    expect(roundRects).toHaveLength(0) // ruler uses fillRect, not roundRect
    // A flag starts AT its line (x=20); B flag ends at its line (x=60 → starts left of it).
    const aFlag = fillRects.find((r) => r[0] === 20)
    const bFlag = fillRects.find((r) => r[0] < 60 && r[0] + r[2] === 60)
    expect(aFlag).toBeTruthy()
    expect(bFlag).toBeTruthy()
  })

  it("'none' draws no flag (no pill, no label)", () => {
    const { ctx, roundRects, texts, fillRects } = makeCtx()
    drawAbLoopOverlay(ctx, { ...base, orientation: 'vertical', flag: 'none' })
    expect(roundRects).toHaveLength(0)
    expect(texts).toHaveLength(0)
    // Only the region fill rect (A<B, enabled default false) — no flag rects.
    expect(fillRects).toHaveLength(1)
  })

  it('region:false suppresses the shaded band', () => {
    const { ctx, fillRects } = makeCtx()
    drawAbLoopOverlay(ctx, {
      ...base,
      orientation: 'vertical',
      flag: 'none',
      region: false,
    })
    expect(fillRects).toHaveLength(0)
  })
})
