// ============================================================
// Dry Voice Capture Controller tests — segmented timing and inert seeking
// ============================================================

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { F0Stream, PitchFrame } from '@/lib/pitch-f0-stream'
import { useDryVoiceCapture } from './useDryVoiceCapture'

const {
  acquireMock,
  createF0StreamMock,
  createRecorderMock,
  inspectMock,
  registerIndicatorMock,
  releaseMock,
  recorderPauseMock,
  recorderResumeMock,
  recorderStartMock,
  recorderStopMock,
} = vi.hoisted(() => ({
  acquireMock: vi.fn(),
  createF0StreamMock: vi.fn(),
  createRecorderMock: vi.fn(),
  inspectMock: vi.fn(),
  registerIndicatorMock: vi.fn(),
  releaseMock: vi.fn(),
  recorderPauseMock: vi.fn(),
  recorderResumeMock: vi.fn(),
  recorderStartMock: vi.fn(),
  recorderStopMock: vi.fn(),
}))

vi.mock('@/lib/mic-manager', () => ({
  micManager: { acquire: acquireMock, release: releaseMock },
}))
vi.mock('@/lib/mic-sentinel', () => ({
  registerMicIndicator: registerIndicatorMock,
}))
vi.mock('@/lib/pitch-f0-stream', () => ({
  createF0Stream: createF0StreamMock,
}))
vi.mock('@/lib/voice-capture', () => ({
  createTakeRecorder: createRecorderMock,
  inspectVoiceTake: inspectMock,
}))

class PreviewAudio extends EventTarget {
  static instances: PreviewAudio[] = []
  currentTime = 0
  duration = 3
  paused = true
  ended = false
  play = vi.fn(async () => {
    this.paused = false
    this.dispatchEvent(new Event('play'))
  })
  pause = vi.fn(() => {
    this.paused = true
    this.dispatchEvent(new Event('pause'))
  })
  setAttribute = vi.fn()

  constructor(_url: string) {
    super()
    PreviewAudio.instances.push(this)
  }
}

class CaptureTrack extends EventTarget {
  readyState: MediaStreamTrackState = 'live'
  muted = false

  interrupt(): void {
    this.readyState = 'ended'
    this.dispatchEvent(new Event('ended'))
  }
}

class CaptureStream extends EventTarget {
  constructor(private readonly track: CaptureTrack) {
    super()
  }

  getAudioTracks(): MediaStreamTrack[] {
    return [this.track as unknown as MediaStreamTrack]
  }

  getTracks(): MediaStreamTrack[] {
    return this.getAudioTracks()
  }
}

