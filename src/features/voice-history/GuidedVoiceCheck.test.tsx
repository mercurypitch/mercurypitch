// ============================================================
// Guided Voice Check tests — comfort gate before local capture
// ============================================================

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPitchCentrePilotProtocol } from '@/lib/guided-voice'
import { playReferenceTone } from '@/lib/reference-tone'
import type { GuidedCloseRequester } from './GuidedVoiceCheck'
import { GuidedVoiceCheck } from './GuidedVoiceCheck'
import type { DryVoiceCaptureController, DryVoiceCaptureResult, DryVoiceCaptureState, } from './useDryVoiceCapture'

const { useDryVoiceCaptureMock } = vi.hoisted(() => ({
  useDryVoiceCaptureMock: vi.fn(),
}))

vi.mock('@/lib/use-viewport', () => ({
  isNarrow: () => false,
}))
vi.mock('@/lib/reference-tone', () => ({
  playReferenceTone: vi.fn(async () => undefined),
}))
vi.mock('./useDryVoiceCapture', () => ({
  useDryVoiceCapture: useDryVoiceCaptureMock,
}))

function captureController(): DryVoiceCaptureController {
  return {
    state: () => 'idle',
    capture: () => null,
    elapsedMs: () => 0,
    message: () => null,
    previewUrl: () => null,
    previewPlaying: () => false,
    previewProgress: () => 0,
    previewCurrentTimeMs: () => 0,
    previewDurationMs: () => 0,
    latestFrame: () => null,
    latestSmoothedFrame: () => null,
    latestLevel: () => 0,
    maxLevel: () => 0,
    start: vi.fn(async () => false),
    pauseSegment: vi.fn(async () => null),
    resumeSegment: vi.fn(async () => false),
    stop: vi.fn(async () => null),
    togglePreview: vi.fn(),
    seekPreview: vi.fn(() => false),
    discard: vi.fn(),
  }
}

function capturedTake(): DryVoiceCaptureResult {
  return {
    blob: new Blob(['guided take'], { type: 'audio/webm' }),
    durationMs: 1_200,
    peaks: new Float32Array([0.2, 0.4, 0.3]),
    capturedAt: '2026-08-28T00:00:00.000Z',
    frames: [],
    segments: [],
    peakAmplitude: 0.4,
    pitchAnalysisAvailable: true,
    microphoneContinuous: true,
    sampleRateHz: 48_000,
  }
}

