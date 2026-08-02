import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExerciseShell } from '@/features/exercises/ExerciseShell'
import type { ExerciseStatus } from '@/features/exercises/types'
import type { ExerciseSessionVoiceTake, ExerciseVoiceCaptureController, ExerciseVoiceCaptureState, } from '@/features/exercises/use-base-exercise'

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
    config: { type: 'long-note' as const, targetNote: 'A3' },
    result: {
      type: 'long-note' as const,
      score: 84,
      metrics: { steadyZonePct: 78 },
      completedAt: Date.UTC(2026, 7, 1, 12),
    },
  }
}

function renderCompleteCapture() {
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
        onBack={() => {}}
        onStart={() => {}}
        activeContent={<div>active</div>}
        onStop={() => {}}
        resultSummary={<>Steady zone 78%</>}
        onTryAgain={() => {}}
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

  it('does not let an earlier save mark the next run as already kept', async () => {
    let resolveKeep:
      | ((result: {
          ok: boolean
          quotaExceeded: boolean
          roomAvailable: boolean
          value: object
        }) => void)
      | undefined
    keepMock.mockReturnValue(
      new Promise((resolve) => {
        resolveKeep = resolve
      }),
    )
    const firstTake = makeVoiceTake()
    const Harness = () => {
      const [status, setStatus] = createSignal<ExerciseStatus>('complete')
      const [take] = createSignal<ExerciseSessionVoiceTake | null>(firstTake)
      const voiceCapture: ExerciseVoiceCaptureController = {
        state: () => 'ready',
        take,
        awaitOutcome: async () => ({ state: 'ready', take: take()! }),
        discard: vi.fn(),
      }
      return (
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
          onTryAgain={() => setStatus('active')}
          onChangeTarget={() => {}}
        />
      )
    }
    render(() => <Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'Keep Take' }))
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))
    resolveKeep?.({
      ok: true,
      quotaExceeded: false,
      roomAvailable: true,
      value: {},
    })
    await waitFor(() =>
      expect(trackMock).toHaveBeenCalledWith('voice_keep_success'),
    )

    expect(screen.getByRole('button', { name: 'Keep Take' })).toBeEnabled()
    expect(
      screen.queryByRole('button', { name: 'Kept' }),
    ).not.toBeInTheDocument()
  })
})
