// Studio recorder MIDI tests — a MIDI lane arms on its port and never asks for a microphone; its player hears it whatever the monitoring switch says; its take is moved by the output path alone, not a microphone's measured round trip or the line-up; the mic icon stays off while it is armed; a kept take goes into the song with the notes played into it, in ticks at the song's tempo, and with an empty sequence when none were; a lane armed on a microphone after its MIDI arm keeps none; and a port that is gone refuses the arm in its own name.
import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FakeMediaDevices } from '@/lib/audio-input/fake-devices.fixture'
import { fakeMediaDevices } from '@/lib/audio-input/fake-devices.fixture'
import type { StudioProject } from '@/lib/studio/model/types'
import type { StudioMonitorLevel } from '@/lib/studio/record/input-monitor'
import type { StudioCapturedTake, StudioInstrumentHold, StudioRecorderView, } from '@/lib/studio/record/studio-recorder'
import type { StudioRecordingImport } from '../controller/imports'
import type { FakeMidiInput } from './midi/fake-midi.fixture'
import { fakeMidiAccess, fakeMidiInput } from './midi/fake-midi.fixture'

const mocks = vi.hoisted(() => ({
  deps: null as null | {
    onChange(view: StudioRecorderView): void
    acquireInstrument(
      trackId: string | null,
    ): Promise<StudioInstrumentHold> | null
    monitorLevel(trackId: string | null): StudioMonitorLevel
    roundTrip(context: AudioContext, stream: MediaStream | null): number
    keep(take: StudioCapturedTake): Promise<boolean>
  },
  acquireFrom: vi.fn(),
  indicator: null as null | (() => boolean),
  addRecording: vi.fn<(take: StudioRecordingImport) => Promise<boolean>>(
    async () => true,
  ),
  sounds: {
    attach: vi.fn(() => ({
      node: { name: 'arm node' },
      voice: { start: vi.fn(), stop: vi.fn(), silence: vi.fn() },
      detach: vi.fn(),
    })),
    dispose: vi.fn(),
  },
}))

vi.mock('@/lib/studio/record/studio-recorder', () => ({
  createStudioRecorder: (deps: NonNullable<typeof mocks.deps>) => {
    mocks.deps = deps
    return {
      arm: vi.fn(async () => true),
      record: vi.fn(),
      stop: vi.fn(),
      disarm: vi.fn(),
      retarget: vi.fn(),
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
    acquireFrom: mocks.acquireFrom,
    getResolvedDevice: () => 'default',
    getPreferredDevice: () => 'default',
    subscribe: () => () => undefined,
    registerRunGuard: () => () => undefined,
  },
}))
vi.mock('@/lib/mic-sentinel', () => ({
  registerMicIndicator: (_id: string, on: () => boolean) => {
    mocks.indicator = on
    return () => undefined
  },
}))
vi.mock('@/lib/local-save-navigation-reason', () => ({
  useLocalSaveNavigationLockWithReason: () => undefined,
}))
vi.mock('./midi/studio-midi-sounds', () => ({
  loadStudioMidiModules: async () => ({}),
  createStudioMidiSounds: () => mocks.sounds,
}))

const { useStudioRecorder, describeStudioRecordError } =
  await import('./useStudioRecorder')
const { setMicLatencyByDevice } = await import('@/stores/mic-latency-store')

const song = {
  id: 'song-1',
  tempoBpm: 120,
  tracks: [
    { id: 'lane-1', name: 'Keys', order: 0, role: 'keys' },
    { id: 'lane-2', name: 'Voice', order: 1, role: 'voice' },
  ],
  clips: [],
} as unknown as StudioProject

const KEYS = { kind: 'midi' as const, portId: 'keys', label: 'Keystation 49' }

let devices: FakeMediaDevices | null = null
let keys: FakeMidiInput
const disposers: (() => void)[] = []

beforeEach(() => {
  keys = fakeMidiInput('keys', 'Keystation 49')
  const fake = fakeMidiAccess([keys])
  Object.defineProperty(navigator, 'requestMIDIAccess', {
    configurable: true,
    value: () => Promise.resolve(fake.access),
  })
})

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose()
  devices?.restore()
  devices = null
  Reflect.deleteProperty(navigator, 'requestMIDIAccess')
  localStorage.clear()
  vi.clearAllMocks()
})

