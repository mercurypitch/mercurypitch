import { cleanup, fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearChallengeResult, lastChallengeResult, presentChallengeResult, } from '@/features/challenges/challenge-result-store'
import { ChallengeResultCard } from '@/features/challenges/ChallengeResultCard'
import type { ExerciseSessionVoiceTake } from '@/features/exercises/use-base-exercise'

const { keepMock, notificationMock, trackMock } = vi.hoisted(() => ({
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
  getActiveWeekly: vi.fn(async () => null),
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

  it('explains unsupported replay without offering persistence actions', () => {
    showResult({ state: 'unsupported', take: null })

    expect(screen.getByText(/cannot record a replay/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Keep Take' }),
    ).not.toBeInTheDocument()
  })
})
