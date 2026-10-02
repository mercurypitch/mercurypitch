// Runner transport tests — shared audio epochs and bounded audible/resource teardown.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RunnerCourseFixturePace } from './__fixtures__/runner-course'
import { runnerCourseFixture } from './__fixtures__/runner-course'
import { deferred, flush } from './__fixtures__/runner-session'
import { createRunnerBackingCache, planRunnerPhraseGuides, RUNNER_JUDGE_GAIN, runnerVoiceSpans, } from './runner-music'
import { createBrowserRunnerTransport } from './runner-transport'

const pacingVariants: readonly {
  name: string
  pace: RunnerCourseFixturePace
  bpms: readonly [number, number, number]
  secondCheckpointSeconds: number
}[] = [
  {
    name: 'current',
    pace: 'current',
    bpms: [96, 108, 116],
    secondCheckpointSeconds: 40,
  },
  {
    name: 'learning',
    pace: 'learning',
    bpms: [84, 96, 104],
    secondCheckpointSeconds: 320 / 7,
  },
]

const checkpointTempoCases = pacingVariants.flatMap(({ name, pace, bpms }) =>
  bpms.map((bpm, index) => ({ name, pace, bpm, index })),
)

const mocks = vi.hoisted(() => ({ acquire: vi.fn(), fetch: vi.fn() }))
vi.mock('@irchiinnuss/audio-io', () => ({
  acquireSharedAudioContext: mocks.acquire,
}))
vi.mock('@irchiinnuss/mobile-runtime/asset-fetch', () => ({
  fetchAssetBytes: mocks.fetch,
}))

const audioOptions = { assetUrl: (id: string) => `/assets/${id}.mp3` }

function parameter() {
  return {
    value: 1,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  }
}

function node() {
  return {
    connect: vi.fn(function (this: unknown, next: unknown) {
      return next
    }),
    disconnect: vi.fn(),
  }
}

function decodedBuffer(samples: Float32Array<ArrayBuffer>): AudioBuffer {
  return {
    duration: samples.length / 1000,
    length: samples.length,
    numberOfChannels: 1,
    sampleRate: 1000,
    getChannelData: () => samples,
    copyFromChannel: (destination, _channel, offset = 0) =>
      destination.set(samples.subarray(offset, offset + destination.length)),
    copyToChannel: (source, _channel, offset = 0) =>
      samples.set(source.subarray(0, samples.length - offset), offset),
  }
}

