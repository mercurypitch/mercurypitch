// Record in the Studio, a lane's own input — an arm opens the lane's input and channel as the browser lists it, else the Studio's and says so, and lines its takes up by that input's round trip; an armed lane re-arms on a new input while the arm moves freely only between lanes on the same one, and a lane's input is kept on this device until its lane is gone.
import { createRoot, createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FakeMediaDevices } from '@/lib/audio-input/fake-devices.fixture'
import { audioInput, fakeMediaDevices, } from '@/lib/audio-input/fake-devices.fixture'
import type { StudioProject } from '@/lib/studio/model/types'
import type { StudioInputOpened, StudioRecorderView, } from '@/lib/studio/record/studio-recorder'

const mocks = vi.hoisted(() => ({
  recorder: null as null | Record<string, ReturnType<typeof vi.fn>>,
  onChange: null as null | ((view: StudioRecorderView) => void),
  acquireMic: null as
    | null
    | ((
        trackId: string | null,
      ) => Promise<{ stream: MediaStream; channel?: number | null }>),
  inputOpened: null as null | ((opened: StudioInputOpened) => void),
  roundTrip: null as
    | null
    | ((context: AudioContext, stream: MediaStream) => number),
  acquireFrom: vi.fn(),
  journal: {
    writer: vi.fn(),
    list: vi.fn(async () => []),
    read: vi.fn(),
    discard: vi.fn(async () => undefined),
  },
}))

