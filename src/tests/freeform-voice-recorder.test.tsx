import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FreeformVoiceRecorder } from '@/features/voice-history/FreeformVoiceRecorder'

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
vi.mock('@/features/voice-history/freeform-voice-take', () => ({
  keepFreeformVoiceTake: keepMock,
}))
vi.mock('@/lib/analytics', () => ({ trackEvent: trackMock }))

const target = {
  comparisonKey: 'freeform:test-thread:v1',
  title: '',
}

function renderRecorder() {
  const onClose = vi.fn()
  const onKept = vi.fn().mockResolvedValue(undefined)
  const onStartNewThread = vi.fn()
  render(() => (
    <FreeformVoiceRecorder
      target={target}
      onClose={onClose}
      onKept={onKept}
      onStartNewThread={onStartNewThread}
    />
  ))
  return { onClose, onKept, onStartNewThread }
}

describe('FreeformVoiceRecorder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    registerIndicatorMock.mockReturnValue(unregisterMock)
    acquireMock.mockResolvedValue({ getTracks: () => [] })
    stopMock.mockResolvedValue(new Blob(['voice'], { type: 'audio/webm' }))
    createRecorderMock.mockReturnValue({
      start: startMock,
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

  afterEach(() => cleanup())

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

  it('discards an active temporary take and releases the shared mic on close', async () => {
    const { onClose } = renderRecorder()
    fireEvent.input(screen.getByLabelText(/what do you want to repeat/i), {
      target: { value: 'First chorus after warm-up' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
    await waitFor(() => expect(startMock).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Close recorder' }))

    expect(discardMock).toHaveBeenCalled()
    expect(disposeMock).toHaveBeenCalled()
    expect(releaseMock).toHaveBeenCalledWith('voice-history-freeform')
    expect(onClose).toHaveBeenCalled()
    expect(keepMock).not.toHaveBeenCalled()
  })

  it('registers its recording state with the microphone sentinel', () => {
    renderRecorder()

    expect(registerIndicatorMock).toHaveBeenCalledWith(
      'voice-history-freeform',
      expect.any(Function),
      expect.any(Function),
    )
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
