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

vi.mock('@/lib/reference-tone', () => ({
  playReferenceTone: () => Promise.resolve(),
}))

// The phone's audio lease, or none for a browser build.
const device = vi.hoisted(() => ({
  lease: null as null | {
    ensure: () => AudioContext | null
    unlock: () => Promise<boolean>
    release: () => void
  },
}))
vi.mock('@/stores/native-shell-store', () => ({
  nativeDeviceApi: () =>
    device.lease === null ? undefined : { acquireAudio: () => device.lease },
}))

const { CaptureError, useLongNoteCapture } =
  await import('./useLongNoteCapture')

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
  })

  afterEach(() => {
    vi.unstubAllGlobals()
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
})
