// Studio late source tests — a clip scheduled behind the audio clock starts whole, a little later, its edges in order.
import { describe, expect, it } from 'vitest'
import { compileStudioArrangement } from '../model/arrangement-plan'
import { studioFixture } from '../model/model.test-fixtures'
import { buildStudioGraph } from './graph'
import type { PlaybackSource } from './playback.test-fixtures'
import { PlaybackContext, PlaybackParam } from './playback.test-fixtures'

/**
 * An AudioParam that keeps its events as Chromium does (measured in headless
 * Chromium 148): a time already gone moves up to the clock, a moved value
 * curve keeps its duration, and no event may land inside a curve, its first
 * instant included.
 */
class ClockedParam extends PlaybackParam {
  constructor(private readonly clock: () => number) {
    super(0)
  }

  private overlapped(time: number): string | null {
    const curve = this.curves.find(
      (held) => time >= held.time && time < held.time + held.duration,
    )
    return curve
      ? `overlaps setValueCurveAtTime(..., ${curve.time}, ${curve.duration})`
      : null
  }

  override setValueAtTime(value: number, time: number): this {
    const at = Math.max(time, this.clock())
    const overlap = this.overlapped(at)
    if (overlap !== null)
      throw new DOMException(
        `setValueAtTime(${value}, ${at}) ${overlap}`,
        'NotSupportedError',
      )
    return super.setValueAtTime(value, at)
  }

  override setValueCurveAtTime(
    values: Float32Array,
    time: number,
    duration: number,
  ): this {
    const at = Math.max(time, this.clock())
    const inside = this.events.some(
      (event) => event.time > at && event.time < at + duration,
    )
    const overlap = this.overlapped(at)
    if (inside || overlap !== null)
      throw new DOMException(
        `setValueCurveAtTime(..., ${at}, ${duration}) overlaps an event`,
        'NotSupportedError',
      )
    return super.setValueCurveAtTime(values, at, duration)
  }
}

class ClockedContext extends PlaybackContext {
  override createGain() {
    const gain = super.createGain()
    Object.defineProperty(gain, 'gain', {
      value: new ClockedParam(() => this.currentTime),
    })
    return gain
  }
}

function lateLane() {
  const { project, asset } = studioFixture()
  const dry = {
    ...project,
    tracks: project.tracks.map((track) => ({
      ...track,
      fx: { ...track.fx, baseSpec: { version: 1 as const, effects: [] } },
    })),
  }
  const plan = compileStudioArrangement(dry, [asset], {
    latencies: { sampleRate: 48000, framesByTrack: { 'track-1': 0 } },
  })
  const ctx = new ClockedContext()
  ctx.state = 'suspended'
  const buffer = ctx.createBuffer(1, 1000, 48000) as unknown as AudioBuffer
  const graph = buildStudioGraph(
    ctx.asContext,
    plan,
    new Map([[asset.id, buffer]]),
    0.5,
  )
  // The clip's first frame (100) is due 100 frames after the epoch.
  return { ctx, graph, due: 0.5 + 100 / 48000 }
}

describe('a Studio source scheduled late', () => {
  it('starts past the clock with its edges, where the browser would refuse its envelope', () => {
    const { ctx, graph, due } = lateLane()
    // This thread reached the clip 5 ms after it was due, as under load.
    ctx.currentTime = due + 0.005
    expect(() => graph.scheduleUntil(due + 1)).not.toThrow()
    const [source] = ctx.ofType<PlaybackSource>('source')
    const [start, offset] = source.starts[0]
    expect(start).toBeGreaterThan(ctx.currentTime)
    expect(offset).toBe(0)
    const param = (
      source.connections[0].node as unknown as { gain: ClockedParam }
    ).gain
    // The envelope opens where the sound starts: silent, then the 3 ms edge.
    expect(param.events[0]).toMatchObject({ time: start, value: 0 })
    expect(param.curves[0].time).toBe(start)
    expect(param.curves[0].duration).toBeCloseTo(144 / 48000, 12)
    graph.dispose()
  })

  it('starts on its frame when it is on time', () => {
    const { ctx, graph, due } = lateLane()
    ctx.currentTime = due - 0.5
    graph.scheduleUntil(due + 1)
    const [source] = ctx.ofType<PlaybackSource>('source')
    expect(source.starts[0][0]).toBe(due)
    graph.dispose()
  })
})
