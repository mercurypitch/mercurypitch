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

class BufferPreviewAudioParam {
  value = 0
  readonly cancelScheduledValues = vi.fn()
  readonly setValueAtTime = vi.fn((value: number) => {
    this.value = value
  })
  readonly exponentialRampToValueAtTime = vi.fn((value: number) => {
    this.value = value
  })
  readonly linearRampToValueAtTime = vi.fn((value: number) => {
    this.value = value
  })
  readonly setTargetAtTime = vi.fn((value: number) => {
    this.value = value
  })
}

class BufferPreviewGainNode {
  readonly gain = new BufferPreviewAudioParam()
  readonly connect = vi.fn()
  readonly disconnect = vi.fn()
}

class BufferPreviewSourceNode {
  buffer: AudioBuffer | null = null
  onended: (() => void) | null = null
  readonly connect = vi.fn()
  readonly start = vi.fn()
  readonly stop = vi.fn()
  readonly disconnect = vi.fn()
}

class BufferPreviewAudioContext {
  static instances: BufferPreviewAudioContext[] = []
  state: AudioContextState = 'running'
  currentTime = 0
  sampleRate = 48_000
  readonly destination = {} as AudioDestinationNode
  readonly gain = new BufferPreviewGainNode()
  readonly sources: BufferPreviewSourceNode[] = []
  readonly resume = vi.fn(async () => {
    this.state = 'running'
  })
  readonly close = vi.fn(async () => {
    this.state = 'closed'
  })

  constructor() {
    BufferPreviewAudioContext.instances.push(this)
  }

  createGain(): GainNode {
    return this.gain as unknown as GainNode
  }

