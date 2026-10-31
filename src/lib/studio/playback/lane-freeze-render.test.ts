// Studio lane freeze render — a lane renders run by run: each on a context the length of its own clips and tail, never the whole song.
import { describe, expect, it } from 'vitest'
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import { FakeNode, FakeOfflineAudioContext, } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import type { StudioPlannedLane } from '../model/arrangement-plan'
import { compileStudioArrangement } from '../model/arrangement-plan'
import { studioFixture } from '../model/model.test-fixtures'
import { FREEZE_CHUNK_FRAMES } from './lane-freeze'
import { FREEZE_PRE_ROLL_FRAMES, freezeTailFrames, laneRenderRuns, laneRenderWorkingBytes, renderLaneFreeze, } from './lane-freeze-render'

const NO_CHAIN: ChainSpec = { version: 1, effects: [] }

/** An offline context that renders a steady level, and remembers where each source started. */
class RenderContext extends FakeOfflineAudioContext {
  readonly starts: number[] = []

  constructor(readonly length: number) {
    super(48000)
  }

  createBufferSource() {
    const source = Object.assign(new FakeNode('source'), {
      buffer: null as unknown,
      start: (when: number) => {
        this.starts.push(when)
      },
    })
    return source
  }

  createGain() {
    const gain = super.createGain()
    Object.assign(gain.gain, { setValueCurveAtTime: () => gain.gain })
    return gain
  }

  startRendering() {
    const out = this.createBuffer(2, this.length, this.sampleRate)
    out.channels.forEach((channel) => channel.fill(0.5))
    return Promise.resolve(out)
  }
}

/** A lane with two clips close enough to share a tail, and one a minute later. */
function lane(): StudioPlannedLane {
  const { project, asset, clip } = studioFixture()
  const length = clip.sourceOutFrame - clip.sourceInFrame
  const clips = [0, length + 1000, 48000 * 60].map((startFrame, index) => ({
    ...clip,
    id: `clip-${index + 1}`,
    startFrame,
  }))
  const [planned] = compileStudioArrangement({ ...project, clips }, [
    asset,
  ]).lanes
  return { ...planned, spec: NO_CHAIN }
}

describe('Studio lane freeze render', () => {
  it('splits a lane into runs of clips whose tails overlap', () => {
    const planned = lane()
    const runs = laneRenderRuns(planned)
    expect(runs.map((run) => run.segments.length)).toEqual([2, 1])
    const tail = freezeTailFrames(planned.spec)
    const [first, second] = planned.segments
    expect(runs[0]).toMatchObject({
      startFrame: 0,
      length:
        second.startFrame +
        second.sourceOutFrame -
        second.sourceInFrame +
        tail -
        first.startFrame,
    })
    expect(runs[1].startFrame).toBe(48000 * 60)
  })

  it('renders each run on a context of its own length, with its chunks where its clips are', async () => {
    const planned = lane()
    const contexts: RenderContext[] = []
    const buffers = new Map(
      planned.segments.map((segment) => [segment.assetId, {} as AudioBuffer]),
    )
    const frozen = await renderLaneFreeze(planned, buffers, {
      latencyFrames: 32,
      key: 'k',
      signal: new AbortController().signal,
      createContext: (frames) => {
        const ctx = new RenderContext(frames)
        contexts.push(ctx)
        return ctx as unknown as OfflineAudioContext
      },
    })
    const runs = laneRenderRuns(planned)
    // Pre-roll and latency, then the run: the minute of silence is never rendered.
    expect(contexts.map((ctx) => ctx.length)).toEqual(
      runs.map((run) => FREEZE_PRE_ROLL_FRAMES + 32 + run.length),
    )
    // The lone clip starts its own run, right after that run's pre-roll.
    expect(contexts[1].starts).toEqual([FREEZE_PRE_ROLL_FRAMES / 48000])
    const starts = frozen.chunks.map((chunk) => chunk.startFrame)
    expect(starts[0]).toBe(0)
    expect(starts).toContain(48000 * 60)
    const frames = frozen.chunks.reduce((sum, chunk) => sum + chunk.frames, 0)
    expect(frames).toBe(runs[0].length + runs[1].length)
    // Its peak memory is the longest run's render, not the song's length.
    expect(laneRenderWorkingBytes(planned, 32)).toBeLessThan(48000 * 60 * 2 * 4)
    expect(
      frozen.chunks.every((chunk) => chunk.frames <= FREEZE_CHUNK_FRAMES),
    ).toBe(true)
  })
})