describe('GuidedVoiceCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useDryVoiceCaptureMock.mockReturnValue(captureController())
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('requires explicit comfort confirmation before offering capture setup', () => {
    render(() => <GuidedVoiceCheck onClose={vi.fn()} onKept={vi.fn()} />)

    expect(
      screen.getByRole('heading', { name: 'Find one focus you can hear.' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Start three landings' }),
    ).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Check comfort and begin' }),
    )
    expect(
      screen.getByRole('heading', {
        name: 'Does singing feel comfortable today?',
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Start three landings' }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Yes, continue' }))
    expect(
      screen.getByRole('heading', {
        name: 'Three notes, centred where you are comfortable.',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Start three landings' }),
    ).toBeDisabled()
  })

  it('stops before capture when singing does not feel comfortable', () => {
    const onClose = vi.fn()
    render(() => <GuidedVoiceCheck onClose={onClose} onKept={vi.fn()} />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Check comfort and begin' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Not today' }))

    expect(
      screen.getByRole('heading', {
        name: 'Do not push through discomfort.',
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Start three landings' }),
    ).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Return to Hear Yourself' }),
    )
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('moves focus into each newly presented guidance stage', async () => {
    render(() => <GuidedVoiceCheck onClose={vi.fn()} onKept={vi.fn()} />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Check comfort and begin' }),
    )

    const comfortHeading = screen.getByRole('heading', {
      name: 'Does singing feel comfortable today?',
    })
    const guidance = comfortHeading.closest('[aria-label$="guidance"]')
    expect(guidance).not.toBeNull()
    await waitFor(() => expect(guidance).toHaveFocus())

    fireEvent.click(screen.getByRole('button', { name: 'Yes, continue' }))
    expect(
      screen.getByRole('heading', {
        name: 'Three notes, centred where you are comfortable.',
      }),
    ).toBeInTheDocument()
    await waitFor(() => expect(guidance).toHaveFocus())
  })

  it('keeps the rehearsal recording paused through the breathe count-in', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'AudioContext',
      class FakeAudioContext {
        readonly state: AudioContextState = 'running'
        readonly resume = vi.fn(async () => undefined)
        readonly close = vi.fn(async () => undefined)
      },
    )

    const controller = captureController()
    controller.start = vi.fn(async () => true)
    controller.resumeSegment = vi.fn(async () => true)
    controller.pauseSegment = vi.fn(async () => ({
      index: 0,
      audioOffsetMs: 0,
      durationMs: 1_800,
      frames: [],
    }))
    useDryVoiceCaptureMock.mockReturnValue(controller)
    render(() => <GuidedVoiceCheck onClose={vi.fn()} onKept={vi.fn()} />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Check comfort and begin' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Yes, continue' }))
    fireEvent.click(screen.getByRole('button', { name: 'Try one landing' }))
    await vi.advanceTimersByTimeAsync(0)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Breathe — your turn in 2 seconds',
    )
    expect(controller.resumeSegment).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1_000)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Breathe — your turn in 1 second',
    )
    expect(controller.resumeSegment).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(999)
    expect(controller.resumeSegment).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(controller.resumeSegment).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Recording now')).toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(1_800)
    expect(controller.pauseSegment).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Rehearsal complete\./)).toBeInTheDocument()
  })

  it('cancels the pending breathe count-in when rehearsal is closed', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'AudioContext',
      class FakeAudioContext {
        readonly state: AudioContextState = 'running'
        readonly resume = vi.fn(async () => undefined)
        readonly close = vi.fn(async () => undefined)
      },
    )

    const controller = captureController()
    controller.start = vi.fn(async () => true)
    controller.resumeSegment = vi.fn(async () => true)
    useDryVoiceCaptureMock.mockReturnValue(controller)
    const onClose = vi.fn()
    render(() => <GuidedVoiceCheck onClose={onClose} onKept={vi.fn()} />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Check comfort and begin' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Yes, continue' }))
    fireEvent.click(screen.getByRole('button', { name: 'Try one landing' }))
    await vi.advanceTimersByTimeAsync(0)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Breathe — your turn in 2 seconds',
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Close guided voice check' }),
    )
    await vi.advanceTimersByTimeAsync(5_000)

    expect(controller.resumeSegment).not.toHaveBeenCalled()
    expect(controller.discard).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps the next measured landing behind the full rest and breathe cadence', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'AudioContext',
      class FakeAudioContext {
        readonly state: AudioContextState = 'running'
        readonly resume = vi.fn(async () => undefined)
        readonly close = vi.fn(async () => undefined)
      },
    )

    const controller = captureController()
    controller.start = vi.fn(async () => true)
    controller.resumeSegment = vi.fn(async () => true)
    controller.pauseSegment = vi.fn(async () => ({
      index: 0,
      audioOffsetMs: 0,
      durationMs: 1_900,
      frames: [],
    }))
    useDryVoiceCaptureMock.mockReturnValue(controller)
    render(() => <GuidedVoiceCheck onClose={vi.fn()} onKept={vi.fn()} />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Check comfort and begin' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Yes, continue' }))
    fireEvent.click(screen.getByRole('button', { name: 'Try one landing' }))
    await vi.advanceTimersByTimeAsync(3_800)

    vi.mocked(playReferenceTone).mockClear()
    vi.mocked(controller.resumeSegment).mockClear()
    vi.mocked(controller.pauseSegment).mockClear()
    fireEvent.click(
      screen.getByRole('button', { name: 'Start three landings' }),
    )
    await vi.advanceTimersByTimeAsync(2_000)
    expect(controller.resumeSegment).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1_900)
    expect(controller.pauseSegment).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Rest — next note in 2 seconds',
    )

    await vi.advanceTimersByTimeAsync(1_000)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Rest — next note in 1 second',
    )

    await vi.advanceTimersByTimeAsync(999)
    expect(playReferenceTone).toHaveBeenCalledTimes(1)
    expect(controller.resumeSegment).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(playReferenceTone).toHaveBeenCalledTimes(2)
    expect(controller.resumeSegment).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Breathe — your turn in 2 seconds',
    )

    await vi.advanceTimersByTimeAsync(1_999)
    expect(controller.resumeSegment).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(controller.resumeSegment).toHaveBeenCalledTimes(2)
  })

  it('locks the complete task when returning for a matched retake', () => {
    const initialProtocol = createPitchCentrePilotProtocol({
      comfortableRangeMidiCents: [5_700, 7_300],
      preferredMidiCents: 6_900,
    })
    render(() => (
      <GuidedVoiceCheck
        initialProtocol={initialProtocol}
        returningFromPractice
        onClose={vi.fn()}
        onKept={vi.fn()}
      />
    ))

    fireEvent.click(
      screen.getByRole('button', { name: 'Check comfort and begin' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Yes, continue' }))

    expect(screen.getByText('Matched route locked')).toBeInTheDocument()
    expect(
      screen.getByText(
        'The same notes and recorded 1.8-second windows keep this take a fair comparison.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: 'Move the Pitch Centre route one semitone lower',
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: 'Move the Pitch Centre route one semitone higher',
      }),
    ).not.toBeInTheDocument()
    expect(initialProtocol.comparisonFingerprint).toContain('pitch-centre')
  })

  it.each(['recording', 'paused'] as const)(
    'stops an active %s capture into review without discarding it on Cancel',
    async (initialState) => {
      let captureState: DryVoiceCaptureState = initialState
      const controller = captureController()
      controller.state = () => captureState
      controller.stop = vi.fn(async () => {
        captureState = 'ready'
        return capturedTake()
      })
      useDryVoiceCaptureMock.mockReturnValue(controller)
      render(() => <GuidedVoiceCheck onClose={vi.fn()} onKept={vi.fn()} />)

      fireEvent.click(
        screen.getByRole('button', { name: 'Close guided voice check' }),
      )

      expect(controller.stop).toHaveBeenCalledTimes(1)
      expect(
        await screen.findByRole('heading', {
          name: 'Discard this temporary take?',
        }),
      ).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(controller.discard).not.toHaveBeenCalled()
      expect(
        screen.getByRole('heading', { name: 'How did that feel?' }),
      ).toBeInTheDocument()
    },
  )

  it('aborts a capture that is still starting without claiming audio was discarded', () => {
    const controller = captureController()
    controller.state = () => 'starting'
    useDryVoiceCaptureMock.mockReturnValue(controller)
    const onClose = vi.fn()
    const onResolved = vi.fn()
    const onCloseRequestReady = vi.fn()
    render(() => (
      <GuidedVoiceCheck
        onClose={onClose}
        onCloseRequestReady={onCloseRequestReady}
        onKept={vi.fn()}
      />
    ))

    const requestClose = onCloseRequestReady.mock.calls[0]?.[0] as
      | GuidedCloseRequester
      | undefined
    requestClose?.(onResolved)

    expect(controller.stop).not.toHaveBeenCalled()
    expect(controller.discard).toHaveBeenCalledTimes(1)
    expect(onResolved).toHaveBeenCalledWith(true)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByRole('heading', {
        name: 'Discard this temporary take?',
      }),
    ).not.toBeInTheDocument()
  })

  it('lets external navigation use the same lossless discard confirmation', async () => {
    let captureState: DryVoiceCaptureState = 'recording'
    const controller = captureController()
    controller.state = () => captureState
    controller.stop = vi.fn(async () => {
      captureState = 'ready'
      return capturedTake()
    })
    useDryVoiceCaptureMock.mockReturnValue(controller)
    const onClose = vi.fn()
    const onResolved = vi.fn()
    const onCloseRequestReady = vi.fn()
    render(() => (
      <GuidedVoiceCheck
        onClose={onClose}
        onCloseRequestReady={onCloseRequestReady}
        onKept={vi.fn()}
      />
    ))

    const requestClose = onCloseRequestReady.mock.calls[0]?.[0] as
      | GuidedCloseRequester
      | undefined
    expect(requestClose).toBeDefined()
    requestClose?.(onResolved)
    expect(
      await screen.findByRole('heading', {
        name: 'Discard this temporary take?',
      }),
    ).toBeInTheDocument()
    expect(controller.stop).toHaveBeenCalledTimes(1)
    expect(controller.discard).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onResolved).toHaveBeenLastCalledWith(false)
    expect(onClose).not.toHaveBeenCalled()
    expect(controller.discard).not.toHaveBeenCalled()

    requestClose?.(onResolved)
    fireEvent.click(await screen.findByRole('button', { name: 'Discard take' }))
    expect(onResolved).toHaveBeenLastCalledWith(true)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(controller.discard).toHaveBeenCalledTimes(1)
  })

  it('waits for an in-flight finalization before offering to discard its result', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'AudioContext',
      class FakeAudioContext {
        readonly state: AudioContextState = 'running'
        readonly resume = vi.fn(async () => undefined)
        readonly close = vi.fn(async () => undefined)
      },
    )

    let resolveStop: (result: DryVoiceCaptureResult | null) => void = () =>
      undefined
    const pendingStop = new Promise<DryVoiceCaptureResult | null>((resolve) => {
      resolveStop = resolve
    })
    let captureState: DryVoiceCaptureState = 'idle'
    const controller = captureController()
    controller.state = () => captureState
    controller.start = vi.fn(async () => {
      captureState = 'paused'
      return true
    })
    controller.resumeSegment = vi.fn(async () => {
      captureState = 'recording'
      return true
    })
    controller.pauseSegment = vi.fn(async () => {
      captureState = 'paused'
      return {
        index: 0,
        audioOffsetMs: 0,
        durationMs: 900,
        frames: [],
      }
    })
    controller.stop = vi.fn(() => {
      captureState = 'processing'
      return pendingStop
    })
    useDryVoiceCaptureMock.mockReturnValue(controller)

    const onClose = vi.fn()
    const onResolved = vi.fn()
    const onCloseRequestReady = vi.fn()
    render(() => (
      <GuidedVoiceCheck
        onClose={onClose}
        onCloseRequestReady={onCloseRequestReady}
        onKept={vi.fn()}
      />
    ))

    fireEvent.click(
      screen.getByRole('button', { name: 'Check comfort and begin' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Yes, continue' }))
    fireEvent.click(screen.getByRole('button', { name: 'Try one landing' }))
    await vi.runAllTimersAsync()

    fireEvent.click(
      screen.getByRole('button', { name: 'Start three landings' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Stop check' }))
    expect(controller.stop).toHaveBeenCalledTimes(1)
    expect(captureState).toBe('processing')

    vi.mocked(controller.discard).mockClear()
    const requestClose = onCloseRequestReady.mock.calls[0]?.[0] as
      | GuidedCloseRequester
      | undefined
    requestClose?.(onResolved)

    expect(controller.discard).not.toHaveBeenCalled()
    expect(onResolved).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('heading', {
        name: 'Discard this temporary take?',
      }),
    ).not.toBeInTheDocument()

    resolveStop(capturedTake())
    await vi.runAllTimersAsync()

    expect(
      screen.getByRole('heading', { name: 'Discard this temporary take?' }),
    ).toBeInTheDocument()
    expect(controller.discard).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onResolved).toHaveBeenCalledWith(false)
    expect(onClose).not.toHaveBeenCalled()
    expect(controller.discard).not.toHaveBeenCalled()
    expect(
      screen.getByRole('heading', { name: 'How did that feel?' }),
    ).toBeInTheDocument()
  })
})