function view(patch: Partial<StudioRecorderView>): StudioRecorderView {
  const made: StudioRecorderView = {
    phase: 'idle',
    level: 0,
    countBeat: null,
    error: null,
    notice: null,
    targetTrackId: null,
    live: null,
    ...patch,
  }
  // The recorder lists every armed lane: the one named, unless a case lists more.
  const lanes =
    made.phase === 'idle'
      ? []
      : [
          {
            trackId: made.targetTrackId,
            arming: made.phase === 'arming',
            level: 0,
            live: null,
            microphone: true,
          },
        ]
  return { lanes, ...made }
}

/** A second's take on `trackId` whose first sample, captured at 9.9 s, lands on frame 96000. */
function take(id: string, trackId: string): StudioCapturedTake {
  return {
    id,
    title: 'Take 1',
    trackId,
    sampleRate: 48_000,
    samples: new Float32Array(48_000),
    heardFirst: 96_000,
    fromFrame: null,
    capturedFrom: 9.9,
  }
}

/** The hook on the song, lane-1 on the Keystation; the recorder's dependencies in `mocks.deps`. */
function mount() {
  devices = fakeMediaDevices([])
  const [current] = createSignal(song)
  let hook!: ReturnType<typeof useStudioRecorder>
  const dispose = createRoot((done) => {
    hook = useStudioRecorder({
      project: current,
      assets: () => [],
      canEdit: () => true,
      addRecording: mocks.addRecording,
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
  hook.laneInputs.choose('lane-1', KEYS)
  return { hook, deps: mocks.deps! }
}

describe('the Studio recorder on a MIDI lane', () => {
  it('arms a MIDI lane on its port and never asks for a microphone; any other lane asks for one', async () => {
    // Arrange
    const { deps } = mount()

    // Act
    const hold = await deps.acquireInstrument('lane-1')
    const other = deps.acquireInstrument('lane-2')

    // Assert
    expect(hold?.kind).toBe('instrument')
    expect(other).toBeNull()
    expect(mocks.acquireFrom).not.toHaveBeenCalled()
  })

  it("lets a MIDI lane's player hear it whatever the monitoring switch says", () => {
    // Arrange
    const { hook, deps } = mount()
    hook.setSettings({ ...hook.settings(), monitor: false })

    // Act, Assert
    expect(deps.monitorLevel('lane-1').on).toBe(true)
    expect(deps.monitorLevel('lane-2').on).toBe(false)
  })

  it('moves a MIDI take by the output path alone, not a measured round trip or the line-up', () => {
    // Arrange
    const { hook, deps } = mount()
    setMicLatencyByDevice({ default: 120 })
    hook.setSettings({ ...hook.settings(), offsetMs: 40 })
    const context = {
      baseLatency: 0.01,
      outputLatency: 0.02,
    } as unknown as AudioContext

    // Act
    const shift = deps.roundTrip(context, null)

    // Assert
    expect(shift).toBeCloseTo(0.03, 9)
    setMicLatencyByDevice({})
  })

  it('keeps the mic icon off while only MIDI lanes are armed, and on while any armed lane holds the microphone', async () => {
    // Arrange
    const { deps } = mount()
    const lane = (trackId: string, microphone: boolean) => ({
      trackId,
      arming: false,
      level: 0,
      live: null,
      microphone,
    })

    // Act
    await deps.acquireInstrument('lane-1')
    deps.onChange(
      view({
        phase: 'armed',
        targetTrackId: 'lane-1',
        lanes: [lane('lane-1', false)],
      }),
    )
    const midiArmed = mocks.indicator!()
    deps.onChange(
      view({
        phase: 'armed',
        targetTrackId: 'lane-1',
        lanes: [lane('lane-1', false), lane('lane-2', true)],
      }),
    )
    const bothArmed = mocks.indicator!()

    // Assert
    expect(midiArmed).toBe(false)
    expect(bothArmed).toBe(true)
  })

  it('plays two MIDI lanes on two ports, each a sound of its own, and saves each take with only its own notes', async () => {
    // Arrange
    const pads = fakeMidiInput('pads', 'MPD218')
    const fake = fakeMidiAccess([keys, pads])
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      configurable: true,
      value: () => Promise.resolve(fake.access),
    })
    const { hook, deps } = mount()
    hook.laneInputs.choose('lane-2', {
      kind: 'midi',
      portId: 'pads',
      label: 'MPD218',
    })
    const onKeys = (await deps.acquireInstrument('lane-1'))!
    const onPads = (await deps.acquireInstrument('lane-2'))!
    const clock = { currentTime: 10 }
    onKeys.play(clock as unknown as AudioContext)
    onPads.play(clock as unknown as AudioContext)

    // Act: middle C on the keys, and E on the pads, each half a second.
    keys.send([0x90, 60, 100], performance.now() - 50)
    pads.send([0x90, 64, 90], performance.now() - 50)
    clock.currentTime = 10.5
    keys.send([0x80, 60, 0], performance.now() - 50)
    pads.send([0x80, 64, 0], performance.now() - 50)
    await deps.keep(take('take-keys', 'lane-1'))
    await deps.keep(take('take-pads', 'lane-2'))

    // Assert: velocities as the ports gave them, 100 and 90 of 127.
    expect(mocks.sounds.attach).toHaveBeenCalledTimes(2)
    expect(
      mocks.addRecording.mock.calls.map(([kept]) => [
        kept.assetId,
        kept.midi?.notes,
      ]),
    ).toEqual([
      ['take-keys', [expect.objectContaining({ pitch: 60, velocity: 0.7874 })]],
      ['take-pads', [expect.objectContaining({ pitch: 64, velocity: 0.7087 })]],
    ])
  })

  it('refuses a second lane on a port another lane plays, naming that lane', async () => {
    // Arrange
    const { hook, deps } = mount()
    hook.laneInputs.choose('lane-2', KEYS)
    await deps.acquireInstrument('lane-1')

    // Act
    const error = await deps
      .acquireInstrument('lane-2')!
      .catch((refusal: unknown) => refusal)

    // Assert
    expect(describeStudioRecordError(error)).toBe(
      'Keystation 49 plays Keys already. A MIDI keyboard or pad plays one lane at a time: disarm Keys, or choose another input for Voice.',
    )
  })

  it("saves the notes played into a kept take with its clip, in ticks from its first sample at the song's tempo", async () => {
    // Arrange
    const { deps } = mount()
    const hold = (await deps.acquireInstrument('lane-1'))!
    const clock = { currentTime: 10 }
    hold.play(clock as unknown as AudioContext)
    keys.send([0x90, 60, 100], performance.now() - 50)
    clock.currentTime = 10.5
    keys.send([0x80, 60, 0], performance.now() - 50)

    // Act
    const kept = await deps.keep(take('take-1', 'lane-1'))

    // Assert: held from 0.1 s to 0.6 s into the take, at 120 bpm's 1920
    // ticks a second.
    expect(kept).toBe(true)
    expect(mocks.addRecording).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        assetId: 'take-1',
        midi: {
          notes: [
            {
              id: 1,
              pitch: 60,
              startTick: 192,
              lengthTicks: 960,
              velocity: 0.7874,
            },
          ],
          tempoBpm: 120,
          sound: 'piano',
        },
      }),
    )
  })

  it("saves a take with no notes played into it as a MIDI lane's, its sequence empty", async () => {
    // Arrange
    const { deps } = mount()
    await deps.acquireInstrument('lane-1')

    // Act
    await deps.keep(take('take-1', 'lane-1'))

    // Assert
    expect(mocks.addRecording.mock.calls[0][0].midi).toEqual({
      notes: [],
      tempoBpm: 120,
      sound: 'piano',
    })
  })

  it('keeps no notes with a take of a lane armed on a microphone after its MIDI arm', async () => {
    // Arrange: a note played on the lane's MIDI arm, then the lane set to
    // follow the Studio's microphone.
    const { hook, deps } = mount()
    const hold = (await deps.acquireInstrument('lane-1'))!
    hold.play({ currentTime: 10 } as unknown as AudioContext)
    keys.send([0x90, 60, 100], performance.now() - 50)
    hold.release()
    hook.laneInputs.choose('lane-1', {
      deviceId: null,
      label: null,
      channel: null,
      pair: false,
    })

    // Act
    const armed = deps.acquireInstrument('lane-1')
    await deps.keep(take('take-1', 'lane-1'))

    // Assert
    expect(armed).toBeNull()
    expect(mocks.addRecording).toHaveBeenCalledOnce()
    expect(mocks.addRecording.mock.calls[0][0]).not.toHaveProperty('midi')
  })

  it('refuses a MIDI lane whose port is gone in its own name', async () => {
    // Arrange
    const { hook, deps } = mount()
    hook.laneInputs.choose('lane-1', {
      kind: 'midi',
      portId: 'gone',
      label: 'MPD218',
    })

    // Act
    const error = await deps
      .acquireInstrument('lane-1')!
      .catch((refusal: unknown) => refusal)

    // Assert
    expect(describeStudioRecordError(error)).toBe(
      'Connect MPD218, then arm again.',
    )
    expect(mocks.acquireFrom).not.toHaveBeenCalled()
  })
})
