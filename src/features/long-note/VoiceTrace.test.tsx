import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { recordingContext, ribbonColours } from './trace-test-context'
import { VoiceTraceBuffer } from './voice-trace-buffer'
import { ribbonTint, VoiceTrace } from './VoiceTrace'

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

function drawn(trace: VoiceTraceBuffer): ReturnType<typeof recordingContext> {
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
    />
  ))
  return recorder
}

describe('VoiceTrace', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('draws the stretch off the line in amber and the rest in cyan', () => {
    const { strokes } = drawn(driftedTake())
    const ribbon = strokes.filter((stroke) => stroke.stops.length > 0)
    expect(ribbon.length).toBe(8)
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
    const ribbon = strokes.filter((stroke) => stroke.stops.length > 0)
    expect(ribbon.length).toBe(8)
    for (const stroke of ribbon) {
      expect(ribbonColours(stroke.stops).some((c) => c.amber)).toBe(false)
    }
  })

  it('crosses from one colour to the other in a few px around each change', () => {
    const marks = [
      { at: 0.2, filling: true },
      { at: 0.3, filling: true },
      { at: 0.4, filling: false },
      { at: 0.5, filling: false },
      { at: 0.6, filling: true },
    ]
    const rounded = (tints: ReturnType<typeof ribbonTint>) =>
      tints.map((tint) => ({ at: Number(tint.at.toFixed(4)), off: tint.off }))
    // Changes half way between 0.3 and 0.4, and between 0.5 and 0.6.
    expect(rounded(ribbonTint(marks, 0.02))).toEqual([
      { at: 0.02, off: 0 },
      { at: 0.33, off: 0 },
      { at: 0.37, off: 1 },
      { at: 0.53, off: 1 },
      { at: 0.57, off: 0 },
      { at: 0.98, off: 0 },
    ])
    // A run shorter than the crossing keeps its colour at its middle only.
    expect(
      rounded(
        ribbonTint(
          [
            { at: 0.5, filling: true },
            { at: 0.51, filling: false },
            { at: 0.52, filling: true },
          ],
          0.02,
        ),
      ).filter((tint) => tint.off === 1),
    ).toEqual([
      { at: 0.51, off: 1 },
      { at: 0.51, off: 1 },
    ])
    expect(ribbonTint([], 0.02)).toEqual([])
  })
})
