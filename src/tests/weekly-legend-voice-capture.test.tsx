import { cleanup, fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearChallengeResult, lastChallengeResult, presentChallengeResult, } from '@/features/challenges/challenge-result-store'
import { ChallengeResultCard } from '@/features/challenges/ChallengeResultCard'
import type { WeeklyChallenge } from '@/features/challenges/weekly-service'
import type { ExerciseSessionVoiceTake } from '@/features/exercises/use-base-exercise'
import { isLocalSaveNavigationLocked } from '@/lib/local-save-navigation-lock'
import { encodeVoiceAtlasContour } from '@/lib/voice-contour'

const { getActiveWeeklyMock, keepMock, notificationMock, trackMock } =
  vi.hoisted(() => ({
    getActiveWeeklyMock: vi.fn<() => Promise<WeeklyChallenge | null>>(
      async () => null,
    ),
    keepMock: vi.fn(),
    notificationMock: vi.fn(),
    trackMock: vi.fn(),
  }))

vi.mock('solid-js/web', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>
  return {
    ...original,
    Portal: (props: { children: JSX.Element }) => <>{props.children}</>,
  }
})
vi.mock('@/features/challenges/weekly-voice-take', () => ({
  keepWeeklyLegendVoiceTake: keepMock,
}))
vi.mock('@/features/challenges/weekly-service', () => ({
  getActiveWeekly: getActiveWeeklyMock,
}))
vi.mock('@/stores/notifications-store', () => ({
  showNotification: notificationMock,
}))
vi.mock('@/lib/analytics', () => ({ trackEvent: trackMock }))

const take: ExerciseSessionVoiceTake = {
  blob: new Blob(['voice'], { type: 'audio/webm' }),
  durationMs: 5200,
  peaks: new Float32Array([0.2, 0.8]),
  capturedAt: '2026-08-01T12:00:00.000Z',
  contour: encodeVoiceAtlasContour([], { source: 'practice-engine-v1' }),
  config: {
    type: 'sight-singing',
    targetNotes: ['G4', 'A4', 'B4'],
    pattern: 'legend:w1',
  },
  result: {
    type: 'sight-singing',
    score: 84,
    metrics: { notesScored: 3 },
    completedAt: Date.UTC(2026, 7, 1, 12),
  },
}

function showResult(
  voiceCapture: NonNullable<
    Parameters<typeof presentChallengeResult>[0]['voiceCapture']
  > = { state: 'ready', take },
): void {
  presentChallengeResult({
    challengeId: 'w1',
    title: 'The Impossible Note',
    score: 84,
    targetScore: 70,
    tier: 'completed',
    badgeGranted: false,
    voiceCapture,
  })
  render(() => <ChallengeResultCard />)
}

describe('Weekly Legend voice capture result', () => {
  afterEach(() => {
    clearChallengeResult()
    cleanup()
    vi.clearAllMocks()
  })

  it('keeps the handed-off take only after the explicit action', async () => {
    keepMock.mockResolvedValue({
      ok: true,
      quotaExceeded: false,
      roomAvailable: true,
      value: {},
    })
    showResult()

    expect(screen.getByText(/stays temporary/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep Take' }))

    await waitFor(() =>
      expect(keepMock).toHaveBeenCalledWith({
        context: {
          challengeId: 'w1',
          title: 'The Impossible Note',
          score: 84,
          targetScore: 70,
          tier: 'completed',
        },
        take,
      }),
    )
    expect(trackMock).toHaveBeenNthCalledWith(1, 'voice_keep_attempt')
    expect(trackMock).toHaveBeenNthCalledWith(2, 'voice_keep_success')
  })

  it('cannot dismiss the result or discard the replay while Keep is saving', async () => {
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
    showResult()

    fireEvent.click(screen.getByRole('button', { name: 'Keep Take' }))
    expect(isLocalSaveNavigationLocked()).toBe(true)

    const dialog = screen.getByRole('dialog', { name: 'Challenge result' })
    expect(dialog).toHaveAttribute('aria-busy', 'true')
    for (const name of [
      'Saving',
      'Discard',
      'Sing it again',
      'Review pitch line',
      'Close',
    ]) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }

    fireEvent.click(dialog)
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(lastChallengeResult()?.voiceCapture).toEqual({
      state: 'ready',
      take,
    })

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
    expect(lastChallengeResult()?.voiceCapture).toEqual({
      state: 'ready',
      take,
    })
  })

  it('does not let a stale relaunch discard a Keep that began during its lookup', async () => {
    let resolveChallenge!: (challenge: WeeklyChallenge | null) => void
    getActiveWeeklyMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveChallenge = resolve
      }),
    )
    keepMock.mockResolvedValue({
      ok: false,
      quotaExceeded: false,
      roomAvailable: true,
      value: null,
    })
    showResult()

    fireEvent.click(screen.getByRole('button', { name: 'Sing it again' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep Take' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Retry Keep' })).toBeEnabled(),
    )

    resolveChallenge({
      id: 'w1',
      slug: 'impossible-note',
      title: 'The Impossible Note',
      description: 'Hold the shared line.',
      featType: 'sight singing',
      voiceTypeSplit: null,
      difficulty: 'hard',
      targetItems: [],
      targetScore: 70,
      hearItUrl: null,
      startsAt: '2026-08-01T00:00:00.000Z',
      endsAt: '2026-08-08T00:00:00.000Z',
      rewardBadgeId: null,
      founderScore: null,
      founderTrace: null,
      status: 'active',
    })

    await Promise.resolve()
    expect(lastChallengeResult()?.voiceCapture).toEqual({
      state: 'ready',
      take,
    })
    expect(screen.getByRole('button', { name: 'Retry Keep' })).toBeEnabled()
  })

  it('discards the temporary replay without changing the Legend score', () => {
    showResult()

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))

    expect(lastChallengeResult()?.voiceCapture).toEqual({
      state: 'discarded',
      take: null,
    })
    expect(
      within(screen.getByRole('dialog')).getByText(/84%/i),
    ).toBeInTheDocument()
  })

  it('keeps keyboard focus inside the modal and lets Escape review the result', async () => {
    showResult()

    const dialog = screen.getByRole('dialog', { name: 'Challenge result' })
    const primary = screen.getByRole('button', { name: 'Sing it again' })
    await waitFor(() => expect(document.activeElement).toBe(primary))

    const close = screen.getByRole('button', { name: 'Close' })
    close.focus()
    fireEvent.keyDown(close, { key: 'Tab' })
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Keep Take' }),
    )

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(lastChallengeResult()).toBeNull()
  })

  it('explains unsupported replay without offering persistence actions', () => {
    showResult({ state: 'unsupported', take: null })

    expect(screen.getByText(/cannot record a replay/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Keep Take' }),
    ).not.toBeInTheDocument()
    expect(keepMock).not.toHaveBeenCalled()
  })
})
