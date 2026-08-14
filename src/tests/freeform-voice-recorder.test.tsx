import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FreeformRecorderCloseRequester } from '@/features/voice-history/FreeformVoiceRecorder'
import { drainPitchStream, FreeformVoiceRecorder, } from '@/features/voice-history/FreeformVoiceRecorder'

const {
  acquireMock,
  createRecorderMock,
  discardMock,
  disposeMock,
  inspectMock,
  keepMock,
  registerIndicatorMock,
  releaseMock,
  startMock,
  stopMock,
  trackMock,
  unregisterMock,
} = vi.hoisted(() => ({
  acquireMock: vi.fn(),
  createRecorderMock: vi.fn(),
  discardMock: vi.fn(),
  disposeMock: vi.fn(),
  inspectMock: vi.fn(),
  keepMock: vi.fn(),
  registerIndicatorMock: vi.fn(),
  releaseMock: vi.fn(),
  startMock: vi.fn(),
  stopMock: vi.fn(),
  trackMock: vi.fn(),
  unregisterMock: vi.fn(),
}))

vi.mock('@/lib/mic-manager', () => ({
  micManager: {
    acquire: acquireMock,
    release: releaseMock,
  },
}))
vi.mock('@/lib/mic-sentinel', () => ({
  registerMicIndicator: registerIndicatorMock,
}))
vi.mock('@/lib/voice-capture', () => ({
  createTakeRecorder: createRecorderMock,
  inspectVoiceTake: inspectMock,
}))
vi.mock('@/lib/pitch-f0-stream', () => ({
  createF0Stream: vi.fn(() => ({
    startTask: vi.fn(),
    takeFrames: vi.fn(() => []),
    latest: vi.fn(() => null),
    latestSmoothed: vi.fn(() => null),
    latestLevel: vi.fn(() => 0),
    maxLevel: vi.fn(() => 0),
    dispose: vi.fn(),
  })),
}))
vi.mock('@/features/voice-history/freeform-voice-take', () => ({
  keepFreeformVoiceTake: keepMock,
}))
vi.mock('@/lib/analytics', () => ({ trackEvent: trackMock }))

const target = {
  comparisonKey: 'freeform:test-thread:v1',
  title: '',
}
const originalScrollIntoView = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'scrollIntoView',
)

class TestAudioTrack extends EventTarget {
  readyState: MediaStreamTrackState = 'live'
  muted = false
}

class TestAudioStream extends EventTarget {
  private readonly track = new TestAudioTrack()

  getAudioTracks(): MediaStreamTrack[] {
    return [this.track as unknown as MediaStreamTrack]
  }

  getTracks(): MediaStreamTrack[] {
    return this.getAudioTracks()
  }
}

function testAudioStream(): MediaStream {
  return new TestAudioStream() as unknown as MediaStream
}

function renderRecorder() {
  const onClose = vi.fn()
  const onKept = vi.fn().mockResolvedValue(undefined)
  const onStartNewThread = vi.fn()
  const rendered = render(() => (
    <FreeformVoiceRecorder
      target={target}
      onClose={onClose}
      onKept={onKept}
      onStartNewThread={onStartNewThread}
    />
  ))
  return { unmount: rendered.unmount, onClose, onKept, onStartNewThread }
}

