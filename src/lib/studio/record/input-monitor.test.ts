// Studio input monitor — off builds nothing; on plays the input folded, spread, through its lane's chain at the monitor profile and its faders; moving the arm crosses paths without doubling the input; a lane not heard, and dispose, take the graph apart after the release.
import { describe, expect, it } from 'vitest'
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

function sound(
  laneId: string,
  over: Partial<StudioMonitorSound> = {},
): StudioMonitorSound {
  return { on: true, laneId, spec: LANE_CHAIN, gains: [0.5, 0.25], ...over }
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

/** One level per path: the gains feeding the destination. */
function levels(ctx: FakeAudioContext): FakeGain[] {
  return ctx
    .ofType<FakeGain>('gain')
    .filter((gain) => gain.targets.includes(ctx.destination))
}

/** The fader gains: the gains feeding a path's merger. */
function faders(ctx: FakeAudioContext, path = 0): FakeGain[] {
  const merger = ctx.ofType<FakeNode>('merger')[path]
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

    monitor.set(sound('lane-1', { on: false }))

    expect(ctx.created).toEqual([])
    expect(input.targets).toEqual([])
  })

  it('plays the input folded to mono, spread to both sides as a clip is, through the chain and faders, rising from silence', () => {
    const { ctx, input, monitor } = setup()

    monitor.set(sound('lane-1'))

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

    monitor.set(sound('lane-1'))

    expect(ctx.ofType('compressor')).toEqual([])
    expect(ctx.ofType('biquad').length).toBeGreaterThan(0)
  })

  it('glides the faders to a new volume or pan, and writes nothing when the sound is the same', () => {
    const { ctx, monitor } = setup()
    monitor.set(sound('lane-1'))
    const sides = faders(ctx)
    const written = sides.map((side) => side.gain.events.length)

    monitor.set(sound('lane-1'))
    expect(sides.map((side) => side.gain.events.length)).toEqual(written)

    monitor.set(sound('lane-1', { gains: [1, 0.75] }))
    expect(sides.map((side) => side.gain.lastWrite)).toEqual([
      { kind: 'target', time: 0, value: 1, timeConstant: 0.01 },
      { kind: 'target', time: 0, value: 0.75, timeConstant: 0.01 },
    ])
    expect(levels(ctx)).toHaveLength(1)
  })

  it('crosses to another lane on one time constant, from one fold, then takes the first lane apart', () => {
    const { ctx, input, scheduler, monitor } = setup()
    monitor.set(sound('lane-1'))

    monitor.set(sound('lane-2', { gains: [1, 1] }))

    const [first, second] = levels(ctx)
    expect(first.gain.lastWrite).toMatchObject({
      kind: 'target',
      value: 0,
      timeConstant: 0.036,
    })
    expect(second.gain.lastWrite).toMatchObject({
      kind: 'target',
      value: 1,
      timeConstant: 0.036,
    })
    expect(input.targets).toHaveLength(1)
    expect(faders(ctx, 1).map((side) => side.gain.value)).toEqual([1, 1])

    scheduler.advance(RELEASED_MS)

    expect(levels(ctx)).toEqual([second])
    expect(first.connections).toEqual([])
    expect(reaches(input, ctx.destination)).toBe(true)
  })

  it('takes a lane that is not heard out of the graph after the release, and stops feeding the fold once no path is left', () => {
    const { ctx, input, scheduler, monitor } = setup()
    monitor.set(sound('lane-1'))

    monitor.set(sound('lane-1', { gains: [0, 0] }))

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
    monitor.set(sound('lane-1'))
    monitor.set(sound('lane-1', { on: false }))
    scheduler.advance(100)
    const built = ctx.created.length

    monitor.set(sound('lane-1'))
    scheduler.advance(1000)

    expect(ctx.created).toHaveLength(built)
    const [level] = levels(ctx)
    expect(level.gain.lastWrite).toMatchObject({ kind: 'target', value: 1 })
  })

  it('releases on dispose, comes apart after the release, and ignores what follows', () => {
    const { ctx, input, scheduler, monitor } = setup()
    monitor.set(sound('lane-1'))

    monitor.dispose()
    monitor.set(sound('lane-2'))

    const [level] = levels(ctx)
    expect(level.gain.lastWrite).toMatchObject({ kind: 'target', value: 0 })
    expect(ctx.ofType('merger')).toHaveLength(1)
    scheduler.advance(RELEASED_MS)
    expect(stillWired(ctx)).toEqual([])
    expect(input.targets).toEqual([])
  })
})
