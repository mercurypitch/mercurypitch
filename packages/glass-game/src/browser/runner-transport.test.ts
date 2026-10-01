// Runner transport tests — shared audio epochs and bounded audible/resource teardown.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runnerCourseFixture } from './__fixtures__/runner-course'
import { createBrowserRunnerTransport } from './runner-transport'

const mocks = vi.hoisted(() => ({ acquire: vi.fn() }))
vi.mock('@irchiinnuss/audio-io', () => ({
  acquireSharedAudioContext: mocks.acquire,
}))

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

function setup() {
  const gains: ReturnType<typeof parameter>[] = []
  const sources: (ReturnType<typeof node> & {
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    buffer: unknown
    onended: (() => void) | null
  })[] = []
  const context = Object.assign(new EventTarget(), {
    state: 'running',
    currentTime: 10,
    destination: node(),
    createGain: () => {
      const gain = parameter()
      gains.push(gain)
      return { ...node(), gain }
    },
    createBuffer: (_channels: number, count: number, sampleRate: number) => {
      const samples = new Float32Array(count)
      return { length: count, sampleRate, getChannelData: () => samples }
    },
    createBufferSource: () => {
      const source = {
        ...node(),
        start: vi.fn(),
        stop: vi.fn(),
        buffer: null as unknown,
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
  return { context, lease, gains, sources }
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('runner audio transport', () => {
  it('stays inert until the gesture and schedules finite music after a tempo-correct count-in', async () => {
    const fixture = setup()
    const course = runnerCourseFixture()
    const transport = createBrowserRunnerTransport(course, 60)
    expect(mocks.acquire).not.toHaveBeenCalled()
    const ready = transport.unlock()
    expect(fixture.lease.unlock).toHaveBeenCalledOnce()
    expect(await ready).toBe(true)
    const scheduled = transport.schedule(course.checkpoints[1]!)
    expect(scheduled.secondsPerBeat).toBe(60 / 108)
    expect(scheduled.audioStartSeconds).toBeCloseTo(10.08 + (4 * 60) / 108)
    expect(scheduled.courseStartSeconds).toBe(40)
    expect(
      fixture.sources.map((source) => source.start.mock.calls[0][0]),
    ).toEqual([scheduled.countInStartAudioSeconds, scheduled.audioStartSeconds])
    expect(() => transport.schedule(course.checkpoints[0]!)).toThrow(
      'already has an epoch',
    )
    transport.dispose()
    await vi.advanceTimersByTimeAsync(240)
    await transport.finished
    expect(fixture.lease.release).toHaveBeenCalledOnce()
  })

  it.each([0, 1, 2])(
    'uses the exact checkpoint %i half-open tempo',
    async (index) => {
      const fixture = setup(),
        course = runnerCourseFixture()
      const transport = createBrowserRunnerTransport(course, 60)
      await transport.unlock()
      expect(
        transport.schedule(course.checkpoints[index]!).secondsPerBeat,
      ).toBe(60 / [96, 108, 116][index]!)
      transport.dispose()
      await vi.advanceTimersByTimeAsync(240)
      expect(fixture.lease.release).toHaveBeenCalledOnce()
    },
  )

  it('mutes the output without freezing clock or stopping scheduled sources', async () => {
    const fixture = setup(),
      course = runnerCourseFixture()
    const transport = createBrowserRunnerTransport(course, 60)
    transport.setMuted(true)
    await transport.unlock()
    transport.schedule(course.checkpoints[0]!)
    fixture.context.currentTime = 11
    transport.setMuted(false)
    transport.setVoiceActive(true)
    expect(transport.currentAudioSeconds()).toBe(11)
    expect(
      fixture.sources.every((source) => source.stop.mock.calls.length === 0),
    ).toBe(true)
    expect(fixture.gains[1]!.setTargetAtTime).toHaveBeenLastCalledWith(
      0.65,
      11,
      0.12 / 5,
    )
    expect(fixture.gains[2]!.setTargetAtTime).toHaveBeenLastCalledWith(
      0.5,
      11,
      0.06 / 5,
    )
    transport.dispose()
    await vi.advanceTimersByTimeAsync(240)
  })

  it('waits for the release tail, resolves reference cancellation and releases once', async () => {
    const fixture = setup()
    const transport = createBrowserRunnerTransport(runnerCourseFixture(), 60)
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
    const transport = createBrowserRunnerTransport(runnerCourseFixture(), 60)
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
    const transport = createBrowserRunnerTransport(runnerCourseFixture(), 60)
    expect(await transport.unlock()).toBe(false)
    await transport.finished
    expect(fixture.sources).toHaveLength(0)
    expect(fixture.lease.release).toHaveBeenCalledOnce()
  })
})