describe('FreeformVoiceRecorder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    registerIndicatorMock.mockReturnValue(unregisterMock)
    acquireMock.mockResolvedValue(testAudioStream())
    stopMock.mockResolvedValue(new Blob(['voice'], { type: 'audio/webm' }))
    createRecorderMock.mockReturnValue({
      start: startMock,
      pause: vi.fn().mockReturnValue(true),
      resume: vi.fn().mockReturnValue(true),
      stop: stopMock,
      discard: discardMock,
      dispose: disposeMock,
    })
    inspectMock.mockResolvedValue({
      durationMs: 4200,
      peaks: new Float32Array([0.2, 0.8]),
    })
    keepMock.mockResolvedValue({
      ok: true,
      quotaExceeded: false,
      roomAvailable: true,
      value: {},
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    if (originalScrollIntoView === undefined) {
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
    } else {
      Object.defineProperty(
        Element.prototype,
        'scrollIntoView',
        originalScrollIntoView,
      )
    }
  })

  it('moves focus into a newly opened recorder', async () => {
    renderRecorder()

    await waitFor(() =>
      expect(
        screen.getByLabelText(/what do you want to repeat/i),
      ).toHaveFocus(),
    )
  })

  it('requires a named repeatable prompt before opening the microphone', async () => {
    renderRecorder()

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
    expect(acquireMock).not.toHaveBeenCalled()

    fireEvent.input(screen.getByLabelText(/what do you want to repeat/i), {
      target: { value: 'First chorus after warm-up' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))

    await waitFor(() => expect(acquireMock).toHaveBeenCalled())
    expect(startMock).toHaveBeenCalled()
    expect(keepMock).not.toHaveBeenCalled()
  })

  it('reveals the live canvas and moves focus to Stop when recording begins', async () => {
    const scheduledFrames: FrameRequestCallback[] = []
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    vi.stubGlobal(
      'requestAnimationFrame',
      (callback: FrameRequestCallback): number => {
        scheduledFrames.push(callback)
        return scheduledFrames.length
      },
    )
    renderRecorder()
    fireEvent.input(screen.getByLabelText(/what do you want to repeat/i), {
      target: { value: 'First chorus after warm-up' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
    const stop = await screen.findByRole('button', { name: 'Stop recording' })
    const pendingFrames = scheduledFrames.splice(0)
    pendingFrames.forEach((callback) => callback(0))

    expect(stop).toHaveFocus()
    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ block: 'center' }),
    )
  })

  it('drains the raw contour exactly once before stream teardown', () => {
    const takeFrames = vi.fn().mockReturnValue([
      { t: 0, f0: 440, conf: 0.9, rms: 0.25 },
      { t: 0.05, f0: 0, conf: 0, rms: 0.1 },
    ])
    const dispose = vi.fn()
    const stream = {
      takeFrames,
      dispose,
    } as unknown as Parameters<typeof drainPitchStream>[0]

    expect(drainPitchStream(stream)).toEqual([
      { t: 0, f0: 440, conf: 0.9, rms: 0.25 },
      { t: 0.05, f0: 0, conf: 0, rms: 0.1 },
    ])
    expect(takeFrames).toHaveBeenCalledOnce()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('stops an active take and confirms before discarding it on close', async () => {
    const { onClose } = renderRecorder()
    fireEvent.input(screen.getByLabelText(/what do you want to repeat/i), {
      target: { value: 'First chorus after warm-up' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
    await waitFor(() => expect(startMock).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Close recorder' }))

    await screen.findByRole('heading', {
      name: 'Discard this temporary take?',
    })
    expect(stopMock).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Play replay' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Close recorder' }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard take' }))

    expect(disposeMock).toHaveBeenCalled()
    expect(releaseMock).toHaveBeenCalledWith(
      expect.stringMatching(/^voice-history-freeform:/),
    )
    expect(onClose).toHaveBeenCalled()
    expect(
      screen.queryByRole('button', { name: 'Play replay' }),
    ).not.toBeInTheDocument()
    expect(keepMock).not.toHaveBeenCalled()
  })

  it('lets external navigation close a title-only draft without a dialog', () => {
    const onClose = vi.fn()
    const onResolved = vi.fn()
    const onCloseRequestReady = vi.fn()
    render(() => (
      <FreeformVoiceRecorder
        target={target}
        initialDraftTitle="Unfinished chorus"
        onClose={onClose}
        onCloseRequestReady={onCloseRequestReady}
        onKept={vi.fn()}
        onStartNewThread={vi.fn()}
      />
    ))
    const requestClose = onCloseRequestReady.mock.calls[0]?.[0] as
      | FreeformRecorderCloseRequester
      | undefined

    requestClose?.(onResolved)

    expect(onResolved).toHaveBeenCalledWith(true)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('registers its recording state with the microphone sentinel', () => {
    renderRecorder()

    expect(registerIndicatorMock).toHaveBeenCalledWith(
      expect.stringMatching(/^voice-history-freeform:/),
      expect.any(Function),
      expect.any(Function),
    )
  })

  it('reports the microphone off while a stopped take is being prepared', async () => {
    let resolveStop: ((blob: Blob | null) => void) | undefined
    stopMock.mockReturnValue(
      new Promise<Blob | null>((resolve) => {
        resolveStop = resolve
      }),
    )
    const originalSetTimeout = globalThis.setTimeout
    let stopAtLimit: (() => void) | undefined
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
      callback: TimerHandler,
      delay?: number,
      ...args: unknown[]
    ) => {
      if (delay === 5 * 60 * 1000 && typeof callback === 'function') {
        stopAtLimit = () => callback(...args)
        return 1
      }
      return originalSetTimeout(callback, delay, ...args)
    }) as typeof setTimeout)
    renderRecorder()
    fireEvent.input(screen.getByLabelText(/what do you want to repeat/i), {
      target: { value: 'First chorus after warm-up' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
    await waitFor(() => expect(startMock).toHaveBeenCalled())

    const micIsOn = registerIndicatorMock.mock.calls[0]?.[1] as () => boolean
    expect(micIsOn()).toBe(true)

    stopAtLimit?.()
    expect(micIsOn()).toBe(false)
    resolveStop?.(new Blob(['voice'], { type: 'audio/webm' }))
    timeoutSpy.mockRestore()
  })

  it('uses a distinct microphone lease after the recorder is reopened', async () => {
    let resolveFirstAcquire: ((stream: MediaStream) => void) | undefined
    acquireMock
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirstAcquire = resolve
        }),
      )
      .mockResolvedValueOnce(testAudioStream())

    const first = renderRecorder()
    fireEvent.input(screen.getByLabelText(/what do you want to repeat/i), {
      target: { value: 'First chorus after warm-up' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
    await waitFor(() => expect(acquireMock).toHaveBeenCalledTimes(1))
    const firstLease = acquireMock.mock.calls[0]?.[0] as string
    fireEvent.click(screen.getByRole('button', { name: 'Close recorder' }))
    first.unmount()

    renderRecorder()
    fireEvent.input(screen.getByLabelText(/what do you want to repeat/i), {
      target: { value: 'Second chorus after warm-up' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
    await waitFor(() => expect(startMock).toHaveBeenCalled())
    const secondLease = acquireMock.mock.calls[1]?.[0] as string

    expect(secondLease).not.toBe(firstLease)
    const firstReleasesBefore = releaseMock.mock.calls.filter(
      ([lease]) => lease === firstLease,
    ).length
    const secondReleasesBefore = releaseMock.mock.calls.filter(
      ([lease]) => lease === secondLease,
    ).length

    resolveFirstAcquire?.(testAudioStream())
    await waitFor(() =>
      expect(
        releaseMock.mock.calls.filter(([lease]) => lease === firstLease).length,
      ).toBeGreaterThan(firstReleasesBefore),
    )
    expect(
      releaseMock.mock.calls.filter(([lease]) => lease === secondLease),
    ).toHaveLength(secondReleasesBefore)
  })

  it('offers a different thread while adding to an existing one', () => {
    const onStartNewThread = vi.fn()
    render(() => (
      <FreeformVoiceRecorder
        target={{ ...target, title: 'Heaven Can Wait' }}
        onClose={vi.fn()}
        onKept={vi.fn()}
        onStartNewThread={onStartNewThread}
      />
    ))

    fireEvent.click(
      screen.getByRole('button', { name: 'Start a different thread' }),
    )

    expect(onStartNewThread).toHaveBeenCalledTimes(1)
  })
})
