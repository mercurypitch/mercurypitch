// Studio recorder master tests — every armed lane's monitor plays through one master: playback's, at the master gain the transport says the listener hears, gliding to a new one, and with its effects off while Compare plays its Before side, which has no master.
import { createRoot, createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StudioMasterGain } from '@/lib/studio/export/sound-graph'
import { createStudioProject, createStudioTrack, } from '@/lib/studio/model/defaults'
import type { StudioProject } from '@/lib/studio/model/types'
import type { StudioRecorderDeps, StudioRecorderView, } from '@/lib/studio/record/studio-recorder'
import { EMPTY_CHAIN } from '@/lib/studio-fx/chain-spec'
import { dbToGain } from '@/lib/studio-fx/dsp'
import type { FakeGain } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import { FakeAudioContext, FakeNode, reaches, } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'

const mocks = vi.hoisted(() => ({
  deps: null as null | Pick<StudioRecorderDeps, 'createMonitor' | 'onChange'>,
}))

vi.mock('@/lib/studio/record/studio-recorder', () => ({
  createStudioRecorder: (deps: NonNullable<typeof mocks.deps>) => {
    mocks.deps = deps
    return {
      arm: vi.fn(async () => true),
      record: vi.fn(),
      stop: vi.fn(),
      disarm: vi.fn(),
      updateMonitor: vi.fn(),
      micLost: vi.fn(),
      inputLost: vi.fn(),
      clockStopped: vi.fn(),
      clearMessages: vi.fn(),
      inputTap: vi.fn(() => null),
      dispose: vi.fn(),
    }
  },
}))
vi.mock('@/db/services/studio-take-journal', () => ({
  createStudioTakeJournal: () => ({
    writer: vi.fn(),
    list: vi.fn(async () => []),
    read: vi.fn(),
    discard: vi.fn(async () => undefined),
  }),
}))
vi.mock('@/lib/mic-manager', () => ({
  micManager: {
    acquireFrom: vi.fn(),
    getResolvedDevice: () => 'default',
    getPreferredDevice: () => 'default',
    subscribe: () => () => undefined,
    registerRunGuard: () => () => undefined,
  },
}))
vi.mock('@/lib/mic-sentinel', () => ({
  registerMicIndicator: () => () => undefined,
}))
vi.mock('@/lib/local-save-navigation-reason', () => ({
  useLocalSaveNavigationLockWithReason: () => undefined,
}))

const { useStudioRecorder } = await import('./useStudioRecorder')

const song: StudioProject = {
  ...createStudioProject({
    id: 'song-1',
    title: 'Song',
    now: '2026-11-16T12:00:00.000Z',
  }),
  tracks: [
    createStudioTrack({ id: 'voice', name: 'Voice', order: 0, role: 'voice' }),
  ],
}

/** A lane heard through no effects of its own, at unity: what reaches the master is the input. */
const HEARD = { on: true, spec: EMPTY_CHAIN, gains: [1, 1] as const }

const disposers: (() => void)[] = []
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose()
  mocks.deps = null
})

/** The voice lane armed, as the recorder tells the hook. */
const ARMED: StudioRecorderView = {
  phase: 'armed',
  level: 0,
  countBeat: null,
  error: null,
  notice: null,
  targetTrackId: 'voice',
  live: null,
  lanes: [
    {
      trackId: 'voice',
      arming: false,
      level: 0,
      live: null,
      microphone: true,
    },
  ],
}