function setup() {
  const gains: ReturnType<typeof parameter>[] = []
  const gainNodes: (ReturnType<typeof node> & {
    gain: ReturnType<typeof parameter>
  })[] = []
  const sources: (ReturnType<typeof node> & {
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    buffer: unknown
    playbackRate: ReturnType<typeof parameter>
    onended: (() => void) | null
  })[] = []
  const context = Object.assign(new EventTarget(), {
    state: 'running',
    currentTime: 10,
    destination: node(),
    createGain: () => {
      const gain = parameter()
      gains.push(gain)
      const created = { ...node(), gain }
      gainNodes.push(created)
      return created
    },
    createBuffer: vi.fn(
      (numberOfChannels: number, count: number, sampleRate: number) => {
        const channels = Array.from(
          { length: numberOfChannels },
          () => new Float32Array(count),
        )
        return {
          length: count,
          sampleRate,
          numberOfChannels,
          getChannelData: (channel: number) => channels[channel]!,
        }
      },
    ),
    decodeAudioData: vi.fn(async () => {
      const samples = Float32Array.from(
        { length: 1000 },
        (_, frame) => Math.sin(frame / 20) * 0.4,
      )
      return decodedBuffer(samples)
    }),
    createBufferSource: () => {
      const source = {
        ...node(),
        start: vi.fn(),
        stop: vi.fn(),
        buffer: null as unknown,
        playbackRate: parameter(),
        onended: null as (() => void) | null,
      }
      sources.push(source)
      return source
    },
  })
  const lease = {
    ensure: () => context,
    unlock: vi.fn().mockResolvedValue(true),
    release: vi.fn(),
  }
  mocks.acquire.mockReturnValue(lease)
  return { context, lease, gains, gainNodes, sources }
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  mocks.fetch.mockResolvedValue(new ArrayBuffer(10))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('runner audio transport', () => {
  it.each(pacingVariants)(
    'stays inert until the gesture and schedules finite $name music after a tempo-correct count-in',
    async ({ pace, bpms, secondCheckpointSeconds }) => {
      const fixture = setup()
      const course = runnerCourseFixture(pace)
      const transport = createBrowserRunnerTransport(course, 60, audioOptions)
      expect(mocks.acquire).not.toHaveBeenCalled()
      const ready = transport.unlock()
      expect(fixture.lease.unlock).toHaveBeenCalledOnce()
      expect(await ready).toBe(true)
      await transport.prepareBacking()
      const scheduled = transport.schedule(course.checkpoints[1]!)
      expect(scheduled.secondsPerBeat).toBe(60 / bpms[1])
      expect(scheduled.audioStartSeconds).toBeCloseTo(
        10.08 + (4 * 60) / bpms[1],
      )
      expect(scheduled.courseStartSeconds).toBeCloseTo(
        secondCheckpointSeconds,
        12,
      )
      expect(
        fixture.sources.map((source) => source.start.mock.calls[0][0]),
      ).toEqual([
        scheduled.countInStartAudioSeconds,
        scheduled.audioStartSeconds,
        scheduled.audioStartSeconds,
      ])
      expect(() => transport.schedule(course.checkpoints[0]!)).toThrow(
        'already has an epoch',
      )
      transport.dispose()
      await vi.advanceTimersByTimeAsync(240)
      await transport.finished
      expect(fixture.lease.release).toHaveBeenCalledOnce()
    },
  )

  it.each(checkpointTempoCases)(
    'uses the exact $name checkpoint $index half-open tempo',
    async ({ pace, bpm, index }) => {
      const fixture = setup(),
        course = runnerCourseFixture(pace)
      const transport = createBrowserRunnerTransport(course, 60, audioOptions)
      await transport.unlock()
      await transport.prepareBacking()
      expect(
        transport.schedule(course.checkpoints[index]!).secondsPerBeat,
      ).toBe(60 / bpm)
      transport.dispose()
      await vi.advanceTimersByTimeAsync(240)
      expect(fixture.lease.release).toHaveBeenCalledOnce()
    },
  )

  it('mutes the output without freezing clock or stopping scheduled sources', async () => {
    const fixture = setup(),
      course = runnerCourseFixture()
    const transport = createBrowserRunnerTransport(course, 60, audioOptions)
    transport.setMuted(true)
    await transport.unlock()
    await transport.prepareBacking()
    transport.schedule(course.checkpoints[0]!)
    fixture.context.currentTime = 11
    transport.setMuted(false)
    transport.setVoiceActive(true)
    expect(transport.currentAudioSeconds()).toBe(11)
    expect(
      fixture.sources.every((source) => source.stop.mock.calls.length === 0),
    ).toBe(true)
    expect(fixture.gains[1]!.setTargetAtTime).toHaveBeenLastCalledWith(
      0.35,
      11,
      0.12 / 5,
    )
    expect(fixture.gains[3]!.setTargetAtTime).toHaveBeenLastCalledWith(
      0.5,
      11,
      0.06 / 5,
    )
    transport.dispose()
    await vi.advanceTimersByTimeAsync(240)
  })

  it('waits for the release tail, resolves reference cancellation and releases once', async () => {
    const fixture = setup()
    const transport = createBrowserRunnerTransport(
      runnerCourseFixture(),
      60,
      audioOptions,
    )
    await transport.unlock()
    const reference = transport.hearReference(60)
    fixture.context.currentTime += 0.02
    let finished = false
    void transport.finished.then(() => {
      finished = true
    })
    transport.dispose()
    transport.dispose()
    expect(fixture.sources[0]!.stop).toHaveBeenCalledWith(10.26)
    expect(fixture.gains[0]!.setTargetAtTime).toHaveBeenLastCalledWith(
      0,
      10.02,
      0.18 / 5,
    )
    expect(fixture.lease.release).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(239)
    expect(finished).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await reference
    await transport.finished
    expect(finished).toBe(true)
    expect(fixture.sources[0]!.disconnect).toHaveBeenCalledOnce()
    expect(fixture.lease.release).toHaveBeenCalledOnce()
  })

  it('closes immediately on a stopped audio clock and never replays on resume', async () => {
    const fixture = setup()
    const transport = createBrowserRunnerTransport(
      runnerCourseFixture(),
      60,
      audioOptions,
    )
    await transport.unlock()
    void transport.hearReference(60)
    const interrupted = vi.fn()
    transport.subscribeInterruption(interrupted)
    fixture.context.state = 'interrupted'
    fixture.context.dispatchEvent(new Event('statechange'))
    await transport.finished
    expect(interrupted).toHaveBeenCalledOnce()
    expect(fixture.lease.release).toHaveBeenCalledOnce()
    fixture.context.state = 'running'
    fixture.context.dispatchEvent(new Event('statechange'))
    expect(await transport.unlock()).toBe(false)
    expect(transport.currentAudioSeconds()).toBeNull()
    expect(fixture.sources).toHaveLength(1)
  })

  it('releases a failed unlock and never builds scheduled output', async () => {
    const fixture = setup()
    fixture.lease.unlock.mockResolvedValue(false)
    const transport = createBrowserRunnerTransport(
      runnerCourseFixture(),
      60,
      audioOptions,
    )
    expect(await transport.unlock()).toBe(false)
    await transport.finished
    expect(fixture.sources).toHaveLength(0)
    expect(fixture.lease.release).toHaveBeenCalledOnce()
  })

  it('leaves count-in, phrase examples and reference notes on their own bus at music zero and mute', async () => {
    const fixture = setup(),
      course = runnerCourseFixture()
    const transport = createBrowserRunnerTransport(course, 60, audioOptions)
    transport.setPreferences({ musicVolume: 0 })
    transport.setMuted(true)
    await transport.unlock()
    await transport.prepareBacking()
    const schedule = transport.schedule(course.checkpoints[0]!)

    expect(fixture.gains[1]!.setValueAtTime).toHaveBeenCalledWith(0, 10)
    expect(fixture.gains[2]!.setValueAtTime).toHaveBeenCalledWith(0.65, 10)
    expect(fixture.sources[0]!.connect).toHaveBeenCalledWith(
      fixture.gainNodes[2],
    )
    expect(fixture.sources[2]!.connect).toHaveBeenCalledWith(
      fixture.gainNodes[5],
    )
    expect(fixture.gainNodes[5]!.connect).toHaveBeenCalledWith(
      fixture.gainNodes[2],
    )
    expect(fixture.gainNodes[2]!.connect).toHaveBeenCalledWith(
      fixture.gainNodes[0],
    )
    expect(
      (fixture.sources[2]!.buffer as AudioBuffer)
        .getChannelData(0)
        .some((sample) => sample !== 0),
    ).toBe(true)
    for (const source of fixture.sources)
      expect(source.playbackRate.setValueAtTime).toHaveBeenCalledWith(
        1,
        source.start.mock.calls[0]![0],
      )
    fixture.context.currentTime = schedule.audioStartSeconds + 0.1
    transport.setPreferences({ musicVolume: 0.9 })
    transport.setMuted(false)
    expect(fixture.gains[2]!.setTargetAtTime).not.toHaveBeenCalled()
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    transport.dispose()
    await vi.advanceTimersByTimeAsync(240)

    const referenceFixture = setup()
    const referenceTransport = createBrowserRunnerTransport(
      course,
      60,
      audioOptions,
    )
    referenceTransport.setMuted(true)
    await referenceTransport.unlock()
    void referenceTransport.hearReference(60)
    expect(referenceFixture.sources[0]!.connect).toHaveBeenCalledWith(
      referenceFixture.gainNodes[2],
    )
    referenceTransport.dispose()
    await vi.advanceTimersByTimeAsync(240)
  })

  it.each(pacingVariants)(
    'keeps the last $name guide note audible until its planned end, then protects capture',
    async ({ pace }) => {
      const fixture = setup(),
        course = runnerCourseFixture(pace)
      const transport = createBrowserRunnerTransport(course, 60, audioOptions)
      await transport.unlock()
      await transport.prepareBacking()
      const schedule = transport.schedule(course.checkpoints[0]!)
      const guide = planRunnerPhraseGuides(course)[0]!
      const span = runnerVoiceSpans(course)[0]!
      const guideFade = fixture.gains[5]!.setTargetAtTime.mock.calls.find(
        ([gain]) => gain === RUNNER_JUDGE_GAIN,
      )!
      const lastNoteAt = schedule.audioStartSeconds + guide.end - 0.1
      const audibleGain =
        lastNoteAt < guideFade[1]
          ? 1
          : RUNNER_JUDGE_GAIN +
            (1 - RUNNER_JUDGE_GAIN) *
              Math.exp(-(lastNoteAt - guideFade[1]) / guideFade[2])
      expect(audibleGain).toBeGreaterThan(0.9)
      expect(guideFade[1]).toBeGreaterThanOrEqual(
        schedule.audioStartSeconds + guide.end,
      )
      const samples = (
        fixture.sources[2]!.buffer as AudioBuffer
      ).getChannelData(0)
      expect(
        samples
          .slice(
            Math.floor((guide.end - 0.25) * 24_000),
            Math.floor((guide.end - 0.1) * 24_000),
          )
          .some((value) => Math.abs(value) > 0.001),
      ).toBe(true)
      expect(fixture.gains[4]!.setTargetAtTime).toHaveBeenCalledWith(
        RUNNER_JUDGE_GAIN,
        schedule.audioStartSeconds + span.start - 0.35,
        0.035,
      )
      expect(fixture.gains[5]!.setValueAtTime).toHaveBeenCalledWith(
        RUNNER_JUDGE_GAIN,
        schedule.audioStartSeconds + span.start,
      )
      transport.dispose()
      await vi.advanceTimersByTimeAsync(240)
    },
  )

  it('schedules hard guards on both score buses and keeps reactive ducking on backing only', async () => {
    const fixture = setup(),
      course = runnerCourseFixture()
    const transport = createBrowserRunnerTransport(course, 60, audioOptions)
    await transport.unlock()
    await transport.prepareBacking()
    const schedule = transport.schedule(course.checkpoints[0]!)
    const span = runnerVoiceSpans(course)[0]!
    for (const index of [4, 5]) {
      expect(fixture.gains[index]!.setValueAtTime).toHaveBeenCalledWith(
        RUNNER_JUDGE_GAIN,
        schedule.audioStartSeconds + span.start,
      )
      const samples = (
        fixture.sources[index === 4 ? 1 : 2]!.buffer as AudioBuffer
      ).getChannelData(0)
      expect(
        samples
          .slice(Math.floor(span.start * 24_000), Math.ceil(span.end * 24_000))
          .some((sample) => sample !== 0),
      ).toBe(false)
    }
    const guardCalls = fixture.gains.map(
      (gain) => gain.setTargetAtTime.mock.calls.length,
    )

    transport.setVoiceActive(true)

    expect(fixture.gainNodes[4]!.connect).toHaveBeenCalledWith(
      fixture.gainNodes[3],
    )
    expect(fixture.gainNodes[3]!.connect).toHaveBeenCalledWith(
      fixture.gainNodes[1],
    )
    expect(fixture.gains[3]!.setTargetAtTime).toHaveBeenLastCalledWith(
      0.5,
      10,
      0.06 / 5,
    )
    expect(fixture.gains[4]!.setTargetAtTime).toHaveBeenCalledTimes(
      guardCalls[4]!,
    )
    expect(fixture.gains[5]!.setTargetAtTime).toHaveBeenCalledTimes(
      guardCalls[5]!,
    )
    expect(fixture.gains[2]!.setTargetAtTime).not.toHaveBeenCalled()
    transport.dispose()
    await vi.advanceTimersByTimeAsync(240)
  })

  it('waits for decode before anchoring and reuses only the two approved buffers on restart', async () => {
    const fixture = setup(),
      course = runnerCourseFixture(),
      cache = createRunnerBackingCache()
    const decoded = deferred<AudioBuffer>()
    fixture.context.decodeAudioData.mockReturnValue(decoded.promise)
    const transport = createBrowserRunnerTransport(course, 60, {
      ...audioOptions,
      backingCache: cache,
    })
    await transport.unlock()
    const preparing = transport.prepareBacking()
    await flush()
    expect(() => transport.schedule(course.checkpoints[0]!)).toThrow(
      'not prepared',
    )
    fixture.context.currentTime = 50
    decoded.resolve(fixture.context.createBuffer(1, 1000, 1000) as AudioBuffer)
    expect(await preparing).toEqual({ music: true, ambience: true })
    expect(
      transport.schedule(course.checkpoints[0]!).countInStartAudioSeconds,
    ).toBe(50.08)
    expect(cache.buffers.size).toBe(2)
    transport.dispose()
    await vi.advanceTimersByTimeAsync(240)
    const second = setup()
    const restart = createBrowserRunnerTransport(course, 60, {
      ...audioOptions,
      backingCache: cache,
    })
    await restart.unlock()
    expect(await restart.prepareBacking()).toEqual({
      music: true,
      ambience: true,
    })
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    expect(second.context.decodeAudioData).not.toHaveBeenCalled()
    restart.dispose()
  })

  it('cancels immediately on dispose, rejects late decode buffers and bounds repeat-start decode slots', async () => {
    const first = setup(),
      course = runnerCourseFixture(),
      cache = createRunnerBackingCache()
    const decoded = deferred<AudioBuffer>()
    first.context.decodeAudioData.mockReturnValue(decoded.promise)
    const transport = createBrowserRunnerTransport(course, 60, {
      ...audioOptions,
      backingCache: cache,
    })
    await transport.unlock()
    const preparing = transport.prepareBacking()
    await flush()
    transport.dispose()
    expect(await preparing).toEqual({ music: false, ambience: false })
    await transport.finished
    expect(first.lease.release).toHaveBeenCalledOnce()
    expect(cache.decoding.size).toBe(2)
    const second = setup()
    const restart = createBrowserRunnerTransport(course, 60, {
      ...audioOptions,
      backingCache: cache,
    })
    await restart.unlock()
    const waiting = restart.prepareBacking()
    await flush()
    expect(second.context.decodeAudioData).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(15_000)
    expect(await waiting).toEqual({ music: false, ambience: false })
    decoded.resolve(decodedBuffer(new Float32Array(1000)))
    await flush()
    expect(first.context.createBuffer).not.toHaveBeenCalled()
    expect(cache.buffers.size).toBe(0)
    expect(cache.decoding.size).toBe(0)
    expect(first.sources).toHaveLength(0)
    restart.dispose()
  })

  it('keeps guides playable after optional backing failure without fetching during active playback', async () => {
    const fixture = setup(),
      course = runnerCourseFixture()
    mocks.fetch.mockRejectedValue(new Error('missing recording'))
    const transport = createBrowserRunnerTransport(course, 60, audioOptions)
    await transport.unlock()
    expect(await transport.prepareBacking()).toEqual({
      music: false,
      ambience: false,
    })
    transport.schedule(course.checkpoints[0]!)
    transport.setMuted(true)
    transport.setPreferences({ musicVolume: 0 })

    expect(fixture.sources).toHaveLength(2)
    expect(
      (fixture.sources[1]!.buffer as AudioBuffer)
        .getChannelData(0)
        .some((sample) => sample !== 0),
    ).toBe(true)
    expect(fixture.gains[2]!.setTargetAtTime).not.toHaveBeenCalled()
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    expect(fixture.context.decodeAudioData).not.toHaveBeenCalled()
    transport.dispose()
    await vi.advanceTimersByTimeAsync(240)
  })
})
