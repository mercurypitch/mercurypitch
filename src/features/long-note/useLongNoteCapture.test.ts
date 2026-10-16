import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mic = vi.hoisted(() => ({
  acquire: vi.fn<(owner: string) => Promise<MediaStream>>(),
  release: vi.fn<(owner: string) => void>(),
}))
vi.mock('@/lib/mic-manager', () => ({ micManager: mic }))

const pitch = vi.hoisted(() => ({
  createF0Stream: vi.fn(),
}))
vi.mock('@/lib/pitch-f0-stream', () => pitch)

// The room's notes: each one started, and whether it was stopped.
const notes = vi.hoisted(() => ({
  started: [] as { midi: number; stop: () => void; stopped: boolean }[],
}))
vi.mock('@/lib/reference-tone', () => ({
  startReferenceTone: (_ctx: AudioContext, midi: number) => {
    let settle: () => void = () => undefined
    const done = new Promise<void>((resolve) => {
      settle = resolve
    })
    const note = {
      midi,
      stopped: false,
      stop: () => {
        note.stopped = true
        settle()
      },
      done,
    }
    notes.started.push(note)
    return note
  },
}))
vi.mock('@/components/room-kit/room-output', () => ({
  roomOutput: () => ({}),
}))

// The phone's audio lease, or none for a browser build.
const device = vi.hoisted(() => ({
  lease: null as null | {
    ensure: () => AudioContext | null
    unlock: () => Promise<boolean>
    release: () => void
  },
  options: undefined as undefined | { prepareToSuspend?: () => number },
}))
vi.mock('@/stores/native-shell-store', () => ({
  nativeDeviceApi: () =>
    device.lease === null
      ? undefined
      : {
          acquireAudio: (
            _owner: string,
            options?: { prepareToSuspend?: () => number },
          ) => {
            device.options = options
            return device.lease
          },
        },
}))

const { CaptureError, useLongNoteCapture } =
  await import('./useLongNoteCapture')
const { ROOM_TAIL_MS } =
  await import('@/components/room-kit/useExerciseCapture')

const stream = {} as MediaStream
const context = { state: 'running' } as AudioContext

function mount(): {
  capture: ReturnType<typeof useLongNoteCapture>
  dispose: () => void
} {
  return createRoot((dispose) => ({ capture: useLongNoteCapture(), dispose }))
}