/** The hook with the master gain the transport says is heard, and whether Compare plays its Before side; the voice lane armed with monitoring on. */
function mount() {
  const [gain, setGain] = createSignal<StudioMasterGain>({
    gainDb: 6,
    safetyGainDb: 0,
  })
  const [before, setBefore] = createSignal(false)
  let hook!: ReturnType<typeof useStudioRecorder>
  disposers.push(
    createRoot((done) => {
      hook = useStudioRecorder({
        project: () => song,
        assets: () => [],
        canEdit: () => true,
        addRecording: vi.fn(async () => true),
        transport: {
          playing: () => false,
          frameNow: () => 0,
          play: vi.fn(),
          pause: vi.fn(),
          anchor: () => null,
          clock: () => null,
          unlock: () => Promise.resolve(false),
          repeating: () => false,
          range: () => null,
          setRepeat: vi.fn(async () => undefined),
        } as never,
        selectedTrackId: () => 'voice',
        audioBusy: () => false,
        masterGain: gain,
        masterBypassed: before,
      })
      return done
    }),
  )
  hook.setSettings({ ...hook.settings(), monitor: true })
  mocks.deps!.onChange(ARMED)
  const ctx = new FakeAudioContext()
  /** A lane's monitor as its arm makes one, heard at once. */
  const heardLane = () => {
    const input = new FakeNode('input')
    const monitor = mocks.deps!.createMonitor(
      ctx.asContext as AudioContext,
      input as unknown as AudioNode,
      { settled: true },
    )
    monitor.set(HEARD)
    return input
  }
  return { ctx, heardLane, setGain, setBefore }
}

/** The gains whose value is `value` exactly: how the master's loudness trim is found among its gains. */
function gainsAt(ctx: FakeAudioContext, value: number): FakeGain[] {
  return ctx
    .ofType<FakeGain>('gain')
    .filter((gain) => gain.gain.value === value)
}

describe("the recorder's monitor master", () => {
  it('plays every armed lane through one master, at the gain the listener hears', () => {
    const { ctx, heardLane } = mount()

    const voice = heardLane()
    const second = heardLane()

    const speakers = ctx.created.filter((node) =>
      node.targets.includes(ctx.destination),
    )
    expect(speakers).toHaveLength(1)
    expect(reaches(voice, speakers[0])).toBe(true)
    expect(reaches(second, speakers[0])).toBe(true)
    expect(gainsAt(ctx, dbToGain(6))).toHaveLength(1)
    expect(ctx.ofType('compressor')).toEqual([])
  })

  it('glides the master to a new gain the moment the listener hears one', () => {
    const { ctx, heardLane, setGain } = mount()
    heardLane()
    const [trim] = gainsAt(ctx, dbToGain(6))

    setGain({ gainDb: -4, safetyGainDb: 0 })

    expect(trim.gain.lastWrite).toEqual({
      kind: 'target',
      time: 0,
      value: dbToGain(-4),
      timeConstant: 0.02,
    })
  })

  it("takes the master's effects out but its loudness gain, which plays the gain it is handed, while Compare plays its Before side, and brings them back after", () => {
    const { ctx, heardLane, setBefore, setGain } = mount()
    heardLane()
    const [trim] = gainsAt(ctx, dbToGain(6))
    // The loudness gain's processed side, and its side that passes the input as it is.
    const [wet] = trim.targets as FakeGain[]
    const dry = ctx
      .ofType<FakeGain>('gain')
      .find(
        (gain) =>
          gain !== wet &&
          wet.targets.every((node) => gain.targets.includes(node)) &&
          gain.gain.value === 0,
      )!

    const goingOut = () =>
      ctx
        .ofType<FakeGain>('gain')
        .filter(
          (gain) =>
            gain.gain.lastWrite?.kind === 'target' &&
            gain.gain.lastWrite.value === 0,
        )
    const outBefore = goingOut()

    setBefore(true)
    setGain({ gainDb: -3, safetyGainDb: 0 })

    // The master's other effects glide out; its loudness gain stays in and
    // glides to the gain Before plays at.
    const out = goingOut().filter((gain) => !outBefore.includes(gain))
    expect(out.length).toBeGreaterThan(0)
    expect(out).not.toContain(wet)
    expect(wet.gain.lastWrite).not.toMatchObject({ kind: 'target', value: 0 })
    expect(dry.gain.lastWrite).not.toMatchObject({ kind: 'target', value: 1 })
    expect(trim.gain.lastWrite).toMatchObject({
      kind: 'target',
      value: dbToGain(-3),
    })
    setBefore(false)
    for (const gain of out)
      expect(gain.gain.lastWrite).toMatchObject({ kind: 'target', value: 1 })
  })
})
