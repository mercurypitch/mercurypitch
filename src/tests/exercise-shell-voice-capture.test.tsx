import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExerciseShell } from '@/features/exercises/ExerciseShell'
import type { ExerciseSessionVoiceTake, ExerciseVoiceCaptureController, ExerciseVoiceCaptureState, } from '@/features/exercises/use-base-exercise'
import { isLocalSaveNavigationLocked } from '@/lib/local-save-navigation-lock'
import { encodeVoiceAtlasContour } from '@/lib/voice-contour'
import type * as NotificationsStore from '@/stores/notifications-store'

const { keepMock, notificationMock, trackMock } = vi.hoisted(() => ({
  keepMock: vi.fn(),
  notificationMock: vi.fn(),
  trackMock: vi.fn(),
}))

vi.mock('@/features/exercises/exercise-voice-take', () => ({
  keepExerciseVoiceTake: keepMock,
}))
// The real store, but for its toast: the stage draws its notices from it.
vi.mock('@/stores/notifications-store', async (importOriginal) => ({
  ...(await importOriginal<typeof NotificationsStore>()),
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
    const [captureState, setCaptureState] =
      createSignal<ExerciseVoiceCaptureState>('ready')
    const [take, setTake] = createSignal<ExerciseSessionVoiceTake | null>(
      voiceTake,
    )
    // As the drill's own capture does: a discarded take is gone.
    const discard = () => {
      discardCalls += 1
      setTake(null)
      setCaptureState('idle')
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

    expect(
      screen.getByText('Not saved unless you keep it.'),
    ).toBeInTheDocument()
    expect(keepMock).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))

    await waitFor(() =>
      expect(keepMock).toHaveBeenCalledWith({
        exerciseTitle: 'Long Note Practice',
        take,
      }),
    )
    await screen.findByText('Take kept')
    expect(trackMock).toHaveBeenNthCalledWith(1, 'voice_keep_attempt')
    expect(trackMock).toHaveBeenNthCalledWith(2, 'voice_keep_success')
    // The notice says it; no toast says it again.
    expect(notificationMock).not.toHaveBeenCalled()
  })

  it('discards the temporary replay without changing the score', async () => {
    const { discardCalls } = renderCompleteCapture()

    fireEvent.click(screen.getByRole('button', { name: 'Discard take' }))

    expect(discardCalls()).toBe(1)
    expect(screen.getByText('84%')).toBeInTheDocument()
    // A discarded take shows nothing, in the notice or the card.
    await waitFor(() =>
      expect(screen.queryByTestId('exercise-take-notice')).toBeNull(),
    )
    expect(document.querySelector('.exercise-result-replay-note')).toBeNull()
  })

  it('leaves Space with the Keep and Discard take actions', async () => {
    const onTryAgain = vi.fn()
    renderCompleteCapture(onTryAgain)
    await Promise.resolve()

    for (const name of ['Keep', 'Discard take']) {
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

  it('blocks restart and back, and offers no discard, until a failed Keep offers Retry', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    expect(isLocalSaveNavigationLocked()).toBe(true)
    expect(screen.getByText('Keeping your take')).toBeInTheDocument()
    expect(screen.getByText('Saving on this device…')).toBeInTheDocument()
    for (const name of ['Try Again', /Back/]) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
    // The capsule is busy, not disabled: it keeps the focus it was pressed
    // with, and a second press does nothing.
    const busy = screen.getByRole('button', { name: 'Keeping' })
    expect(busy).toHaveAttribute('aria-disabled', 'true')
    expect(busy).not.toBeDisabled()
    fireEvent.click(busy)
    expect(keepMock).toHaveBeenCalledTimes(1)
    // While the keep is written there is nothing to discard with.
    expect(screen.queryByRole('button', { name: 'Discard take' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Keeping' }))
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))
    fireEvent.click(screen.getByRole('button', { name: /Back/ }))
    expect(keepMock).toHaveBeenCalledOnce()
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
      expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled(),
    )
    expect(isLocalSaveNavigationLocked()).toBe(false)
    expect(screen.getByText('Could not keep it')).toBeInTheDocument()
    expect(
      screen.getByText('The temporary copy stays until you retry or leave.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Discard take' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Back/ })).toBeEnabled()
    expect(trackMock).toHaveBeenCalledWith('voice_keep_failure')
    expect(trackMock).not.toHaveBeenCalledWith('voice_storage_warning')
    expect(notificationMock).not.toHaveBeenCalled()

    // Retry is a second keep of the same take.
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(keepMock).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['the quota is exceeded', { quotaExceeded: true, roomAvailable: true }],
    ['the device has no room', { quotaExceeded: false, roomAvailable: false }],
  ])('asks for storage when %s', async (_reason, failure) => {
    keepMock.mockResolvedValue({ ok: false, value: null, ...failure })
    renderCompleteCapture()

    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))

    await screen.findByText('Not enough storage')
    expect(
      screen.getByText('Free some browser storage, then retry.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Discard take' })).toBeEnabled()
    expect(trackMock).toHaveBeenCalledWith('voice_storage_warning')
    expect(notificationMock).not.toHaveBeenCalled()
  })

  it('says it could not keep a take when the keep throws', async () => {
    keepMock.mockRejectedValue(new Error('the database went away'))
    renderCompleteCapture()

    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))

    await screen.findByText('Could not keep it')
    expect(trackMock).toHaveBeenLastCalledWith('voice_keep_failure')
    expect(notificationMock).not.toHaveBeenCalled()
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

    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
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

    expect(screen.getByRole('button', { name: 'Keep' })).toBeEnabled()
    expect(screen.getByText('Keep this take?')).toBeInTheDocument()
    expect(screen.queryByText('Take kept')).not.toBeInTheDocument()
    expect(notificationMock).not.toHaveBeenCalled()
  })
})
