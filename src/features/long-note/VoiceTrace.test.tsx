import { cleanup, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { recordingContext, ribbonColours } from './trace-test-context'
import { VoiceTraceBuffer } from './voice-trace-buffer'
import type { RibbonLayer, RibbonTint, TraceMark } from './VoiceTrace'
import { CORE, GLOW, GLOW_BLUR_PX, ribbonTint, VoiceTrace } from './VoiceTrace'

// The voice's ribbon is cyan where the light fills and a soft amber where it
// does not, by the band state the engine judged on each frame.

/** Four seconds of voice ending at t = 4: on, off from 1.5 to 2.5, on again. */
function driftedTake(): VoiceTraceBuffer {
  const trace = new VoiceTraceBuffer()
  for (let i = 0; i <= 240; i++) {
    const t = i / 60
    const off = t >= 1.5 && t < 2.5
    trace.push(t, off ? 55 : 0, !off)
  }
  return trace
}

function drawn(
  trace: VoiceTraceBuffer,
  muted?: () => boolean,
): ReturnType<typeof recordingContext> {
  const recorder = recordingContext()
  // The overloads end on WebGPU's context; the recorder stands in for 2D.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    recorder.ctx as never,
  )
  render(() => (
    <VoiceTrace
      trace={trace}
      now={() => 4}
      lineY={() => 200}
      anchorX={() => 300}
      lantern={() => ({ k: 1, left: 0, top: 0 })}
      region="outside"
      active={() => false}
      muted={muted}
    />
  ))
  return recorder
}

const ribbonOf = (strokes: ReturnType<typeof recordingContext>['strokes']) =>
  strokes.filter((stroke) => stroke.stops.length > 0)

/** Rec. 709 luma of a layer's colour times its alpha: how bright it reads. */
const brightness = ([r, g, b, a]: RibbonLayer['on']): number =>
  (0.2126 * r + 0.7152 * g + 0.0722 * b) * a

/** Marks every 1/240 of the ribbon (one a frame), off the band where `off`. */
function marks(off: (at: number) => boolean): TraceMark[] {
  return Array.from({ length: 241 }, (_, i) => ({
    at: i / 240,
    filling: !off(i / 240),
  }))
}

/** The tint the gradient draws at a place: straight between the stops. */
function tintAt(tints: readonly RibbonTint[], at: number): number {
  const next = tints.findIndex((tint) => tint.at >= at)
  if (next <= 0) return next === 0 ? tints[0].off : tints[tints.length - 1].off
  const a = tints[next - 1]
  const b = tints[next]
  return a.off + ((b.off - a.off) * (at - a.at)) / (b.at - a.at)
}

/** The share of marks within `half` of a place that were off the band. */
function boxTint(take: readonly TraceMark[], half: number, at: number): number {
  const near = take.filter((mark) => Math.abs(mark.at - at) <= half + 1e-9)
  return near.filter((mark) => !mark.filling).length / near.length
}