vi.mock('@/lib/studio/record/studio-recorder', () => ({
  createStudioRecorder: (deps: {
    onChange: (view: StudioRecorderView) => void
    acquireMic: (
      trackId: string | null,
    ) => Promise<{ stream: MediaStream; channel?: number | null }>
    inputOpened: (opened: StudioInputOpened) => void
    roundTrip: (context: AudioContext, stream: MediaStream) => number
  }) => {
    mocks.onChange = deps.onChange
    mocks.acquireMic = deps.acquireMic
    mocks.inputOpened = deps.inputOpened
    mocks.roundTrip = deps.roundTrip
    mocks.recorder = {
      arm: vi.fn(async (trackId: string | null) => {
        mocks.onChange!(view({ phase: 'armed', targetTrackId: trackId }))
        return true
      }),
      record: vi.fn(),
      stop: vi.fn(),
      disarm: vi.fn(() => mocks.onChange!(view({ phase: 'idle' }))),
      retarget: vi.fn(),
      updateMonitor: vi.fn(),
      micLost: vi.fn(),
      clockStopped: vi.fn(),
      clearMessages: vi.fn(),
      dispose: vi.fn(),
    }
    return mocks.recorder
  },
}))
vi.mock('@/db/services/studio-take-journal', () => ({
  createStudioTakeJournal: () => mocks.journal,
}))
vi.mock('@/lib/mic-manager', () => ({
  micManager: {
    acquireFrom: mocks.acquireFrom,
    getResolvedDevice: () => 'app-in',
    getPreferredDevice: () => 'app-in',
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
const { setMicLatencyByDevice } = await import('@/stores/mic-latency-store')
const { setMicLatencyPathByKey } =
  await import('@/stores/mic-latency-path-store')

function view(patch: Partial<StudioRecorderView>): StudioRecorderView {
  return {
    phase: 'idle',
    level: 0,
    countBeat: null,
    error: null,
    notice: null,
    targetTrackId: null,
    live: null,
    ...patch,
  }
}

const song = {
  id: 'song-1',
  tempoBpm: 120,
  tracks: [
    { id: 'lane-1', name: 'Guitar', order: 0 },
    { id: 'lane-2', name: 'Voice', order: 1 },
    { id: 'lane-3', name: 'Keys', order: 2 },
  ],
  clips: [],
} as unknown as StudioProject

const scarlett = {
  deviceId: 'scarlett',
  label: 'Scarlett 2i2 USB',
  channel: 1,
}

let devices: FakeMediaDevices | null = null
const disposers: (() => void)[] = []

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose()
  devices?.restore()
  devices = null
  localStorage.clear()
  vi.clearAllMocks()
})

/** The hook on `project`, with the browser listing `listed`; resolves once the Studio holds that list. */
async function mount(
  listed: MediaDeviceInfo[] = [],
  project: StudioProject = song,
) {
  devices = fakeMediaDevices(listed)
  const [current] = createSignal(project)
  let hook!: ReturnType<typeof useStudioRecorder>
  const dispose = createRoot((done) => {
    hook = useStudioRecorder({
      project: current,
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
      selectedTrackId: () => 'lane-1',
      audioBusy: () => false,
    })
    return done
  })
  disposers.push(dispose)
  await vi.waitFor(() => expect(hook.inputs()).toHaveLength(listed.length))
  return hook
}

/** MicManager's hold on whatever was asked for. */
function held(missing = false) {
  return { stream: {} as MediaStream, missing, release: vi.fn() }
}

/** A stream whose track says it opened `deviceId`, named `label`. */
function openedStream(deviceId: string, label: string): MediaStream {
  const track = { label, getSettings: () => ({ deviceId }) }
  return { getAudioTracks: () => [track] } as unknown as MediaStream
}

const desk = audioInput('desk', 'Desk mic')
const interfaceIn = audioInput('scarlett', 'Scarlett 2i2 USB')

describe("a lane's own input", () => {
  it('arms the lane on its own input as the browser lists it, and takes its channel', async () => {
    const hook = await mount([desk, interfaceIn])
    hook.laneInputs.choose('lane-1', scarlett)
    mocks.acquireFrom.mockResolvedValueOnce(held())

    const hold = await mocks.acquireMic!('lane-1')

    expect(mocks.acquireFrom).toHaveBeenCalledWith('studio-record', 'scarlett')
    expect(hold.channel).toBe(1)
    expect(hook.armedInput()).toEqual({
      laneMissing: null,
      defaultInstead: null,
      channelMissing: null,
    })
  })

  it("arms on the Studio's input, all of it, when the lane's own is not connected, and says so", async () => {
    const hook = await mount([desk])
    hook.chooseInput('desk', 'Desk mic')
    hook.laneInputs.choose('lane-1', scarlett)
    mocks.acquireFrom.mockResolvedValueOnce(held())

    const hold = await mocks.acquireMic!('lane-1')

    expect(mocks.acquireFrom).toHaveBeenCalledWith('studio-record', 'desk')
    expect(hold.channel).toBeNull()
    expect(hook.armedInput().laneMissing).toBe('Scarlett 2i2 USB')
    // The Studio's own input was there: the Sound panel has nothing to say.
    expect(hook.inputMissing()).toBe(false)
  })

  it("says which input was gone as it opened, the lane's own, and records all of the default in its place", async () => {
    const hook = await mount([desk, interfaceIn])
    hook.laneInputs.choose('lane-1', scarlett)
    mocks.acquireFrom.mockResolvedValueOnce(held(true))

    const hold = await mocks.acquireMic!('lane-1')

    expect(hook.armedInput().defaultInstead).toBe('Scarlett 2i2 USB')
    // A channel is a jack of the input it was chosen on, not of the default.
    expect(hold.channel).toBeNull()
    expect(hook.inputMissing()).toBe(false)
  })

  it("takes off the round trip measured on the lane's own input, even when its track names none", async () => {
    const hook = await mount([desk, interfaceIn])
    hook.chooseInput('desk', 'Desk mic')
    hook.laneInputs.choose('lane-1', scarlett)
    // 40 ms on the Studio's input, on a 30 ms output path; 120 ms on the
    // interface, on a 50 ms one. The Studio's clock buffers 80 ms.
    setMicLatencyByDevice({ desk: 40, scarlett: 120 })
    setMicLatencyPathByKey({ desk: 30, scarlett: 50 })
    mocks.acquireFrom.mockResolvedValueOnce(held())
    await mocks.acquireMic!('lane-1')
    const unnamed = {
      getAudioTracks: () => [{ getSettings: () => ({}) }],
    } as unknown as MediaStream

    const seconds = mocks.roundTrip!(
      { baseLatency: 0.02, outputLatency: 0.06 } as unknown as AudioContext,
      unnamed,
    )

    // 120 ms, and the 30 ms more the Studio's clock buffers than the one measured on.
    expect(seconds).toBeCloseTo(0.15, 6)
    expect(hook.roundTrip()).toMatchObject({ source: 'measured' })
    setMicLatencyByDevice({})
    setMicLatencyPathByKey({})
  })

  it('says the channel was not on the input, and keeps how many channels it has for the picker', async () => {
    const hook = await mount([desk, interfaceIn])
    hook.laneInputs.choose('lane-1', { ...scarlett, channel: 3 })
    expect(hook.laneInputs.channels('lane-1')).toBeNull()

    mocks.inputOpened!({
      stream: openedStream('scarlett', 'Scarlett 2i2 USB'),
      channels: 2,
      channel: null,
      missingChannel: 3,
    })

    expect(hook.armedInput().channelMissing).toBe(3)
    expect(hook.laneInputs.channels('lane-1')).toBe(2)
  })

  it('re-arms the armed lane when its input changes, and leaves the arm alone for another lane', async () => {
    const hook = await mount([desk, interfaceIn])
    mocks.onChange!(view({ phase: 'armed', targetTrackId: 'lane-1' }))

    hook.laneInputs.choose('lane-2', scarlett)
    expect(mocks.recorder!.disarm).not.toHaveBeenCalled()

    hook.laneInputs.choose('lane-1', scarlett)
    expect(mocks.recorder!.disarm).toHaveBeenCalledOnce()
    expect(mocks.recorder!.arm).toHaveBeenLastCalledWith('lane-1')
  })

  it('moves the arm with the microphone open only to a lane on the same input and channel', async () => {
    const hook = await mount([desk, interfaceIn])
    hook.laneInputs.choose('lane-3', scarlett)
    mocks.onChange!(view({ phase: 'armed', targetTrackId: 'lane-1' }))

    hook.arming.toggle('lane-2')
    expect(mocks.recorder!.retarget).toHaveBeenCalledExactlyOnceWith('lane-2')
    expect(mocks.recorder!.disarm).not.toHaveBeenCalled()

    mocks.onChange!(view({ phase: 'armed', targetTrackId: 'lane-2' }))
    hook.arming.toggle('lane-3')
    expect(mocks.recorder!.retarget).toHaveBeenCalledOnce()
    expect(mocks.recorder!.disarm).toHaveBeenCalledOnce()
    expect(mocks.recorder!.arm).toHaveBeenLastCalledWith('lane-3')
  })

  it("will not change a lane's input while a take runs", async () => {
    const hook = await mount([desk, interfaceIn])
    mocks.onChange!(view({ phase: 'recording', targetTrackId: 'lane-1' }))

    hook.laneInputs.choose('lane-1', scarlett)

    expect(hook.laneInputs.of('lane-1').deviceId).toBeNull()
  })

  it('keeps a lane its input on this device, and forgets a lane that is gone when the song opens again', async () => {
    const first = await mount([desk, interfaceIn])
    first.laneInputs.choose('lane-1', scarlett)
    first.laneInputs.choose('lane-3', { ...scarlett, channel: 0 })
    for (const dispose of disposers.splice(0)) dispose()
    devices?.restore()

    const withoutKeys = {
      ...song,
      tracks: song.tracks.filter((track) => track.id !== 'lane-3'),
    } as StudioProject
    const again = await mount([desk, interfaceIn], withoutKeys)

    expect(again.laneInputs.of('lane-1')).toEqual(scarlett)
    expect(again.laneInputs.of('lane-3').deviceId).toBeNull()
    expect(
      localStorage.getItem('mercurypitch.studio.lane-inputs'),
    ).not.toContain('lane-3')
  })

  it("names the Studio's input for a lane that follows it", async () => {
    const hook = await mount([desk, interfaceIn])
    expect(hook.laneInputs.studioInputName()).toBe('Default input')

    hook.chooseInput('desk', 'Desk mic')

    expect(hook.laneInputs.studioInputName()).toBe('Desk mic')
  })
})
