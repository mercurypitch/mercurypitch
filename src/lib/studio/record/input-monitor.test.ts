// Studio input monitor — off builds nothing; on plays the input folded as the take is, spread, through its lane's chain at the monitor profile and its faders, then the master and only through it, on one path however often it is set, rising a quarter of a second after the input's first sound, after a second without one, at once as its source settles under another lane, or at once on an input that plays cleanly from its first sample; a lane not heard, and dispose, take the graph apart after the release, the master with it, and at once a path that never began to rise; a lane heard again while it releases plays on through the same path; and dispose says when its input may close: at once with nothing heard, once the path has come apart otherwise. On the Light tier a lane's de-esser and dynamic EQ are a wire each with no worklet, and a new tier swaps them in the same path under its chain's duck. While its path exists the lane counts in Auto's pick of playback's tier, as each tier's monitor would play it, and Auto's listeners hear of it once the monitor's change is done.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_CHAIN, normalizeChainSpec } from '@/lib/studio-fx/chain-spec'
import { COMPRESSOR_PARAMETERS, STUDIO_COMPRESSOR_DISPOSE, STUDIO_COMPRESSOR_PROCESSOR, } from '@/lib/studio-fx/compressor-kernel'
import type { FakeDelay, FakeGain, FakeWorkletNode, } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import { createManualScheduler, FakeAudioContext, fakeAudioWorklet, FakeNode, reaches, } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import type { StudioLiteEffect } from '@/lib/studio-fx/fx-profile'
import { prepareZeroLatencyCompressor } from '@/lib/studio-fx/zero-latency-compressor'
import { autoPlaybackTier, resetPlaybackQualityForTests, subscribePlaybackQuality, TIER_PROFILES, } from '../playback/playback-quality'
import { MEDIUM_SONG, MONITOR_EDGE_US, MONITOR_LOOP_US, roleSong, SMALL_SONG, } from '../playback/song.test-fixtures'
import { studioSongChains } from '../playback/song-load'
import type { StudioMonitorSound } from './input-monitor'
import { createStudioInputMonitor } from './input-monitor'
import { createStudioMonitorMaster } from './monitor-master'

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

/** How long the input sounds before a path rises on it, in ms. */
const SETTLE_MS = 250
/** How long a rise waits for the input's first sound, in ms. */
const ARRIVAL_WAIT_MS = 1000

/** The master, with no effects so that only the path is under test; `inputs` holds where each path joined it. */
function emptyMaster() {
  const master = createStudioMonitorMaster(EMPTY_CHAIN)
  const inputs: FakeNode[] = []
  return {
    inputs,
    join(context: BaseAudioContext) {
      const joined = master.join(context)
      inputs.push(joined.node as unknown as FakeNode)
      return joined
    },
  }
}

/** A monitor on a graph of fakes, its input `arrived`: sounding and settled, as a microphone is a moment into an arm. */
function setup({ arrived = true, settled = false } = {}) {
  const ctx = new FakeAudioContext()
  // Stands for the microphone's source node, which the arm owns.
  const input = new FakeNode('source')
  const scheduler = createManualScheduler()
  const master = emptyMaster()
  const monitor = createStudioInputMonitor(
    ctx.asContext,
    input as unknown as AudioNode,
    { master, schedule: scheduler.schedule, settled },
  )
  if (arrived && !settled) {
    monitor.inputArrived()
    scheduler.advance(SETTLE_MS)
  }
  return { ctx, input, scheduler, monitor, master }
}

/** The path's level: the gain after its faders' merger. */
function levels(ctx: FakeAudioContext): FakeGain[] {
  return ctx
    .ofType<FakeNode>('merger')
    .flatMap((merger) => merger.targets as FakeGain[])
}

/** How many times `level` was sent toward a level: each rise or release is one. */
const rises = (level: FakeGain) =>
  level.gain.events.filter(({ kind }) => kind === 'target').length

