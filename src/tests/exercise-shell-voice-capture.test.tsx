import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExerciseShell } from '@/features/exercises/ExerciseShell'
import type { ExerciseSessionVoiceTake, ExerciseVoiceCaptureController, ExerciseVoiceCaptureState, } from '@/features/exercises/use-base-exercise'
import { isLocalSaveNavigationLocked } from '@/lib/local-save-navigation-lock'
import { encodeVoiceAtlasContour } from '@/lib/voice-contour'

const { keepMock, notificationMock, trackMock } = vi.hoisted(() => ({
  keepMock: vi.fn(),
  notificationMock: vi.fn(),
  trackMock: vi.fn(),
}))

vi.mock('@/features/exercises/exercise-voice-take', () => ({
  keepExerciseVoiceTake: keepMock,
}))
vi.mock('@/stores/notifications-store', () => ({
  showNotification: notificationMock,
}))
vi.mock('@/lib/analytics', () => ({ trackEvent: trackMock }))

function makeVoiceTake(): ExerciseSessionVoiceTake {
  return {
    blob: new Blob(['voice'], { type: 'audio/webm' }),
    durationMs: 4200,
    peaks: new Float32Array([0.2, 0.8]),
    capturedAt: '2026-08-01T12:00:00.000Z',
    contour: encodeVoiceAtlasContour([], { source: 'practice-engine-v1' }),
    config: { type: 'long-note' as const, targetNote: 'A3' },
    result: {
      type: 'long-note' as const,
      score: 84,
      metrics: { steadyZonePct: 78 },
      completedAt: Date.UTC(2026, 7, 1, 12),
    },
  }
}

function renderCompleteCapture(
  onTryAgain: () => void = () => {},
  onBack: () => void = () => {},
) {
  const voiceTake = makeVoiceTake()
  let discardCalls = 0

  const Harness = () => {
    const [captureState] = createSignal<ExerciseVoiceCaptureState>('ready')
    const [take] = createSignal<ExerciseSessionVoiceTake | null>(voiceTake)
    const discard = () => {
      discardCalls += 1
    }
    const voiceCapture: ExerciseVoiceCaptureController = {
      state: captureState,
      take,
      awaitOutcome: async () => ({ state: 'ready', take: voiceTake }),
      discard,
    }

    return (
      <ExerciseShell
        type="long-note"
        title="Long Note Practice"
        status={() => 'complete'}
        currentScore={() => 84}
        resultScore={() => 84}
        voiceCapture={voiceCapture}
        onBack={onBack}
        onStart={() => {}}
        activeContent={<div>active</div>}
        onStop={() => {}}
        resultSummary={<>Steady zone 78%</>}
        onTryAgain={onTryAgain}
        onChangeTarget={() => {}}
      />
    )
  }

  render(() => <Harness />)

  return { discardCalls: () => discardCalls, take: voiceTake }
}

