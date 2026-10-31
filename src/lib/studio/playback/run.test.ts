// Studio run tests — a Play from silence starts on a whole frame of the audio clock, so its sources start on their samples.
import { describe, expect, it } from 'vitest'
import { EMPTY_CHAIN } from '@/lib/studio-fx/chain-spec'
import type { createStudioLaneMeter } from '../metering/live-meter'
import { compileStudioArrangement } from '../model/arrangement-plan'
import { studioFixture } from '../model/model.test-fixtures'
import { buildStudioGraph } from './graph'
import type { PlaybackSource } from './playback.test-fixtures'
import { PlaybackContext } from './playback.test-fixtures'
import { buildStudioRun, openRunEnvelope } from './run'

/** How far `time` sits from the nearest frame of a `rate` clock, in frames. */
const offFrame = (time: number, rate: number) =>
  Math.abs(time * rate - Math.round(time * rate))

/** The fixture's 20 ms of chain and master latency: whole frames at any rate it measures at. */
const LATENCY = 0.02

/**
 * A Play from silence on a `rate` clock at 1 s whose device reports a
 * callback of `baseLatency`, through the real graph: one dry lane with its
 * clip 100 frames into the song.
 */
function playFromSilence(rate: number, baseLatency: number) {
  const { project, asset } = studioFixture()
  const dry = {
    ...project,
    tracks: project.tracks.map((track) => ({
      ...track,
      fx: { ...track.fx, baseSpec: EMPTY_CHAIN },
    })),
  }
  const plan = compileStudioArrangement(dry, [asset], {
    latencies: { sampleRate: rate, framesByTrack: { 'track-1': 0 } },
  })
  const ctx = new PlaybackContext(rate)
  Object.assign(ctx, { currentTime: 1, baseLatency })
  const buffer = ctx.createBuffer(1, 1000, 48000) as unknown as AudioBuffer
  const epochs: number[] = []
  const run = buildStudioRun({
    ctx: ctx.liveContext,
    project: dry,
    plan,
    buffers: { buffers: new Map([[asset.id, buffer]]), release: () => {} },
    releaseMemory: () => {},
    silentLanes: false,
    master: EMPTY_CHAIN,
    measured: { gainDb: 0, safetyGainDb: 0 },
    repeat: false,
    timing: { fromFrame: 0, audibleEpoch: 0 },
    latency: LATENCY,
    buildGraph: (...args: Parameters<typeof buildStudioGraph>) => {
      epochs.push(args[3])
      return buildStudioGraph(...args)
    },
    createLaneMeter: (() => null) as typeof createStudioLaneMeter,
    fromSilence: true,
    open: openRunEnvelope,
  })
  // The soonest the device allows: a callback and 5 ms past the clock.
  const asked = 1 + baseLatency + 0.005
  return { ctx, run, epochs, asked }
}

describe('a Studio run from silence', () => {
  it('starts every source on its sample of a 48 kHz clock when the device callback is not whole frames of it', () => {
    // A 44.1 kHz device's 4,096-frame callback behind the Studio's 48 kHz
    // context: 4458.23 frames of it, so the lead alone ends between frames.
    const { ctx, run, asked } = playFromSilence(48000, 4096 / 44100)

    const sources = ctx.ofType<PlaybackSource>('source')
    expect(sources).toHaveLength(1)
    const [[start, offset]] = sources[0].starts
    expect(offFrame(start, 48000)).toBeLessThan(1e-6)
    expect(start).toBeCloseTo(run.audibleEpoch - LATENCY + 100 / 48000, 12)
    expect(offset).toBe(0)
    // No sooner than the device allows, and less than a frame later.
    const epoch = run.audibleEpoch - LATENCY
    expect(epoch).toBeGreaterThanOrEqual(asked)
    expect(epoch - asked).toBeLessThan(1 / 48000)
    run.graph.dispose()
  })

  it('starts on a whole frame of a 44.1 kHz clock too, which resamples every take', () => {
    // A 48 kHz device's 4,096-frame callback behind a 44.1 kHz context.
    const { run, epochs, asked } = playFromSilence(44100, 4096 / 48000)

    expect(epochs).toHaveLength(1)
    expect(offFrame(epochs[0], 44100)).toBeLessThan(1e-6)
    expect(epochs[0]).toBeGreaterThanOrEqual(asked)
    expect(epochs[0] - asked).toBeLessThan(1 / 44100)
    expect(run.audibleEpoch).toBeCloseTo(epochs[0] + LATENCY, 12)
    run.graph.dispose()
  })
})