/** What feeds the speakers. */
function feedingDestination(ctx: FakeAudioContext): FakeNode[] {
  return ctx.created.filter((node) => node.targets.includes(ctx.destination))
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

  it('reaches the speakers only through the master: its level feeds the master, and the master alone feeds the destination', () => {
    const { ctx, input, monitor, master } = setup()

    monitor.set(sound())

    expect(master.inputs).toHaveLength(1)
    const [level] = levels(ctx)
    expect(level.targets).toEqual(master.inputs)
    const [speakers] = feedingDestination(ctx)
    expect(feedingDestination(ctx)).toHaveLength(1)
    expect(reaches(master.inputs[0], speakers)).toBe(true)
    expect(reaches(input, speakers)).toBe(true)
    expect(reaches(level, ctx.destination)).toBe(true)
  })

  it('takes the master apart with its path, and joins a fresh one when heard again', () => {
    const { ctx, scheduler, monitor, master } = setup()
    monitor.set(sound())

    monitor.set(sound({ on: false }))
    scheduler.advance(RELEASED_MS)

    expect(feedingDestination(ctx)).toEqual([])
    expect(stillWired(ctx)).toEqual([])
    monitor.set(sound())
    expect(master.inputs).toHaveLength(2)
    expect(master.inputs[1]).not.toBe(master.inputs[0])
    expect(feedingDestination(ctx)).toHaveLength(1)
  })

  it('runs the chain at the monitor profile, so no DynamicsCompressorNode delays it', () => {
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

describe("the input monitor before its input's first sound", () => {
  it('holds a heard path silent until its input has sounded a quarter of a second, then rises from silence on the house time constant', () => {
    const { ctx, scheduler, monitor } = setup({ arrived: false })

    monitor.set(sound())

    const [level] = levels(ctx)
    expect(level.gain.value).toBe(0)
    expect(level.gain.lastWrite).toBeUndefined()
    monitor.inputArrived()
    scheduler.advance(SETTLE_MS - 1)
    expect(level.gain.lastWrite).toBeUndefined()
    scheduler.advance(1)
    expect(level.gain.lastWrite).toMatchObject({
      kind: 'target',
      value: 1,
      timeConstant: 0.036,
    })
  })

  it('rises after a second without a sound anyway, as for a muted microphone, and only once', () => {
    const { ctx, scheduler, monitor } = setup({ arrived: false })
    monitor.set(sound())
    const [level] = levels(ctx)

    scheduler.advance(ARRIVAL_WAIT_MS - 1)
    expect(level.gain.lastWrite).toBeUndefined()
    scheduler.advance(1)
    expect(level.gain.lastWrite).toMatchObject({ kind: 'target', value: 1 })
    const written = level.gain.events.length
    monitor.inputArrived()
    scheduler.advance(SETTLE_MS)
    expect(level.gain.events).toHaveLength(written)
  })

  it('lets a sound that comes late in the wait settle all the same, rather than rise on it at the second', () => {
    const { ctx, scheduler, monitor } = setup({ arrived: false })
    monitor.set(sound())
    const [level] = levels(ctx)
    scheduler.advance(ARRIVAL_WAIT_MS - 100)

    monitor.inputArrived()

    scheduler.advance(SETTLE_MS - 1)
    expect(level.gain.lastWrite).toBeUndefined()
    scheduler.advance(1)
    expect(level.gain.lastWrite).toMatchObject({ kind: 'target', value: 1 })
  })

  it('rises at once on an input that settled before monitoring was turned on, and waits no longer', () => {
    const { ctx, scheduler, monitor } = setup({ arrived: false })
    monitor.set(sound({ on: false }))
    monitor.inputArrived()
    scheduler.advance(SETTLE_MS)
    expect(scheduler.pendingCount).toBe(0)

    monitor.set(sound())

    expect(levels(ctx)[0].gain.lastWrite).toMatchObject({
      kind: 'target',
      value: 1,
    })
  })

  it('rises at once from silence on the house time constant when its source settles under another lane, its own settle over', () => {
    const { ctx, scheduler, monitor } = setup({ arrived: false })
    monitor.set(sound())
    const [level] = levels(ctx)
    monitor.inputArrived()
    scheduler.advance(100)

    monitor.inputSettled()

    expect(rises(level)).toBe(1)
    expect(level.gain.lastWrite).toMatchObject({
      kind: 'target',
      value: 1,
      timeConstant: 0.036,
    })
    expect(scheduler.pendingCount).toBe(0)
    scheduler.advance(ARRIVAL_WAIT_MS)
    expect(rises(level)).toBe(1)
  })

  it('stays silent when its source settles after it was disposed', () => {
    const { ctx, scheduler, monitor } = setup({ arrived: false })
    monitor.set(sound())
    const [level] = levels(ctx)
    monitor.inputArrived()
    monitor.dispose()

    monitor.inputSettled()
    scheduler.advance(ARRIVAL_WAIT_MS)

    expect(level.gain.events).toEqual([])
  })

  it('rises at once on an input that plays cleanly from its first sample, an instrument, and waits for nothing', () => {
    const { ctx, scheduler, monitor } = setup({ settled: true })

    monitor.set(sound())

    expect(levels(ctx)[0].gain.lastWrite).toMatchObject({
      kind: 'target',
      value: 1,
      timeConstant: 0.036,
    })
    expect(scheduler.pendingCount).toBe(0)
  })

  it('comes apart and lets its input go at once when disposed before it rose, silent as it was, and never rises', () => {
    const { ctx, input, scheduler, monitor } = setup({ arrived: false })
    monitor.set(sound())
    const [level] = levels(ctx)
    monitor.inputArrived()
    const silent = vi.fn()

    monitor.dispose(silent)

    expect(silent).toHaveBeenCalledOnce()
    expect(input.targets).toEqual([])
    expect(stillWired(ctx)).toEqual([])
    expect(scheduler.pendingCount).toBe(0)
    monitor.inputArrived()
    scheduler.advance(ARRIVAL_WAIT_MS)
    expect(level.gain.events).toEqual([])
  })

  it('takes a path released before it rose apart at once, and builds a fresh one when heard again', () => {
    const { ctx, input, monitor } = setup({ arrived: false })
    monitor.set(sound())

    monitor.set(sound({ on: false }))

    expect(stillWired(ctx)).toEqual([])
    expect(input.targets).toEqual([])
    monitor.set(sound())
    expect(levels(ctx)).toHaveLength(1)
    expect(reaches(input, ctx.destination)).toBe(true)
  })

  it('keeps its input through the release once its path has begun to rise, however little', () => {
    const { ctx, input, scheduler, monitor } = setup({ arrived: false })
    monitor.set(sound())
    monitor.inputArrived()
    scheduler.advance(SETTLE_MS)
    const silent = vi.fn()

    // The rise began this instant: the level is on its way up.
    monitor.dispose(silent)

    expect(levels(ctx)[0].gain.lastWrite).toMatchObject({ value: 0 })
    scheduler.advance(RELEASED_MS - 1)
    expect(silent).not.toHaveBeenCalled()
    expect(input.targets).toHaveLength(1)
    scheduler.advance(1)
    expect(silent).toHaveBeenCalledOnce()
    expect(input.targets).toEqual([])
  })
})

describe("the input monitor at live playback's tier", () => {
  afterEach(() => vi.unstubAllGlobals())

  /** A lane with a de-esser and a dynamic EQ band and nothing else. */
  const BANDS = normalizeChainSpec({
    effects: [
      { kind: 'deesser', params: {}, enabled: true },
      { kind: 'dyneq', params: {}, enabled: true },
    ],
  })
  /** What Light playback keeps only the lookahead of (playback-quality.ts). */
  const LIGHT: readonly StudioLiteEffect[] = ['dyneq', 'deesser']
  /** The chain's duck before a re-patch, in ms (chain.ts). */
  const DUCK_MS = 40

  /** A heard monitor whose context has the compressor worklet loaded, as an armed lane's has. */
  async function loaded() {
    const heard = setup()
    fakeAudioWorklet(heard.ctx, {
      [STUDIO_COMPRESSOR_PROCESSOR]: COMPRESSOR_PARAMETERS,
    })
    await prepareZeroLatencyCompressor(heard.ctx.asContext)
    return heard
  }

  /** The nodes the input passes through on its way to the master. */
  function onPath(
    ctx: FakeAudioContext,
    input: FakeNode,
    master: FakeNode,
  ): FakeNode[] {
    return ctx.created.filter(
      (node) => reaches(input, node) && reaches(node, master),
    )
  }

  /** The band worklets the input passes through. */
  const heardWorklets = (
    ctx: FakeAudioContext,
    input: FakeNode,
    master: FakeNode,
  ) => onPath(ctx, input, master).filter((node) => node.nodeType === 'worklet')

  it('builds a lane on Light with no band worklet and no band: its de-esser and dynamic EQ pass the input bit for bit, as Light playback passes them uncut', async () => {
    const { ctx, input, monitor, master } = await loaded()

    monitor.set(sound({ spec: BANDS, gains: [1, 1], lite: LIGHT }))

    expect(ctx.ofType('worklet')).toEqual([])
    expect(ctx.ofType('biquad')).toEqual([])
    const path = onPath(ctx, input, master.inputs[0])
    expect(path.length).toBeGreaterThan(0)
    // Gains at exactly 1, a zero delay (the chain's hold), and the split
    // and merge any lane has: each passes what it is given unchanged.
    for (const node of path) {
      if (node.nodeType === 'gain')
        expect((node as FakeGain).gain.destination).toBe(1)
      else if (node.nodeType === 'delay')
        expect((node as FakeDelay).delayTime.value).toBe(0)
      else expect(['splitter', 'merger']).toContain(node.nodeType)
    }
  })

  it('plays the bands again when the tier goes back to Balanced: the same path swaps them in once its chain has ducked, and opens again', async () => {
    const { ctx, input, scheduler, monitor, master } = await loaded()
    monitor.set(sound({ spec: BANDS, lite: LIGHT }))
    const [level] = levels(ctx)

    monitor.set(sound({ spec: BANDS }))

    const ducking = onPath(ctx, input, master.inputs[0]).filter(
      (node): node is FakeGain =>
        node.nodeType === 'gain' && (node as FakeGain).gain.destination === 0,
    )
    expect(ducking).toHaveLength(1)
    expect(heardWorklets(ctx, input, master.inputs[0])).toEqual([])
    scheduler.advance(DUCK_MS)
    expect(heardWorklets(ctx, input, master.inputs[0])).toHaveLength(2)
    expect(ducking[0].gain.destination).toBe(1)
    // Swapped in place: one path, one level, one join of the master.
    expect(levels(ctx)).toEqual([level])
    expect(master.inputs).toHaveLength(1)
  })

  it('takes the bands out when the tier goes to Light while the lane is heard: under the duck, their worklets let go after', async () => {
    const { ctx, input, scheduler, monitor, master } = await loaded()
    monitor.set(sound({ spec: BANDS }))
    const playing = heardWorklets(ctx, input, master.inputs[0])
    expect(playing).toHaveLength(2)

    monitor.set(sound({ spec: BANDS, lite: LIGHT }))
    expect(heardWorklets(ctx, input, master.inputs[0])).toEqual(playing)
    scheduler.advance(DUCK_MS)

    expect(heardWorklets(ctx, input, master.inputs[0])).toEqual([])
    for (const worklet of playing as FakeWorkletNode[])
      expect(worklet.posted).toEqual([STUDIO_COMPRESSOR_DISPOSE])
    // The same tier again changes nothing.
    monitor.set(sound({ spec: BANDS, lite: LIGHT }))
    expect(scheduler.pendingCount).toBe(0)
  })
})

describe("the input monitor in Auto's pick of live playback's tier", () => {
  /** The 12-lane song, and the lead vocal a singer records over it. */
  const SONG = roleSong(MEDIUM_SONG)
  const VOICE = studioSongChains(roleSong(['voice']))[0]

  /** On a device where the song alone fits Best and with the vocal monitored only Balanced. */
  function onTheEdge() {
    resetPlaybackQualityForTests({
      cores: 24,
      memoryGb: 8,
      voiceChainUs: MONITOR_EDGE_US,
    })
    return setup()
  }

  afterEach(() => resetPlaybackQualityForTests())

  it('counts its lane from when its path is built, as its chain changes, until the path has come apart', () => {
    const { monitor, scheduler } = onTheEdge()
    expect(autoPlaybackTier(SONG)).toBe('best')

    monitor.set(sound({ spec: VOICE }))
    expect(autoPlaybackTier(SONG)).toBe('balanced')
    // The lane's chain lightened: it fits beside the song.
    monitor.set(sound({ spec: LANE_CHAIN }))
    expect(autoPlaybackTier(SONG)).toBe('best')
    monitor.set(sound({ spec: VOICE }))
    // Released, the path plays on until it comes apart.
    monitor.set(sound({ on: false, spec: VOICE }))
    scheduler.advance(RELEASED_MS - 1)
    expect(autoPlaybackTier(SONG)).toBe('balanced')
    scheduler.advance(1)
    expect(autoPlaybackTier(SONG)).toBe('best')
  })

  it('counts nothing for a lane not heard, and stops counting at once a path that never rose', () => {
    const { monitor } = onTheEdge()
    monitor.set(sound({ spec: VOICE, gains: [0, 0] }))
    expect(autoPlaybackTier(SONG)).toBe('best')

    const waiting = setup({ arrived: false })
    waiting.monitor.set(sound({ spec: VOICE }))
    expect(autoPlaybackTier(SONG)).toBe('balanced')
    waiting.monitor.dispose()
    expect(autoPlaybackTier(SONG)).toBe('best')
  })

  it("tells Auto's listeners once its own change is done, and only when what Auto weighs has changed", async () => {
    const { monitor, scheduler } = onTheEdge()
    const told = vi.fn()
    subscribePlaybackQuality(told)

    monitor.set(sound({ spec: VOICE }))
    // Not inside the monitor's own set: a listener may set it again.
    expect(told).not.toHaveBeenCalled()
    await Promise.resolve()
    expect(told).toHaveBeenCalledOnce()
    // A new volume or a new tier's lite list leaves Auto as it was.
    monitor.set(sound({ spec: VOICE, gains: [1, 1] }))
    monitor.set(sound({ spec: VOICE, lite: TIER_PROFILES.light.lite }))
    await Promise.resolve()
    expect(told).toHaveBeenCalledOnce()
    monitor.dispose()
    scheduler.advance(RELEASED_MS)
    await Promise.resolve()
    expect(told).toHaveBeenCalledTimes(2)
  })

  it("counts its lane as each tier's monitor would play it, so following the tier Auto picks does not move Auto again", () => {
    // Two vocals over the 4-lane song, on a device where they fit Balanced
    // only with their dynamic EQ bands passed uncut, as on Light.
    resetPlaybackQualityForTests({
      cores: 24,
      memoryGb: 8,
      voiceChainUs: MONITOR_LOOP_US,
    })
    const song = roleSong(SMALL_SONG)
    const monitors = [setup().monitor, setup().monitor]
    for (const monitor of monitors) monitor.set(sound({ spec: VOICE }))
    expect(autoPlaybackTier(song)).toBe('light')

    // The monitors follow the tier picked: their bands become wires.
    for (const monitor of monitors)
      monitor.set(sound({ spec: VOICE, lite: TIER_PROFILES.light.lite }))
    expect(autoPlaybackTier(song)).toBe('light')
  })
})