describe('VoiceTrace', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('draws the stretch off the line in amber and the rest in cyan', () => {
    const { strokes } = drawn(driftedTake())
    const ribbon = ribbonOf(strokes)
    // The core and its middle, then the glow's two strokes.
    expect(ribbon.map((stroke) => stroke.width)).toEqual([8.5, 3, 28, 14])
    for (const stroke of ribbon) {
      const colours = ribbonColours(stroke.stops)
      // Off from 1.5 s to 2.5 s: offsets 1 - 2.5/4 to 1 - 1.5/4.
      const amber = colours.filter((c) => c.amber)
      expect(amber.length).toBeGreaterThan(0)
      for (const c of amber) {
        expect(c.at).toBeGreaterThan(0.36)
        expect(c.at).toBeLessThan(0.64)
      }
      // Cyan on both sides of it.
      expect(colours.some((c) => !c.amber && c.at < 0.36)).toBe(true)
      expect(colours.some((c) => !c.amber && c.at > 0.64)).toBe(true)
    }
  })

  it('keeps the ribbon cyan while the light fills all the way', () => {
    const trace = new VoiceTraceBuffer()
    for (let i = 0; i <= 240; i++) trace.push(i / 60, 12, true)
    const { strokes } = drawn(trace)
    const ribbon = ribbonOf(strokes)
    expect(ribbon).toHaveLength(4)
    for (const stroke of ribbon) {
      expect(ribbonColours(stroke.stops).some((c) => c.amber)).toBe(false)
    }
  })

  it('crosses one change of colour over twice the half-width, evenly', () => {
    // Arrange: on the band up to the middle, off it after.
    const half = 0.02
    const take = marks((at) => at > 0.5)

    // Act
    const tints = ribbonTint(take, half)

    // Assert: cyan to 0.48, amber from 0.52, a straight ramp between, drawn
    // from its two ends (the gradient runs straight between stops).
    for (const { at } of take) {
      const drawnTint = tintAt(tints, at)
      if (at <= 0.475) expect(drawnTint).toBe(0)
      if (at >= 0.525) expect(drawnTint).toBe(1)
      expect(Math.abs(drawnTint - boxTint(take, half, at))).toBeLessThan(0.02)
    }
    expect(tints.length).toBeLessThanOrEqual(4)
    expect(tints[0]).toEqual({ at: 0, off: 0 })
    expect(tints[tints.length - 1]).toEqual({ at: 1, off: 1 })
    expect(ribbonTint([], half)).toEqual([])
  })

  it('blends a voice flickering at the band edge instead of striping it', () => {
    // Arrange: from 0.4 to 0.6 the band state flips every other frame, as
    // a centre hovering on the band's edge does.
    const flicker = marks(
      (at) => at > 0.4 && at < 0.6 && Math.round(at * 240) % 2 === 0,
    )

    // Act
    const tints = ribbonTint(flicker, 0.02)

    // Assert: a steady half blend, never a stripe of full amber or cyan,
    // and never off the box filter's own colour by more than a hair.
    for (const { at } of flicker) {
      const drawnTint = tintAt(tints, at)
      if (at > 0.43 && at < 0.57) {
        expect(drawnTint).toBeGreaterThan(0.4)
        expect(drawnTint).toBeLessThan(0.6)
      }
      expect(Math.abs(drawnTint - boxTint(flicker, 0.02, at))).toBeLessThan(
        0.02,
      )
    }
    for (let i = 1; i < tints.length; i++) {
      const jump = Math.abs(tints[i].off - tints[i - 1].off)
      const gap = tints[i].at - tints[i - 1].at
      // No faster than a clean crossing (1 over 0.04) anywhere.
      expect(jump).toBeLessThanOrEqual(gap / 0.04 + 0.1)
    }
  })

  it('gives the amber every width of the cyan, and no more brightness', () => {
    // The off stretch is the warning, not the loudest thing on screen.
    for (const layer of [...GLOW, ...CORE]) {
      expect(brightness(layer.off)).toBeLessThanOrEqual(
        brightness(layer.on) * 1.02,
      )
    }
    const glowOn = GLOW.reduce((sum, layer) => sum + brightness(layer.on), 0)
    const glowOff = GLOW.reduce((sum, layer) => sum + brightness(layer.off), 0)
    expect(glowOff / glowOn).toBeGreaterThan(0.85)
    // A warm core, not a near-white cream.
    const [r, g, b] = CORE[0].off
    expect(r - b).toBeGreaterThan(120)
    expect(g).toBeLessThan(200)
  })

  it('blurs the glow on a canvas of its own, under the line', () => {
    drawn(driftedTake())
    const glow = screen.getByTestId('long-note-trace-glow')
    const line = screen.getByTestId('long-note-trace')
    expect(
      glow.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(glow.style.filter).toBe(`blur(${GLOW_BLUR_PX.toFixed(2)}px)`)
    expect(line.style.filter).toBe('')
  })

  it('eases the amber back to cyan when the result dims the line', () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['performance'] })
    const queue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      queue.push(cb)
      return queue.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
    const [muted, setMuted] = createSignal(false)
    // The accessor goes straight into the trace's `muted` prop.
    // eslint-disable-next-line solid/reactivity
    const { strokes } = drawn(driftedTake(), muted)
    const amberIn = (from: number): boolean =>
      ribbonOf(strokes.slice(from)).some((stroke) =>
        ribbonColours(stroke.stops).some((c) => c.amber),
      )
    expect(amberIn(0)).toBe(true)

    // Act: the result dims the line, and the dimming runs its 600 ms.
    setMuted(true)
    let drawnBefore = 0
    for (let t = 0; t < 40; t++) {
      vi.advanceTimersByTime(20)
      drawnBefore = strokes.length
      const due = queue.splice(0)
      for (const cb of due) cb(performance.now())
    }

    // Assert: the last frame carries no amber, and the frames stop.
    expect(amberIn(drawnBefore)).toBe(false)
    expect(queue).toHaveLength(0)
  })
})
