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
  started: [] as {
    midi: number
    options: unknown
    stop: () => void
    stopped: boolean
  }[],
}))
vi.mock('@/lib/reference-tone', () => ({
  startReferenceTone: (
    _ctx: AudioContext,
    midi: number,
    _seconds?: number,
    _destination?: unknown,
    options?: unknown,
  ) => {
    let settle: () => void = () => undefined
    const done = new Promise<void>((resolve) => {
      settle = resolve
    })
    const note = {
      midi,
      options,
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
// The room's stages in front of the room output: each one opened, and
// whether it was cut.
const stages = vi.hoisted(() => ({
  opened: [] as { cut: () => void; isCut: boolean }[],
}))
vi.mock('@/components/room-kit/room-output', () => ({
  roomOutput: () => ({}),
  openRoomStage: () => {
    const stage = {
      isCut: false,
      cut: () => {
        stage.isCut = true
      },
    }
    stages.opened.push(stage)
    return stage
  },
}))

// The phone's audio lease, or none for a browser build, and the holds on
// the clock against a park (each one's owner, and whether it was let go).
const device = vi.hoisted(() => ({
  lease: null as null | {
    ensure: () => AudioContext | null
    unlock: () => Promise<boolean>
    release: () => void
  },
  options: undefined as undefined | { prepareToSuspend?: () => number },
  holds: [] as { owner: string; letGo: number }[],
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
          holdAudioInBackground: (owner: string) => {
            const hold = { owner, letGo: 0 }
            device.holds.push(hold)
            return () => {
              hold.letGo += 1
            }
          },
        },
}))

const { CaptureError, LONG_NOTE_AUDIO_OWNER, useLongNoteCapture } =
  await import('./useLongNoteCapture')
const { onAppLeave } = await import('@/components/room-kit/app-leave')
const { ROOM_TAIL_MS } =
  await import('@/components/room-kit/useExerciseCapture')

const stream = {} as MediaStream
/** The audio clock: its state, and who is listening for it to change. */
const clock = {
  state: 'running' as AudioContextState,
  listeners: new Set<() => void>(),
  addEventListener: (_type: string, listener: () => void) => {
    clock.listeners.add(listener)
  },
  removeEventListener: (_type: string, listener: () => void) => {
    clock.listeners.delete(listener)
  },
}
const context = clock as unknown as AudioContext

/** The clock parks, as the app leaving the foreground or the system does. */
function park(): void {
  clock.state = 'suspended'
  for (const listener of [...clock.listeners]) listener()
}

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
    device.holds.length = 0
    notes.started.length = 0
    stages.opened.length = 0
    clock.state = 'running'
    clock.listeners.clear()
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
  it('starts a parked clock on a new stage, and cuts the one the park held', async () => {
    const { capture, dispose } = mount()
    await capture.audio()
    // The clock parked with the room's note in it, without asking the room
    // first: the system can park it on its own.
    park()
    await capture.audio()
    expect(stages.opened.map((stage) => stage.isCut)).toEqual([true, false])
    dispose()
  })

  describe('the clock while the mic opens', () => {
    // The first Start asks iOS for the microphone. Its alert takes the app
    // out of the foreground with the singer still in the room, and the
    // shell cannot tell that from Control Center: a park then would end
    // the take the singer is starting. So the room holds the clock against
    // a park through every opening, and only through it.

    /** An opening whose prompt is up until `answer` is called. */
    function prompting(): (answer: () => Promise<MediaStream>) => void {
      let settle: (stream: Promise<MediaStream>) => void = () => undefined
      mic.acquire.mockReturnValueOnce(
        new Promise<MediaStream>((resolve) => {
          settle = resolve
        }),
      )
      return (answer) => settle(answer())
    }

    it('holds the clock from before the prompt until the singer answers', async () => {
      const answer = prompting()
      const { capture, dispose } = mount()
      const opening = capture.acquire()
      await vi.waitFor(() => expect(mic.acquire).toHaveBeenCalledTimes(1))
      expect(device.holds).toEqual([{ owner: LONG_NOTE_AUDIO_OWNER, letGo: 0 }])
      answer(() => Promise.resolve(stream))
      await opening
      expect(device.holds).toEqual([{ owner: LONG_NOTE_AUDIO_OWNER, letGo: 1 }])
      // Let go once: the mic going back later lets go of nothing more.
      capture.release()
      dispose()
      expect(device.holds[0].letGo).toBe(1)
    })

    it('lets go when the singer refuses the mic', async () => {
      const answer = prompting()
      const { capture, dispose } = mount()
      const opening = capture.acquire()
      await vi.waitFor(() => expect(mic.acquire).toHaveBeenCalledTimes(1))
      answer(() => Promise.reject({ kind: 'permission-denied' }))
      await expect(opening).rejects.toMatchObject({ failure: 'denied' })
      expect(device.holds).toEqual([{ owner: LONG_NOTE_AUDIO_OWNER, letGo: 1 }])
      dispose()
    })

    it('lets go at once when the room gives the opening up', async () => {
      const answer = prompting()
      const { capture, dispose } = mount()
      const opening = capture.acquire()
      await vi.waitFor(() => expect(mic.acquire).toHaveBeenCalledTimes(1))
      // The page hid with the prompt up: the room let its start go.
      capture.release()
      expect(device.holds[0].letGo).toBe(1)
      answer(() => Promise.resolve(stream))
      await opening
      expect(device.holds[0].letGo).toBe(1)
      dispose()
    })

    it("holds nothing for a mic that is open, or a clock that won't start", async () => {
      const { capture, dispose } = mount()
      await capture.acquire()
      await capture.acquire()
      expect(device.holds).toHaveLength(1)
      dispose()
      device.lease = { ...device.lease!, unlock: () => Promise.resolve(false) }
      const next = mount()
      await expect(next.capture.acquire()).rejects.toBeInstanceOf(CaptureError)
      expect(device.holds).toHaveLength(1)
      next.dispose()
    })
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

    it('tells the room the app is leaving while it is open, and not once it is gone', () => {
      vi.useFakeTimers()
      const left = vi.fn()
      const stop = onAppLeave(left)
      const { dispose } = mount()
      const prepare = device.options?.prepareToSuspend
      prepare?.()
      expect(left).toHaveBeenCalledTimes(1)
      dispose()
      prepare?.()
      expect(left).toHaveBeenCalledTimes(1)
      stop()
    })

    it('plays the note with its low-note octave', async () => {
      const { capture, dispose } = mount()
      void capture.playTone(45)
      await vi.waitFor(() => expect(notes.started).toHaveLength(1))
      expect(notes.started[0].options).toEqual({ lowNoteOctave: true })
      dispose()
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

    it('plays no note on a clock that parked while it unlocked', async () => {
      device.lease = {
        ...device.lease!,
        unlock: () => {
          park()
          return Promise.resolve(true)
        },
      }
      const { capture, dispose } = mount()
      await capture.playTone(57)
      expect(notes.started).toEqual([])
      dispose()
    })

    it("cuts the room's stage once the tail is over", async () => {
      const { capture, dispose } = mount()
      await capture.audio()
      await capture.audio()
      // One stage for the room while its clock runs.
      expect(stages.opened).toHaveLength(1)
      vi.useFakeTimers()
      dispose()
      vi.advanceTimersByTime(ROOM_TAIL_MS - 1)
      expect(stages.opened[0].isCut).toBe(false)
      vi.advanceTimersByTime(1)
      expect(stages.opened[0].isCut).toBe(true)
      expect(clock.listeners.size).toBe(0)
    })

    it('cuts the stage at once when the room goes with the clock parked', async () => {
      const { capture, dispose } = mount()
      await capture.audio()
      park()
      dispose()
      expect(stages.opened[0].isCut).toBe(true)
    })

    it('cuts the stage when the clock parks inside the tail', async () => {
      const { capture, dispose } = mount()
      await capture.audio()
      vi.useFakeTimers()
      dispose()
      vi.advanceTimersByTime(100)
      expect(stages.opened[0].isCut).toBe(false)
      park()
      expect(stages.opened[0].isCut).toBe(true)
      expect(clock.listeners.size).toBe(0)
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
