// What the correction does with a route that reports partially, or absurdly.
import { describe, expect, it } from 'vitest'
import { guitarCaptureLatencySeconds } from './recording-latency'

function route(
  context: { outputLatency?: number; baseLatency?: number },
  inputLatency?: number,
) {
  return {
    context: context as AudioContext,
    stream: {
      getAudioTracks: () => [
        { getSettings: () => ({ latency: inputLatency }) },
      ],
    } as unknown as MediaStream,
  }
}

describe('the capture latency a take is corrected by', () => {
  it('adds the output estimate to the capture hint', () => {
    expect(
      guitarCaptureLatencySeconds(route({ outputLatency: 0.05 }, 0.012)),
    ).toBeCloseTo(0.062, 8)
  })

  it('falls back to the graph share when no device figure is reported', () => {
    // Safari has no outputLatency at all; correcting by the graph's own share
    // beats correcting by nothing.
    expect(
      guitarCaptureLatencySeconds(route({ baseLatency: 0.008 })),
    ).toBeCloseTo(0.008, 8)
  })

  it('prefers the device figure over the graph share rather than summing them', () => {
    expect(
      guitarCaptureLatencySeconds(
        route({ outputLatency: 0.05, baseLatency: 0.01 }),
      ),
    ).toBeCloseTo(0.05, 8)
  })

  it('corrects by nothing when the browser reports nothing', () => {
    expect(guitarCaptureLatencySeconds(route({}))).toBe(0)
  })

  it.each([
    ['a negative reading', { outputLatency: -0.02 }],
    ['an absurd reading', { outputLatency: 4 }],
    ['a NaN reading', { outputLatency: Number.NaN }],
  ])('ignores %s', (_label, context) => {
    expect(guitarCaptureLatencySeconds(route(context))).toBe(0)
  })

  it('never shifts a lane further than a beat at any tempo anyone plays', () => {
    expect(
      guitarCaptureLatencySeconds(route({ outputLatency: 0.35 }, 0.3)),
    ).toBe(0.4)
  })

  it('survives a stream with no audio track', () => {
    expect(
      guitarCaptureLatencySeconds({
        context: { outputLatency: 0.02 } as AudioContext,
        stream: { getAudioTracks: () => [] } as unknown as MediaStream,
      }),
    ).toBeCloseTo(0.02, 8)
  })
})