  createBufferSource(): AudioBufferSourceNode {
    const source = new BufferPreviewSourceNode()
    this.sources.push(source)
    return source as unknown as AudioBufferSourceNode
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
    BufferPreviewAudioContext.instances = []
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
      peekFrames: vi.fn(() => []),
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

  it('keeps segment offsets inside a take the recorder encoded shorter than the wall clock', async () => {
    // Every awaited pause and resume costs wall-clock time the recorder writes
    // no audio for, so the measured spans outrun the encoded take. Left
    // uncorrected the later offsets address audio past its end, and a guided
    // landing window derived from one reads as a take that stopped early.
    inspectMock.mockResolvedValue({
      durationMs: 3800,
      peaks: new Float32Array([0.2, 0.8]),
    })
    let controller!: ReturnType<typeof useDryVoiceCapture>
    createRoot((rootDispose) => {
      dispose = rootDispose
      controller = useDryVoiceCapture({ consumerId: 'guided-test' })
    })

    await controller.start()
    vi.advanceTimersByTime(2000)
    expect(await controller.pauseSegment()).toMatchObject({ index: 0 })
    vi.advanceTimersByTime(4000)
    expect(await controller.resumeSegment()).toBe(true)
    vi.advanceTimersByTime(2000)
    const result = await controller.stop()

    expect(result?.segments).toEqual([
      expect.objectContaining({
        index: 0,
        audioOffsetMs: 0,
        durationMs: 1900,
      }),
      expect.objectContaining({
        index: 1,
        audioOffsetMs: 1900,
        durationMs: 1900,
      }),
    ])
    const last = result!.segments[result!.segments.length - 1]!
    expect(last.audioOffsetMs + last.durationMs).toBe(result?.durationMs)
    expect(result?.frames.map((frame) => frame.t)).toEqual([0.1, 2.1])
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

  it('reuses decoded PCM for enveloped replay, pause, and live seek', async () => {
    vi.stubGlobal(
      'AudioContext',
      BufferPreviewAudioContext as unknown as typeof AudioContext,
    )
    inspectMock.mockResolvedValueOnce({
      durationMs: 3000,
      peaks: new Float32Array([0.2, 0.8]),
      decodedBuffer: { duration: 3 } as AudioBuffer,
    })
    let controller!: ReturnType<typeof useDryVoiceCapture>
    createRoot((rootDispose) => {
      dispose = rootDispose
      controller = useDryVoiceCapture({ consumerId: 'guided-test' })
    })

    await controller.start()
    vi.advanceTimersByTime(3000)
    await controller.stop()
    const context = BufferPreviewAudioContext.instances[0]!

    controller.togglePreview()
    expect(controller.previewPlaying()).toBe(true)
    expect(PreviewAudio.instances).toHaveLength(0)
    expect(context.sources[0]?.start).toHaveBeenCalledWith(0, 0)
    expect(context.gain.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      1,
      0.09,
    )

    expect(controller.seekPreview(1.5)).toBe(true)
    expect(controller.previewCurrentTimeMs()).toBe(1500)
    vi.advanceTimersByTime(20)
    expect(context.sources[0]?.stop).toHaveBeenCalledOnce()
    expect(context.sources[1]?.start).toHaveBeenCalledWith(0, 1.5)
    expect(context.gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0,
      0.015,
    )
    expect(context.gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      1,
      0.015,
    )

    controller.togglePreview()
    expect(controller.previewPlaying()).toBe(false)
    expect(context.gain.gain.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.036)
    vi.advanceTimersByTime(240)
    expect(context.sources[1]?.stop).toHaveBeenCalledOnce()
    expect(context.close).not.toHaveBeenCalled()

    controller.discard()
    expect(context.close).toHaveBeenCalledOnce()
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

  it('resumes analysis again after a delayed iOS permission prompt', async () => {
    vi.stubGlobal(
      'AudioContext',
      BufferPreviewAudioContext as unknown as typeof AudioContext,
    )
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
    await Promise.resolve()
    const context = BufferPreviewAudioContext.instances[0]!
    context.state = 'suspended'
    resolveAcquire(new CaptureStream(captureTrack) as unknown as MediaStream)

    await expect(starting).resolves.toBe(true)
    expect(context.resume).toHaveBeenCalledOnce()
    expect(createF0StreamMock).toHaveBeenCalledWith(
      context,
      expect.any(CaptureStream),
    )
    expect(controller.state()).toBe('recording')
  })

  it('resumes an interrupted iOS analysis context after permission', async () => {
    vi.stubGlobal(
      'AudioContext',
      BufferPreviewAudioContext as unknown as typeof AudioContext,
    )
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
    await Promise.resolve()
    const context = BufferPreviewAudioContext.instances[0]!
    ;(context as unknown as AudioContext & { state: string }).state =
      'interrupted'
    resolveAcquire(new CaptureStream(captureTrack) as unknown as MediaStream)

    await expect(starting).resolves.toBe(true)
    expect(context.resume).toHaveBeenCalledOnce()
    expect(createF0StreamMock).toHaveBeenCalledWith(
      context,
      expect.any(CaptureStream),
    )
    expect(controller.state()).toBe('recording')
  })

  it('starts recording while an iOS analysis resume remains pending', async () => {
    vi.stubGlobal(
      'AudioContext',
      BufferPreviewAudioContext as unknown as typeof AudioContext,
    )
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
    await Promise.resolve()
    const context = BufferPreviewAudioContext.instances[0]!
    context.state = 'suspended'
    context.resume.mockReturnValueOnce(new Promise<void>(() => {}))
    resolveAcquire(new CaptureStream(captureTrack) as unknown as MediaStream)

    await expect(starting).resolves.toBe(true)
    expect(recorderStartMock).toHaveBeenCalledOnce()
    expect(createF0StreamMock).toHaveBeenCalledWith(
      context,
      expect.any(CaptureStream),
    )
    expect(controller.state()).toBe('recording')
  })

  it('keeps recording when the post-permission analysis resume is rejected', async () => {
    vi.stubGlobal(
      'AudioContext',
      BufferPreviewAudioContext as unknown as typeof AudioContext,
    )
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
    await Promise.resolve()
    const context = BufferPreviewAudioContext.instances[0]!
    context.state = 'suspended'
    context.resume.mockRejectedValueOnce(new Error('gesture expired'))
    resolveAcquire(new CaptureStream(captureTrack) as unknown as MediaStream)

    await expect(starting).resolves.toBe(true)
    expect(recorderStartMock).toHaveBeenCalledOnce()
    expect(controller.state()).toBe('recording')
  })
})
