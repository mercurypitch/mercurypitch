// Record in the Studio, the hook — R and Escape drive the recorder, repeat steps aside for a take, the mic icon and a lost mic follow the phase, and a journaled take is offered only while it is not in the song.
import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StudioAsset, StudioProject } from '@/lib/studio/model/types'
import type { StudioRecorderView } from '@/lib/studio/record/studio-recorder'

const mocks = vi.hoisted(() => ({
  recorder: null as null | Record<string, ReturnType<typeof vi.fn>>,
  onChange: null as null | ((view: StudioRecorderView) => void),
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
  }) => {
    mocks.onChange = deps.onChange
    mocks.recorder = {
      arm: vi.fn(() => Promise.resolve()),
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
  micManager: {
    acquire: vi.fn(),
    release: vi.fn(),
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

const { describeStudioRecordError, useStudioRecorder } =
  await import('./useStudioRecorder')

const song = {
  id: 'song-1',
  tempoBpm: 120,
  tracks: [{ id: 'lane-1', name: 'Lead', gainDb: 0, pan: 0, mute: false }],
  clips: [],
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
  } = {},
) {
  const [selected, setSelected] = createSignal<string | null>('lane-1')
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
    setRepeat: vi.fn((on: boolean) => {
      setRepeating(on)
      return Promise.resolve()
    }),
  }
  let hook!: ReturnType<typeof useStudioRecorder>
  const dispose = createRoot((done) => {
    hook = useStudioRecorder({
      project: () => song,
      assets: () => options.assets ?? [],
      canEdit: () => options.canEdit ?? true,
      addRecording: vi.fn(() => Promise.resolve(true)),
      transport: transport as never,
      selectedTrackId: selected,
      audioBusy: () => options.audioBusy ?? false,
    })
    return done
  })
  return { hook, dispose, transport, setSelected }
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
  it('arms the selected lane on R, records with repeat off, and stops on the next R', () => {
    const { hook, dispose, transport } = mount()
    const recorder = mocks.recorder!

    expect(hook.keyDown(key('r'))).toBe(true)
    expect(recorder.arm).toHaveBeenCalledWith('lane-1')

    mocks.onChange!(view({ phase: 'armed' }))
    hook.keyDown(key('R'))
    expect(recorder.record).toHaveBeenCalledOnce()
    expect(transport.setRepeat).toHaveBeenCalledWith(false)

    mocks.onChange!(view({ phase: 'recording' }))
    hook.keyDown(key('r'))
    expect(recorder.stop).toHaveBeenCalledOnce()

    // The take is over: repeat comes back.
    mocks.onChange!(view({ phase: 'finishing' }))
    mocks.onChange!(view({ phase: 'idle' }))
    expect(transport.setRepeat).toHaveBeenLastCalledWith(true)
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

  it('does not arm while the song is read-only or its audio is busy', () => {
    for (const blocked of [{ canEdit: false }, { audioBusy: true }]) {
      const { hook, dispose } = mount(blocked)
      expect(hook.canArm()).toBe(false)
      hook.press()
      expect(mocks.recorder!.arm).not.toHaveBeenCalled()
      dispose()
    }
  })

  it('follows the selection with the armed lane', () => {
    const { dispose, setSelected } = mount()

    setSelected('lane-2')

    expect(mocks.recorder!.retarget).toHaveBeenCalledWith('lane-2')
    dispose()
  })

  it('shows the mic icon while it holds the mic, and a lost mic ends an armed or running take only', () => {
    const { dispose } = mount()
    const recorder = mocks.recorder!
    const lost = { active: false, consumers: [] }

    expect(mocks.indicator!()).toBe(false)
    mocks.micListener!(lost)
    expect(recorder.micLost).not.toHaveBeenCalled()

    mocks.onChange!(view({ phase: 'armed' }))
    expect(mocks.indicator!()).toBe(true)
    expect(mocks.runGuard!()).toBe(false)
    mocks.micListener!({ active: true, consumers: ['studio-record'] })
    expect(recorder.micLost).not.toHaveBeenCalled()

    mocks.onChange!(view({ phase: 'recording' }))
    expect(mocks.runGuard!()).toBe(true)
    expect(mocks.navigationLock!()).toBe(true)
    mocks.micListener!({ active: true, consumers: ['voice-control'] })
    expect(recorder.micLost).toHaveBeenCalledOnce()

    mocks.onChange!(view({ phase: 'idle' }))
    expect(mocks.indicator!()).toBe(false)
    expect(mocks.navigationLock!()).toBe(false)
    dispose()
    expect(recorder.dispose).toHaveBeenCalledOnce()
  })

  it('offers a journaled take that is not in the song, and drops the rows of one that is', async () => {
    const row = (id: string) => ({ id, title: id, frames: 48000 })
    mocks.journal.list.mockResolvedValue([row('take-kept'), row('take-lost')])
    const { hook, dispose } = mount({
      assets: [{ id: 'take-kept' } as StudioAsset],
    })

    await vi.waitFor(() =>
      expect(hook.recovery().map((take) => take.id)).toEqual(['take-lost']),
    )
    expect(mocks.journal.discard).toHaveBeenCalledWith('take-kept')
    expect(hook.canArm()).toBe(true)
    dispose()
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
