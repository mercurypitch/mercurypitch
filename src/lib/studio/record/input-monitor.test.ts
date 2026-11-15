// Studio input monitor — off builds nothing; on plays the input folded as the take is, spread, through its lane's chain at the monitor profile and its faders, on one path however often it is set; a lane not heard, and dispose, take the graph apart after the release; a lane heard again while it releases plays on through the same path; and dispose says when its input may close: at once with nothing heard, once the path has come apart otherwise.
import { describe, expect, it, vi } from 'vitest'
import { normalizeChainSpec } from '@/lib/studio-fx/chain-spec'
import type { FakeGain } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import { createManualScheduler, FakeAudioContext, FakeNode, reaches, } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import type { StudioMonitorSound } from './input-monitor'
import { createStudioInputMonitor } from './input-monitor'

/** A lane with an EQ and a compressor. */
const LANE_CHAIN = normalizeChainSpec({
  effects: [
    { kind: 'eq', params: {}, enabled: true },
    { kind: 'compressor', params: {}, enabled: true },
  ],
})

/** The house release and its slack, in ms: when a released path comes apart. */
const RELEASED_MS = 240

function sound(over: Partial<StudioMonitorSound> = {}): StudioMonitorSound {
  return { on: true, spec: LANE_CHAIN, gains: [0.5, 0.25], ...over }
}

function setup() {
  const ctx = new FakeAudioContext()
  // Stands for the microphone's source node, which the arm owns.
  const input = new FakeNode('source')
  const scheduler = createManualScheduler()
  const monitor = createStudioInputMonitor(
    ctx.asContext,
    input as unknown as AudioNode,
    { schedule: scheduler.schedule },
  )
  return { ctx, input, scheduler, monitor }
}

/** The path's level: the gain feeding the destination. */
function levels(ctx: FakeAudioContext): FakeGain[] {
  return ctx
    .ofType<FakeGain>('gain')
    .filter((gain) => gain.targets.includes(ctx.destination))
}

/** The fader gains: the gains feeding a path's merger. */
function faders(ctx: FakeAudioContext): FakeGain[] {
  const [merger] = ctx.ofType<FakeNode>('merger')
  return ctx
    .ofType<FakeGain>('gain')
    .filter((gain) => gain.targets.includes(merger))
}

function stillWired(ctx: FakeAudioContext): FakeNode[] {
  return ctx.created.filter((node) => node.connections.length > 0)
}

describe('the input monitor', () => {
  it('builds nothing and leaves the input alone while monitoring is off', () => {
    const { ctx, input, monitor } = setup()

    monitor.set(sound({ on: false }))

    expect(ctx.created).toEqual([])
    expect(input.targets).toEqual([])
  })

  it('plays the input folded to mono as the take is, spread to both sides as a clip is, through the chain and faders, rising from silence', () => {
    const { ctx, input, monitor } = setup()

    monitor.set(sound())

    const [fold] = input.targets
    expect(fold).toMatchObject({
      nodeType: 'gain',
      channelCount: 1,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
    })
    const [spread] = fold.targets
    expect(spread).toMatchObject({
      nodeType: 'gain',
      channelCount: 2,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
    })
    expect(reaches(input, ctx.destination)).toBe(true)
    const sides = faders(ctx)
    expect(sides.map((side) => side.gain.value)).toEqual([0.5, 0.25])
    expect(sides.map((side) => side.connections[0].input)).toEqual([0, 1])
    const [level] = levels(ctx)
    expect(level.gain.value).toBe(0)
    expect(level.gain.lastWrite).toMatchObject({
      kind: 'target',
      value: 1,
      timeConstant: 0.036,
    })
  })

  it('runs the chain at the monitor profile, so the compressor sits out', () => {
    const { ctx, monitor } = setup()

    monitor.set(sound())

    expect(ctx.ofType('compressor')).toEqual([])
    expect(ctx.ofType('biquad').length).toBeGreaterThan(0)
  })

  it('glides the faders to a new volume or pan, and writes nothing when the sound is the same', () => {
    const { ctx, monitor } = setup()
    monitor.set(sound())
    const sides = faders(ctx)
    const written = sides.map((side) => side.gain.events.length)

    monitor.set(sound())
    expect(sides.map((side) => side.gain.events.length)).toEqual(written)

    monitor.set(sound({ gains: [1, 0.75] }))
    expect(sides.map((side) => side.gain.lastWrite)).toEqual([
      { kind: 'target', time: 0, value: 1, timeConstant: 0.01 },
      { kind: 'target', time: 0, value: 0.75, timeConstant: 0.01 },
    ])
    expect(levels(ctx)).toHaveLength(1)
  })

  it('takes a lane that is not heard out of the graph after the release, the input feeding nothing of it', () => {
    const { ctx, input, scheduler, monitor } = setup()
    monitor.set(sound())

    monitor.set(sound({ gains: [0, 0] }))

    expect(levels(ctx)[0].gain.lastWrite).toMatchObject({
      value: 0,
      timeConstant: 0.036,
    })
    scheduler.advance(RELEASED_MS - 1)
    expect(input.targets).toHaveLength(1)
    scheduler.advance(1)
    expect(stillWired(ctx)).toEqual([])
    expect(input.targets).toEqual([])
  })

  it('brings a releasing path back instead of building a second chain', () => {
    const { ctx, scheduler, monitor } = setup()
    monitor.set(sound())
    monitor.set(sound({ on: false }))
    scheduler.advance(100)
    const built = ctx.created.length

    monitor.set(sound())
    scheduler.advance(1000)

    expect(ctx.created).toHaveLength(built)
    const [level] = levels(ctx)
    expect(level.gain.lastWrite).toMatchObject({ kind: 'target', value: 1 })
  })

  it('releases on dispose, comes apart after the release, and ignores what follows', () => {
    const { ctx, input, scheduler, monitor } = setup()
    monitor.set(sound())

    monitor.dispose()
    monitor.set(sound({ gains: [1, 1] }))

    const [level] = levels(ctx)
    expect(level.gain.lastWrite).toMatchObject({ kind: 'target', value: 0 })
    expect(ctx.ofType('merger')).toHaveLength(1)
    scheduler.advance(RELEASED_MS)
    expect(stillWired(ctx)).toEqual([])
    expect(input.targets).toEqual([])
  })

  it('lets its input go at once when nothing is heard', () => {
    const { monitor } = setup()
    monitor.set(sound({ on: false }))
    const silent = vi.fn()

    monitor.dispose(silent)

    expect(silent).toHaveBeenCalledOnce()
  })

  it('keeps its input until the path it heard has come apart, then lets it go', () => {
    const { input, scheduler, monitor } = setup()
    monitor.set(sound())
    const silent = vi.fn()

    monitor.dispose(silent)

    scheduler.advance(RELEASED_MS - 1)
    expect(silent).not.toHaveBeenCalled()
    expect(input.targets).toHaveLength(1)
    scheduler.advance(1)
    expect(input.targets).toEqual([])
    expect(silent).toHaveBeenCalledOnce()
  })

  it('lets its input go when a path already releasing comes apart, not a release later', () => {
    const { scheduler, monitor } = setup()
    monitor.set(sound())
    // Muted at 0, disposed at 100: the release that began at 0 decides.
    monitor.set(sound({ gains: [0, 0] }))
    scheduler.advance(100)
    const silent = vi.fn()

    monitor.dispose(silent)

    scheduler.advance(RELEASED_MS - 101)
    expect(silent).not.toHaveBeenCalled()
    scheduler.advance(1)
    expect(silent).toHaveBeenCalledOnce()
  })
})