describe('useDryVoiceCapture', () => {
  const originalAudio = globalThis.Audio
  let dispose = (): void => undefined
  let frameWindows: ReturnType<typeof vi.fn<() => PitchFrame[]>>
  let captureTrack: CaptureTrack

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-12T10:00:00.000Z'))
    PreviewAudio.instances = []
    globalThis.Audio = PreviewAudio as unknown as typeof Audio
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:voice'),
      revokeObjectURL: vi.fn(),
    })
    captureTrack = new CaptureTrack()
    acquireMock.mockResolvedValue(
      new CaptureStream(captureTrack) as unknown as MediaStream,
    )
    registerIndicatorMock.mockReturnValue(vi.fn())
    recorderStartMock.mockReturnValue(true)
    recorderPauseMock.mockResolvedValue(true)
    recorderResumeMock.mockResolvedValue(true)
    recorderStopMock.mockResolvedValue(
      new Blob(['voice'], { type: 'audio/webm' }),
    )
    createRecorderMock.mockReturnValue({
      start: recorderStartMock,
      pause: recorderPauseMock,
      resume: recorderResumeMock,
      stop: recorderStopMock,
      discard: vi.fn(),
      dispose: vi.fn(),
    })
    inspectMock.mockResolvedValue({
      durationMs: 3000,
      peaks: new Float32Array([0.2, 0.8]),
    })
    frameWindows = vi
      .fn<() => PitchFrame[]>()
      .mockReturnValueOnce([{ t: 0.1, f0: 440, conf: 0.9, rms: 0.1 }])
      .mockReturnValueOnce([{ t: 0.2, f0: 445, conf: 0.9, rms: 0.1 }])
    createF0StreamMock.mockReturnValue({
      startTask: vi.fn(),
      takeFrames: frameWindows,
      latest: vi.fn(() => null),
      latestSmoothed: vi.fn(() => null),
      latestLevel: vi.fn(() => 0),
      maxLevel: vi.fn(() => 0),
      dispose: vi.fn(),
    } satisfies F0Stream)
  })

  afterEach(() => {
    dispose()
    dispose = (): void => undefined
    vi.useRealTimers()
    vi.unstubAllGlobals()
    globalThis.Audio = originalAudio
  })

  it('returns independent pitch windows on the pause-free audio clock', async () => {
    let controller!: ReturnType<typeof useDryVoiceCapture>
    createRoot((rootDispose) => {
      dispose = rootDispose
      controller = useDryVoiceCapture({ consumerId: 'guided-test' })
    })

    await controller.start()
    vi.advanceTimersByTime(1000)
    expect(await controller.pauseSegment()).toMatchObject({
      index: 0,
      audioOffsetMs: 0,
      durationMs: 1000,
    })

    vi.advanceTimersByTime(4000)
    expect(controller.elapsedMs()).toBe(1000)
    expect(await controller.resumeSegment()).toBe(true)
    vi.advanceTimersByTime(2000)
    const result = await controller.stop()

    expect(result?.segments).toEqual([
      expect.objectContaining({
        index: 0,
        audioOffsetMs: 0,
        durationMs: 1000,
      }),
      expect.objectContaining({
        index: 1,
        audioOffsetMs: 1000,
        durationMs: 2000,
      }),
    ])
    expect(result?.frames.map((frame) => frame.t)).toEqual([0.1, 1.2])
    expect(result?.microphoneContinuous).toBe(true)
    expect(frameWindows).toHaveBeenCalledTimes(2)
  })

  it('permanently marks a take when its microphone track is interrupted', async () => {
    let controller!: ReturnType<typeof useDryVoiceCapture>
    createRoot((rootDispose) => {
      dispose = rootDispose
      controller = useDryVoiceCapture({ consumerId: 'guided-test' })
    })

    await controller.start()
    vi.advanceTimersByTime(1200)
    captureTrack.interrupt()
    const result = await controller.stop()

    expect(result?.microphoneContinuous).toBe(false)
  })

  it('arms paused so a reference tone creates no audio or pitch segment', async () => {
    let controller!: ReturnType<typeof useDryVoiceCapture>
    createRoot((rootDispose) => {
      dispose = rootDispose
      controller = useDryVoiceCapture({ consumerId: 'guided-test' })
    })

    await controller.start({ paused: true })
    expect(controller.state()).toBe('paused')
    expect(recorderPauseMock).toHaveBeenCalledOnce()

    vi.advanceTimersByTime(3000)
    expect(controller.elapsedMs()).toBe(0)
    expect(await controller.resumeSegment()).toBe(true)
    vi.advanceTimersByTime(1200)
    const result = await controller.stop()

    expect(result?.segments).toEqual([
      expect.objectContaining({
        index: 0,
        audioOffsetMs: 0,
        durationMs: 1200,
      }),
    ])
    expect(frameWindows).toHaveBeenCalledOnce()
  })

  it('does not arm a paused capture until the recorder pause is ready', async () => {
    let resolvePause!: (ready: boolean) => void
    recorderPauseMock.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolvePause = resolve
      }),
    )
    let controller!: ReturnType<typeof useDryVoiceCapture>
    createRoot((rootDispose) => {
      dispose = rootDispose
      controller = useDryVoiceCapture({ consumerId: 'guided-test' })
    })

    const starting = controller.start({ paused: true })
    await Promise.resolve()
    await Promise.resolve()

    expect(recorderPauseMock).toHaveBeenCalledOnce()
    expect(controller.state()).toBe('starting')
    resolvePause(true)
    await expect(starting).resolves.toBe(true)
    expect(controller.state()).toBe('paused')
  })

  it('does not surface a stale pause failure after capture is discarded', async () => {
    let resolvePause!: (ready: boolean) => void
    recorderPauseMock.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolvePause = resolve
      }),
    )
    let controller!: ReturnType<typeof useDryVoiceCapture>
    createRoot((rootDispose) => {
      dispose = rootDispose
      controller = useDryVoiceCapture({ consumerId: 'guided-test' })
    })

    const starting = controller.start({ paused: true })
    await Promise.resolve()
    await Promise.resolve()
    controller.discard()
    resolvePause(false)

    await expect(starting).resolves.toBe(false)
    expect(controller.state()).toBe('idle')
    expect(controller.message()).toBeNull()
  })

  it('seeks a prepared replay without starting playback', async () => {
    let controller!: ReturnType<typeof useDryVoiceCapture>
    createRoot((rootDispose) => {
      dispose = rootDispose
      controller = useDryVoiceCapture({ consumerId: 'guided-test' })
    })
    await controller.start()
    vi.advanceTimersByTime(3000)
    await controller.stop()

    expect(controller.seekPreview(1.25)).toBe(true)
    const audio = PreviewAudio.instances[0]!
    expect(audio.currentTime).toBe(1.25)
    expect(audio.play).not.toHaveBeenCalled()
    expect(controller.previewCurrentTimeMs()).toBe(1250)
    expect(controller.previewProgress()).toBeCloseTo(1.25 / 3)
  })

  it('falls back to the active capture clock when decoded duration is invalid', async () => {
    inspectMock.mockResolvedValueOnce({
      durationMs: Number.POSITIVE_INFINITY,
      peaks: new Float32Array([0.2, 0.8]),
    })
    let controller!: ReturnType<typeof useDryVoiceCapture>
    createRoot((rootDispose) => {
      dispose = rootDispose
      controller = useDryVoiceCapture({ consumerId: 'guided-test' })
    })

    await controller.start()
    vi.advanceTimersByTime(2400)
    const result = await controller.stop()

    expect(result?.durationMs).toBe(2400)
    expect(controller.previewDurationMs()).toBe(2400)
    expect(controller.seekPreview(1.2)).toBe(true)
    expect(controller.previewProgress()).toBeCloseTo(0.5)
    expect(PreviewAudio.instances[0]?.play).not.toHaveBeenCalled()
  })

  it('ignores a late mic acquisition after discard without adopting its stream', async () => {
    let resolveAcquire!: (stream: MediaStream) => void
    acquireMock.mockReturnValue(
      new Promise<MediaStream>((resolve) => {
        resolveAcquire = resolve
      }),
    )
    let controller!: ReturnType<typeof useDryVoiceCapture>
    createRoot((rootDispose) => {
      dispose = rootDispose
      controller = useDryVoiceCapture({ consumerId: 'guided-test' })
    })

    const starting = controller.start()
    controller.discard()
    resolveAcquire({ getTracks: () => [] } as unknown as MediaStream)

    await expect(starting).resolves.toBe(false)
    expect(createRecorderMock).not.toHaveBeenCalled()
    expect(controller.state()).toBe('idle')
    expect(releaseMock).toHaveBeenCalledWith('guided-test')
  })
})