describe('ExerciseShell voice capture', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('keeps a completed run only after the explicit action', async () => {
    keepMock.mockResolvedValue({
      ok: true,
      quotaExceeded: false,
      roomAvailable: true,
      value: {},
    })
    const { take } = renderCompleteCapture()

    expect(screen.getByText(/stays temporary/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep Take' }))

    await waitFor(() =>
      expect(keepMock).toHaveBeenCalledWith({
        exerciseTitle: 'Long Note Practice',
        take,
      }),
    )
    expect(trackMock).toHaveBeenNthCalledWith(1, 'voice_keep_attempt')
    expect(trackMock).toHaveBeenNthCalledWith(2, 'voice_keep_success')
  })

  it('discards the temporary replay without changing the score', () => {
    const { discardCalls } = renderCompleteCapture()

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))

    expect(discardCalls()).toBe(1)
    expect(screen.getByText('84%')).toBeInTheDocument()
  })

  it('leaves Space with the Keep and Discard actions', async () => {
    const onTryAgain = vi.fn()
    renderCompleteCapture(onTryAgain)
    await Promise.resolve()

    for (const name of ['Keep Take', 'Discard']) {
      const action = screen.getByRole('button', { name })
      action.focus()
      const space = new KeyboardEvent('keydown', {
        key: ' ',
        code: 'Space',
        bubbles: true,
        cancelable: true,
      })

      action.dispatchEvent(space)

      expect(space.defaultPrevented).toBe(false)
      expect(onTryAgain).not.toHaveBeenCalled()
    }

    const shellSpace = new KeyboardEvent('keydown', {
      key: ' ',
      code: 'Space',
      bubbles: true,
      cancelable: true,
    })
    screen.getByRole('button', { name: 'Try Again' }).dispatchEvent(shellSpace)

    expect(shellSpace.defaultPrevented).toBe(true)
    expect(onTryAgain).toHaveBeenCalledOnce()
  })

  it('blocks restart, back, and discard until a failed Keep offers Retry', async () => {
    let resolveKeep!: (result: {
      ok: boolean
      quotaExceeded: boolean
      roomAvailable: boolean
      value: object | null
    }) => void
    keepMock.mockReturnValue(
      new Promise((resolve) => {
        resolveKeep = resolve
      }),
    )
    const onTryAgain = vi.fn()
    const onBack = vi.fn()
    const { discardCalls } = renderCompleteCapture(onTryAgain, onBack)

    fireEvent.click(screen.getByRole('button', { name: 'Keep Take' }))
    expect(isLocalSaveNavigationLocked()).toBe(true)
    for (const name of ['Saving', 'Discard', 'Try Again', /Back/]) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))
    fireEvent.click(screen.getByRole('button', { name: /Back/ }))
    expect(discardCalls()).toBe(0)
    expect(onTryAgain).not.toHaveBeenCalled()
    expect(onBack).not.toHaveBeenCalled()

    resolveKeep({
      ok: false,
      quotaExceeded: false,
      roomAvailable: true,
      value: null,
    })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Retry Keep' })).toBeEnabled(),
    )
    expect(isLocalSaveNavigationLocked()).toBe(false)
    expect(
      screen.getByText(/temporary replay is still available/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Discard' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Back/ })).toBeEnabled()
  })

  it('does not show stale success copy after an external run transition', async () => {
    let resolveKeep!: (result: {
      ok: boolean
      quotaExceeded: boolean
      roomAvailable: boolean
      value: object
    }) => void
    keepMock.mockReturnValue(
      new Promise((resolve) => {
        resolveKeep = resolve
      }),
    )
    const voiceTake = makeVoiceTake()
    const [status, setStatus] = createSignal<'active' | 'complete'>('complete')
    const voiceCapture: ExerciseVoiceCaptureController = {
      state: () => 'ready',
      take: () => voiceTake,
      awaitOutcome: async () => ({ state: 'ready', take: voiceTake }),
      discard: vi.fn(),
    }
    render(() => (
      <ExerciseShell
        type="long-note"
        title="Long Note Practice"
        status={status}
        currentScore={() => 84}
        resultScore={() => 84}
        voiceCapture={voiceCapture}
        onBack={() => {}}
        onStart={() => {}}
        activeContent={<div>active</div>}
        onStop={() => {}}
        resultSummary={<>Steady zone 78%</>}
        onTryAgain={() => {}}
        onChangeTarget={() => {}}
      />
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Keep Take' }))
    setStatus('active')
    resolveKeep({
      ok: true,
      quotaExceeded: false,
      roomAvailable: true,
      value: {},
    })
    await waitFor(() =>
      expect(trackMock).toHaveBeenCalledWith('voice_keep_success'),
    )
    setStatus('complete')

    expect(screen.getByRole('button', { name: 'Keep Take' })).toBeEnabled()
    expect(
      screen.queryByRole('button', { name: 'Kept' }),
    ).not.toBeInTheDocument()
    expect(notificationMock).not.toHaveBeenCalledWith(
      expect.stringMatching(/kept in Hear Yourself/i),
      'success',
      expect.anything(),
    )
  })
})
