// Record in the Studio, the hook — one press of Record or R starts a take on the armed lane (arming one first when none is), each lane's arm button moves or drops the arm, repeat steps aside for a take, the mic icon and a lost mic follow the phase, a journaled take is offered only while it is not in the song, and the controls that wait for a take hear when it runs.
import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StudioAsset, StudioProject } from '@/lib/studio/model/types'
import type { StudioRecorderView } from '@/lib/studio/record/studio-recorder'

const mocks = vi.hoisted(() => ({
  recorder: null as null | Record<string, ReturnType<typeof vi.fn>>,
  onChange: null as null | ((view: StudioRecorderView) => void),
  acquireMic: null as null | (() => Promise<{ stream: MediaStream }>),
  roundTrip: null as
    | null
    | ((context: AudioContext, stream: MediaStream) => number),
  acquireFrom: vi.fn(),
  micListener: null as null | ((state: unknown) => void),
  indicator: null as null | (() => boolean),
  runGuard: null as null | (() => boolean),
  navigationLock: null as null | (() => boolean),
  journal: {
    writer: vi.fn(),
    list: vi.fn(),
    read: vi.fn(),
    discard: vi.fn(),
  },
}))

vi.mock('@/lib/studio/record/studio-recorder', () => ({
  createStudioRecorder: (deps: {
    onChange: (view: StudioRecorderView) => void
    acquireMic: () => Promise<{ stream: MediaStream }>
    roundTrip: (context: AudioContext, stream: MediaStream) => number
  }) => {
    mocks.onChange = deps.onChange
    mocks.acquireMic = deps.acquireMic
    mocks.roundTrip = deps.roundTrip
    mocks.recorder = {
      // Opens at once: the lane is armed by the time the promise settles.
      arm: vi.fn(async (trackId: string | null) => {
        mocks.onChange!(view({ phase: 'armed', targetTrackId: trackId }))
        return true
      }),
      record: vi.fn(),
      stop: vi.fn(),
      disarm: vi.fn(),
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
  listAudioInputs: () => Promise.resolve([]),
  micManager: {
    acquire: vi.fn(),
    acquireFrom: mocks.acquireFrom,
    release: vi.fn(),
    // The app's own input: the one its latency is measured on by default.
    getResolvedDevice: () => 'app-in',
    getPreferredDevice: () => 'app-in',
    subscribe: (listener: (state: unknown) => void) => {
      mocks.micListener = listener
      return () => undefined
    },
    registerRunGuard: (_id: string, running: () => boolean) => {
      mocks.runGuard = running
      return () => undefined
    },
  },
}))
vi.mock('@/lib/mic-sentinel', () => ({
  registerMicIndicator: (_id: string, on: () => boolean) => {
    mocks.indicator = on
    return () => undefined
  },
}))
vi.mock('@/lib/local-save-navigation-reason', () => ({
  useLocalSaveNavigationLockWithReason: (lock: () => boolean) => {
    mocks.navigationLock = lock
  },
}))

const { describeStudioRecordError, studioNextTakeNumber, useStudioRecorder } =
  await import('./useStudioRecorder')
const { setMicLatencyByDevice } = await import('@/stores/mic-latency-store')
const { setMicLatencyPathByKey } =
  await import('@/stores/mic-latency-path-store')
const { studioTakeRunning } = await import('./take-running')
const { readStudioRecordSettings } =
  await import('@/lib/studio/record/record-settings')

const song = {
  id: 'song-1',
  tempoBpm: 120,
  tracks: [{ id: 'lane-1', name: 'Lead', gainDb: 0, pan: 0, mute: false }],
  clips: [],
} as unknown as StudioProject

/** Three lanes in this order: Drums holds a clip, Bass and Keys are empty. */
const band = {
  ...song,
  tracks: [
    { id: 'keys', name: 'Keys', order: 2 },
    { id: 'drums', name: 'Drums', order: 0 },
    { id: 'bass', name: 'Bass', order: 1 },
  ],
  clips: [{ id: 'clip-1', trackId: 'drums' }],
} as unknown as StudioProject

function view(patch: Partial<StudioRecorderView>): StudioRecorderView {
  return {
    phase: 'idle',
    level: 0,
    countBeat: null,
    error: null,
    notice: null,
    targetTrackId: 'lane-1',
    live: null,
    ...patch,
  }
}

function mount(
  options: {
    canEdit?: boolean
    audioBusy?: boolean
    assets?: readonly StudioAsset[]
    range?: { startFrame: number; endFrame: number } | null
    project?: StudioProject
    selected?: string | null
  } = {},
) {
  const [selected, setSelected] = createSignal<string | null>(
    options.selected === undefined ? 'lane-1' : options.selected,
  )
  const [project, setProject] = createSignal(options.project ?? song)
  const [repeating, setRepeating] = createSignal(true)
  const transport = {
    playing: () => false,
    frameNow: () => 0,
    play: vi.fn(),
    pause: vi.fn(),
    anchor: () => null,
    clock: () => null,
    unlock: () => Promise.resolve(false),
    repeating,
    range: () => options.range ?? null,
    setRepeat: vi.fn((on: boolean) => {
      setRepeating(on)
      return Promise.resolve()
    }),
  }
  let hook!: ReturnType<typeof useStudioRecorder>
  const addRecording = vi.fn((_take: unknown) => Promise.resolve(true))
  const dispose = createRoot((done) => {
    hook = useStudioRecorder({
      project,
      assets: () => options.assets ?? [],
      canEdit: () => options.canEdit ?? true,
      addRecording,
      transport: transport as never,
      selectedTrackId: selected,
      audioBusy: () => options.audioBusy ?? false,
    })
    return done
  })
  return { hook, dispose, transport, setSelected, setProject, addRecording }
}

const key = (name: string, extra: Partial<KeyboardEvent> = {}) =>
  ({
    key: name,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    repeat: false,
    preventDefault: vi.fn(),
    ...extra,
  }) as unknown as KeyboardEvent

beforeEach(() => {
  mocks.journal.list.mockResolvedValue([])
  mocks.journal.discard.mockResolvedValue(undefined)
})
afterEach(() => vi.clearAllMocks())

describe('useStudioRecorder', () => {
  it('arms the selected lane on R and starts the take in the same press, with repeat off, then stops on the next R', async () => {
    const { hook, dispose, transport } = mount()
    const recorder = mocks.recorder!

    expect(hook.keyDown(key('r'))).toBe(true)

    expect(recorder.arm).toHaveBeenCalledWith('lane-1')
    await vi.waitFor(() => expect(recorder.record).toHaveBeenCalledOnce())
    expect(transport.setRepeat).toHaveBeenCalledWith(false)

    mocks.onChange!(view({ phase: 'recording' }))
    hook.keyDown(key('r'))
    expect(recorder.stop).toHaveBeenCalledOnce()

    // The take is over and the lane stays armed: repeat comes back.
    mocks.onChange!(view({ phase: 'finishing' }))
    mocks.onChange!(view({ phase: 'armed' }))
    expect(transport.setRepeat).toHaveBeenLastCalledWith(true)
    dispose()
  })

  it('starts the take at once on an armed lane, without arming the selected one', () => {
    const { hook, dispose, setSelected } = mount()
    const recorder = mocks.recorder!
    mocks.onChange!(view({ phase: 'armed', targetTrackId: 'lane-1' }))
    setSelected('lane-2')

    hook.press()

    expect(recorder.record).toHaveBeenCalledOnce()
    expect(recorder.arm).not.toHaveBeenCalled()
    dispose()
  })

  it('arms the first lane with no clips when none is selected, and a new lane when every lane has one', async () => {
    const empty = mount({ project: band, selected: null })
    empty.hook.press()
    expect(mocks.recorder!.arm).toHaveBeenCalledWith('bass')
    await vi.waitFor(() => expect(mocks.recorder!.record).toHaveBeenCalled())
    empty.dispose()

    const full = mount({
      project: { ...band, tracks: band.tracks.slice(1, 2) } as StudioProject,
      selected: null,
    })
    full.hook.press()
    expect(mocks.recorder!.arm).toHaveBeenLastCalledWith(null)
    full.dispose()
  })

  it('does not start a take when the arm was dropped before the microphone opened', async () => {
    const { hook, dispose } = mount()
    const recorder = mocks.recorder!
    // Disarmed or failed while the microphone opened: the lane never armed.
    recorder.arm.mockResolvedValueOnce(false)

    hook.press()
    await Promise.resolve()
    await Promise.resolve()

    expect(recorder.record).not.toHaveBeenCalled()
    dispose()
  })

  it('leaves R with a modifier, a held R and Escape when idle to the page', () => {
    const { hook, dispose } = mount()

    expect(hook.keyDown(key('r', { ctrlKey: true }))).toBe(false)
    expect(hook.keyDown(key('r', { repeat: true }))).toBe(false)
    expect(hook.keyDown(key('Escape'))).toBe(false)
    expect(mocks.recorder!.arm).not.toHaveBeenCalled()
    dispose()
  })

  it('disarms on Escape when armed and stops a count-in or a take', () => {
    const { hook, dispose } = mount()
    const recorder = mocks.recorder!

    mocks.onChange!(view({ phase: 'armed' }))
    expect(hook.keyDown(key('Escape'))).toBe(true)
    expect(recorder.disarm).toHaveBeenCalledOnce()

    for (const phase of ['counting', 'recording'] as const) {
      mocks.onChange!(view({ phase }))
      hook.keyDown(key('Escape'))
    }
    expect(recorder.stop).toHaveBeenCalledTimes(2)
    dispose()
  })

  it('answers R and Escape from anywhere on the page once armed, but not an idle R', () => {
    const { dispose } = mount()
    const recorder = mocks.recorder!
    const fromPage = (name: string) => {
      const event = new KeyboardEvent('keydown', {
        key: name,
        cancelable: true,
      })
      window.dispatchEvent(event)
      return event
    }

    fromPage('r')
    expect(recorder.arm).not.toHaveBeenCalled()

    mocks.onChange!(view({ phase: 'armed' }))
    expect(fromPage('r').defaultPrevented).toBe(true)
    expect(recorder.record).toHaveBeenCalledOnce()

    // A key the workspace already handled is not handled again.
    mocks.onChange!(view({ phase: 'recording' }))
    const handled = new KeyboardEvent('keydown', { key: 'r', cancelable: true })
    handled.preventDefault()
    window.dispatchEvent(handled)
    expect(recorder.stop).not.toHaveBeenCalled()
    fromPage('Escape')
    expect(recorder.stop).toHaveBeenCalledOnce()

    // The listener goes with the Studio.
    dispose()
    fromPage('Escape')
    expect(recorder.stop).toHaveBeenCalledOnce()
  })

  it('does not arm while the song is read-only or its audio is busy', () => {
    for (const blocked of [{ canEdit: false }, { audioBusy: true }]) {
      const { hook, dispose } = mount(blocked)
      expect(hook.canArm()).toBe(false)
      hook.press()
      hook.arming.toggle('lane-1')
      expect(mocks.recorder!.arm).not.toHaveBeenCalled()
      dispose()
    }
  })

  it("arms a lane from its own button, moves the arm to another lane's, and disarms on the armed lane's", () => {
    const { hook, dispose } = mount({ project: band })
    const recorder = mocks.recorder!

    hook.arming.toggle('bass')
    expect(recorder.arm).toHaveBeenCalledWith('bass')
    expect(hook.arming.armedTrackId()).toBe('bass')

    hook.arming.toggle('keys')
    expect(recorder.retarget).toHaveBeenCalledWith('keys')
    expect(recorder.record).not.toHaveBeenCalled()

    mocks.onChange!(view({ phase: 'armed', targetTrackId: 'keys' }))
    hook.arming.toggle('keys')
    expect(recorder.disarm).toHaveBeenCalledOnce()
    dispose()
  })

  it('leaves the arm buttons alone while a take counts in, records or is kept', () => {
    const { hook, dispose } = mount({ project: band })
    for (const phase of ['counting', 'recording', 'finishing'] as const) {
      mocks.onChange!(view({ phase, targetTrackId: 'bass' }))
      hook.arming.toggle('bass')
      hook.arming.toggle('keys')
    }
    expect(mocks.recorder!.disarm).not.toHaveBeenCalled()
    expect(mocks.recorder!.retarget).not.toHaveBeenCalled()
    dispose()
  })

  it('keeps the arm on its lane when another lane is selected', () => {
    const { hook, dispose, setSelected } = mount()
    mocks.onChange!(view({ phase: 'armed', targetTrackId: 'lane-1' }))

    setSelected('lane-2')

    expect(mocks.recorder!.retarget).not.toHaveBeenCalled()
    expect(hook.arming.armedTrackId()).toBe('lane-1')
    dispose()
  })

  it('disarms when the armed lane leaves the song', () => {
    const { dispose, setProject } = mount({ project: band })
    mocks.onChange!(view({ phase: 'armed', targetTrackId: 'bass' }))

    setProject({
      ...band,
      tracks: band.tracks.filter((track) => track.id !== 'bass'),
    } as StudioProject)

    expect(mocks.recorder!.disarm).toHaveBeenCalledOnce()
    dispose()
  })

  it('shows the mic icon while it holds the mic, and a lost mic ends an armed or running take only', () => {
    const { dispose } = mount()
    const recorder = mocks.recorder!
    const lost = { active: false, consumers: [], scoped: null }

    expect(mocks.indicator!()).toBe(false)
    mocks.micListener!(lost)
    expect(recorder.micLost).not.toHaveBeenCalled()

    mocks.onChange!(view({ phase: 'armed' }))
    expect(mocks.indicator!()).toBe(true)
    expect(mocks.runGuard!()).toBe(false)
    // The Studio's input is a stream of its own: the shared one closing
    // under another feature says nothing about it.
    mocks.micListener!({
      active: false,
      consumers: [],
      scoped: 'studio-record',
    })
    expect(recorder.micLost).not.toHaveBeenCalled()

    mocks.onChange!(view({ phase: 'recording' }))
    expect(mocks.runGuard!()).toBe(true)
    expect(mocks.navigationLock!()).toBe(true)
    mocks.micListener!({
      active: true,
      consumers: ['voice-control'],
      scoped: null,
    })
    expect(recorder.micLost).toHaveBeenCalledOnce()

    mocks.onChange!(view({ phase: 'idle' }))
    expect(mocks.indicator!()).toBe(false)
    expect(mocks.navigationLock!()).toBe(false)
    dispose()
    expect(recorder.dispose).toHaveBeenCalledOnce()
  })

  it('offers a journaled take that is not in the song, and drops the rows of one that is or that holds only its count-in', async () => {
    // A second at 48 kHz, its first sample heard on the song's first frame.
    const row = (id: string, heardFirst = 0) => ({
      id,
      title: id,
      frames: 48000,
      sampleRate: 48000,
      fromFrame: 0,
      heardFirst,
    })
    mocks.journal.list.mockResolvedValue([
      row('take-kept'),
      row('take-lost'),
      // A tab closed one second into a two-second count-in.
      row('take-count-in', -96000 - 4800),
    ])
    const { hook, dispose } = mount({
      assets: [{ id: 'take-kept' } as StudioAsset],
    })

    await vi.waitFor(() =>
      expect(hook.recovery().map((take) => take.id)).toEqual(['take-lost']),
    )
    expect(mocks.journal.discard).toHaveBeenCalledWith('take-kept')
    expect(mocks.journal.discard).toHaveBeenCalledWith('take-count-in')
    expect(hook.canArm()).toBe(true)
    dispose()
  })
})

describe('useStudioRecorder with a range', () => {
  const RANGE = { startFrame: 96000, endFrame: 144000 }

  it('says a take runs from its count-in until it is kept, and toggles Punch for the next take', () => {
    const { hook, dispose } = mount({ range: RANGE })
    const running = () => studioTakeRunning()
    mocks.onChange!(view({ phase: 'armed' }))
    expect(running()).toBe(false)
    mocks.onChange!(view({ phase: 'counting' }))
    expect(running()).toBe(true)
    mocks.onChange!(view({ phase: 'recording' }))
    mocks.onChange!(view({ phase: 'finishing' }))
    expect(running()).toBe(true)
    mocks.onChange!(view({ phase: 'idle' }))
    expect(running()).toBe(false)

    const was = hook.punch.on()
    hook.punch.toggle()
    expect(hook.punch.on()).toBe(!was)
    expect(readStudioRecordSettings().punch).toBe(!was)
    hook.punch.toggle()
    mocks.onChange!(view({ phase: 'recording' }))
    dispose()
    // A Studio closed mid-take holds nothing up.
    expect(running()).toBe(false)
  })

  it('keeps Repeat on for a loop take, so the range plays pass after pass', () => {
    const { hook, transport, dispose } = mount({ range: RANGE })
    mocks.onChange!(view({ phase: 'armed' }))
    hook.press()
    expect(transport.setRepeat).not.toHaveBeenCalled()
    expect(mocks.recorder!.record).toHaveBeenCalledOnce()
    dispose()
  })

  it('keeps a loop take left by a closed tab as one file, its clip on the newest whole pass', async () => {
    const header = {
      id: 'take-loop',
      title: 'Take 5',
      trackId: 'lane-1',
      sampleRate: 48000,
      fromFrame: 96000,
      heardFirst: 90000,
      cut: { mode: 'loop', range: RANGE },
      frames: 6000 + 2 * 48000 + 30000,
    }
    mocks.journal.list.mockResolvedValue([header])
    mocks.journal.read.mockResolvedValue({
      header,
      pcm: new Int16Array(header.frames).fill(1000),
    })
    const { hook, addRecording, dispose } = mount()
    await vi.waitFor(() => expect(hook.recovery()).toHaveLength(1))

    await hook.keepRecovered('take-loop')

    expect(addRecording).toHaveBeenCalledOnce()
    expect(addRecording.mock.calls[0][0]).toMatchObject({
      assetId: 'take-loop',
      title: 'Take 5',
      startFrame: 96000,
      sourceInFrame: 6000 + 48000,
      sourceOutFrame: 6000 + 2 * 48000,
      passes: { firstFrame: 6000, frames: 48000, count: 2 },
    })
    expect(mocks.journal.discard).toHaveBeenCalledWith('take-loop')
    dispose()
  })

  it('does not offer a punch or a loop left by a closed tab that keeps nothing, and drops its rows', async () => {
    const row = (id: string, mode: 'punch' | 'loop', frames: number) => ({
      id,
      title: id,
      frames,
      sampleRate: 48000,
      fromFrame: 96000,
      heardFirst: 90000,
      cut: { mode, range: RANGE },
    })
    mocks.journal.list.mockResolvedValue([
      // A punch closed a twentieth of a second into its range.
      row('punch-short', 'punch', 6000 + 2400),
      // A loop closed a quarter of the way into its one-second first pass.
      row('loop-short', 'loop', 6000 + 12000),
      row('loop-kept', 'loop', 6000 + 24000),
    ])
    const { hook, dispose } = mount()
    await vi.waitFor(() =>
      expect(hook.recovery().map((take) => take.id)).toEqual(['loop-kept']),
    )
    expect(mocks.journal.discard).toHaveBeenCalledWith('punch-short')
    expect(mocks.journal.discard).toHaveBeenCalledWith('loop-short')
    dispose()
  })

  it('counts a loop take stored as its one file, and drops its rows', async () => {
    mocks.journal.list.mockResolvedValue([
      {
        id: 'take-loop',
        title: 'Take 5',
        frames: 200000,
        sampleRate: 48000,
        fromFrame: 96000,
        heardFirst: 90000,
        cut: { mode: 'loop', range: RANGE },
      },
    ])
    const { hook, dispose } = mount({
      assets: [{ id: 'take-loop' } as StudioAsset],
    })
    await vi.waitFor(() =>
      expect(mocks.journal.discard).toHaveBeenCalledWith('take-loop'),
    )
    expect(hook.recovery()).toEqual([])
    dispose()
  })
})

describe('useStudioRecorder input', () => {
  afterEach(() => localStorage.clear())

  it('arms on the chosen input, and says when it was not connected', async () => {
    const { hook, dispose } = mount()
    hook.chooseInput('usb-mic', 'USB Mic')
    const held = { stream: {} as MediaStream, missing: true, release: vi.fn() }
    mocks.acquireFrom.mockResolvedValueOnce(held)

    // MicManager's hold as it is: the recorder gives it back through itself.
    await expect(mocks.acquireMic!()).resolves.toBe(held)

    expect(mocks.acquireFrom).toHaveBeenCalledWith('studio-record', 'usb-mic')
    expect(hook.inputMissing()).toBe(true)
    expect(readStudioRecordSettings()).toMatchObject({
      inputDeviceId: 'usb-mic',
      inputLabel: 'USB Mic',
    })
    // Another choice clears what the last arm found.
    hook.chooseInput(null, 'Default input')
    expect(hook.inputMissing()).toBe(false)
    expect(readStudioRecordSettings().inputLabel).toBeNull()
    dispose()
  })

  it("takes off the round trip measured on the input it records from, not the app's", () => {
    const { hook, dispose } = mount()
    // 40 ms on the app's input, on a 30 ms output path; 120 ms on the
    // Studio's, on a 50 ms one. The Studio's clock buffers 80 ms.
    setMicLatencyByDevice({ 'app-in': 40, 'usb-2': 120 })
    setMicLatencyPathByKey({ 'app-in': 30, 'usb-2': 50 })
    const context = { baseLatency: 0.02, outputLatency: 0.06 }
    const stream = {
      getAudioTracks: () => [{ getSettings: () => ({ deviceId: 'usb-2' }) }],
    }

    const seconds = mocks.roundTrip!(
      context as unknown as AudioContext,
      stream as unknown as MediaStream,
    )

    // 120 ms, and the 30 ms more the Studio's clock buffers than the one measured on.
    expect(seconds).toBeCloseTo(0.15, 6)
    expect(hook.roundTrip()).toMatchObject({ source: 'measured' })
    setMicLatencyByDevice({})
    setMicLatencyPathByKey({})
    dispose()
  })

  it('keeps the input picked before it re-arms an armed lane, and holds it still while a take runs', () => {
    const { hook, dispose } = mount()
    mocks.onChange!(view({ phase: 'armed' }))
    // The re-arm opens whatever the settings say when it asks for the
    // microphone, right after the disarm; studio-recorder.test.ts checks the
    // stream it then hears.
    let asked: string | null | undefined
    mocks.recorder!.disarm.mockImplementation(() => {
      asked = hook.settings().inputDeviceId
    })
    hook.chooseInput('desk-mic', 'Desk mic')
    expect(mocks.recorder!.disarm).toHaveBeenCalledOnce()
    expect(mocks.recorder!.arm).toHaveBeenCalledWith('lane-1')
    expect(asked).toBe('desk-mic')

    mocks.onChange!(view({ phase: 'recording' }))
    hook.chooseInput('usb-mic', 'USB Mic')
    expect(hook.settings().inputDeviceId).toBe('desk-mic')
    expect(mocks.recorder!.disarm).toHaveBeenCalledOnce()
    dispose()
  })
})

describe('studioNextTakeNumber', () => {
  it('numbers a take one past the highest recorded, a loop take counting once', () => {
    const recorded = (originalName: string) =>
      ({ originalName, provenance: { kind: 'recording' } }) as StudioAsset
    expect(studioNextTakeNumber([])).toBe(1)
    expect(
      studioNextTakeNumber([
        recorded('Take 1.wav'),
        recorded('Take 3, pass 1.wav'),
        recorded('Take 3, pass 2.wav'),
        recorded('Take 3, pass 3.wav'),
        {
          originalName: 'Take 9.wav',
          provenance: { kind: 'file' },
        } as StudioAsset,
      ]),
    ).toBe(4)
  })
})

describe('describeStudioRecordError', () => {
  it('says what to do for each way the microphone or the recorder can refuse', () => {
    expect(describeStudioRecordError({ kind: 'permission-denied' })).toBe(
      "Studio can't hear your microphone. Allow it in the browser's site settings, then press Record again.",
    )
    expect(
      describeStudioRecordError(new Error('Studio needs more memory here.')),
    ).toBe(
      'Studio needs more memory to record. Close other songs or tabs, then press Record again.',
    )
    expect(
      describeStudioRecordError(
        new Error("This browser can't record in Studio."),
      ),
    ).toBe("This browser can't record in Studio.")
    expect(describeStudioRecordError(new Error('boom'))).toBe(
      "Studio couldn't start recording. Press Record to try again.",
    )
  })
})