describe('useLongNoteCapture', () => {
  beforeEach(() => {
    mic.acquire.mockReset().mockResolvedValue(stream)
    mic.release.mockReset()
    pitch.createF0Stream.mockReset().mockReturnValue({
      startTask: () => undefined,
      peekFrames: () => [],
      takeFrames: () => [],
      dispose: () => undefined,
    })
    device.lease = {
      ensure: () => context,
      unlock: () => Promise.resolve(true),
      release: () => undefined,
    }
    device.options = undefined
    notes.started.length = 0
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('opens the mic and a pitch stream', async () => {
    const { capture, dispose } = mount()
    await capture.acquire()
    expect(mic.acquire).toHaveBeenCalledTimes(1)
    expect(capture.held()).toBe(true)
    dispose()
    expect(mic.release).toHaveBeenCalled()
  })

  it('opens nothing once the screen is gone', async () => {
    const { capture, dispose } = mount()
    dispose()
    await capture.acquire()
    expect(mic.acquire).not.toHaveBeenCalled()
    expect(capture.held()).toBe(false)
  })

  it('hands the mic straight back when released mid-prompt', async () => {
    let grant: (value: MediaStream) => void = () => undefined
    mic.acquire.mockReturnValue(
      new Promise<MediaStream>((resolve) => {
        grant = resolve
      }),
    )
    const { capture, dispose } = mount()
    const pending = capture.acquire()
    // The permission prompt is up.
    await vi.waitFor(() => expect(mic.acquire).toHaveBeenCalled())
    capture.release()
    grant(stream)
    await pending
    expect(pitch.createF0Stream).not.toHaveBeenCalled()
    expect(mic.release).toHaveBeenCalledTimes(2)
    expect(capture.held()).toBe(false)
    dispose()
  })

  // Review A2 of PR 973, minor 1: the second tap was handed the first
  // acquisition, which a release had given up on, so it resolved with no
  // pitch stream and the room listened to nothing.
  it('opens the mic for a tap after a release, while the last one was still opening', async () => {
    let grant: (value: MediaStream) => void = () => undefined
    mic.acquire.mockReturnValueOnce(
      new Promise<MediaStream>((resolve) => {
        grant = resolve
      }),
    )
    const { capture, dispose } = mount()
    const first = capture.acquire()
    await vi.waitFor(() => expect(mic.acquire).toHaveBeenCalledTimes(1))

    // Act: the app goes away while the mic opens, comes back, and the
    // singer taps again before the first opening settled.
    capture.release()
    const second = capture.acquire()
    grant(stream)
    await first
    await second

    // Assert: the second tap has a mic and a pitch stream.
    expect(capture.held()).toBe(true)
    expect(pitch.createF0Stream).toHaveBeenCalledTimes(1)
    // The first hands its hold back before the second takes one: the mic
    // manager keeps one hold per owner, so a later hand-back would end it.
    const lastRelease = Math.max(...mic.release.mock.invocationCallOrder)
    expect(mic.acquire.mock.invocationCallOrder[1]).toBeGreaterThan(lastRelease)
    dispose()
  })

  it('fails without the mic when the clock will not start', async () => {
    device.lease = {
      ensure: () => context,
      unlock: () => Promise.resolve(false),
      release: () => undefined,
    }
    const { capture, dispose } = mount()
    await expect(capture.acquire()).rejects.toBeInstanceOf(CaptureError)
    expect(mic.acquire).not.toHaveBeenCalled()
    dispose()
  })

  it('gives the mic back when the pitch stream cannot start', async () => {
    pitch.createF0Stream.mockImplementation(() => {
      throw new Error('no worklet')
    })
    const { capture, dispose } = mount()
    await expect(capture.acquire()).rejects.toMatchObject({
      failure: 'unavailable',
    })
    expect(mic.release).toHaveBeenCalledTimes(1)
    expect(capture.held()).toBe(false)
    dispose()
  })

  it('says denied when the singer refused the mic', async () => {
    mic.acquire.mockRejectedValue({ kind: 'permission-denied' })
    const { capture, dispose } = mount()
    await expect(capture.acquire()).rejects.toMatchObject({ failure: 'denied' })
    dispose()
  })

  it("hands out the running clock for the room's own sound", async () => {
    const { capture, dispose } = mount()
    await expect(capture.audio()).resolves.toBe(context)
    // Sound needs no microphone.
    expect(mic.acquire).not.toHaveBeenCalled()
    dispose()
    await expect(capture.audio()).resolves.toBeNull()
  })

  it('hands out no clock that will not start', async () => {
    device.lease = {
      ensure: () => context,
      unlock: () => Promise.resolve(false),
      release: () => undefined,
    }
    const { capture, dispose } = mount()
    await expect(capture.audio()).resolves.toBeNull()
    dispose()
  })
  describe('the clock, once the room is left', () => {
    // A room's sound fades over the house release after the room stops it.
    // The last lease out parks the clock 120 ms later: let go at once, the
    // clock parked in the middle of the fade, and the rest of it played on
    // the next room's first tap.
    it("keeps the lease for the room's tail, then lets it go", () => {
      vi.useFakeTimers()
      const release = vi.fn()
      device.lease = { ...device.lease!, release }
      const { dispose } = mount()
      dispose()
      vi.advanceTimersByTime(ROOM_TAIL_MS - 1)
      expect(release).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(release).toHaveBeenCalledTimes(1)
    })

    it('tells a park how long its sound still plays', () => {
      vi.useFakeTimers()
      const { dispose } = mount()
      const prepare = device.options?.prepareToSuspend
      expect(prepare).toBeTypeOf('function')
      // Open: whatever the room stops with the page has the whole tail.
      expect(prepare?.()).toBe(ROOM_TAIL_MS)
      dispose()
      vi.advanceTimersByTime(100)
      expect(prepare?.()).toBe(ROOM_TAIL_MS - 100)
      vi.advanceTimersByTime(ROOM_TAIL_MS)
      expect(prepare?.()).toBe(0)
    })

    it('stops its note when the mic goes back, and when the room goes', async () => {
      const { capture, dispose } = mount()
      void capture.playTone(57)
      await vi.waitFor(() => expect(notes.started).toHaveLength(1))
      capture.release()
      expect(notes.started[0].stopped).toBe(true)

      void capture.playTone(59)
      await vi.waitFor(() => expect(notes.started).toHaveLength(2))
      dispose()
      expect(notes.started[1].stopped).toBe(true)
    })

    it('plays no note for a start given up while the clock unlocked', async () => {
      let unlocked: (ok: boolean) => void = () => undefined
      device.lease = {
        ...device.lease!,
        unlock: () =>
          new Promise<boolean>((resolve) => {
            unlocked = resolve
          }),
      }
      const { capture, dispose } = mount()
      const playing = capture.playTone(57)
      capture.release()
      unlocked(true)
      await playing
      expect(notes.started).toEqual([])
      dispose()
    })

    it('unlocks nothing and plays nothing while the lease waits out the tail', async () => {
      const unlock = vi.fn(() => Promise.resolve(true))
      device.lease = { ...device.lease!, unlock }
      const { capture, dispose } = mount()
      dispose()
      await capture.playTone(57)
      await expect(capture.audio()).resolves.toBeNull()
      expect(unlock).not.toHaveBeenCalled()
      expect(notes.started).toEqual([])
    })
  })
})
