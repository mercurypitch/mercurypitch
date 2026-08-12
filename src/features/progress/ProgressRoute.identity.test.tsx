// ============================================================
// Progress route privacy — detached share evidence dies with its auth owner
// ============================================================

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { Show } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const routeMocks = vi.hoisted(() => ({
  loadProgressModel: vi.fn(),
  trackEvent: vi.fn(),
}))

vi.mock('@/db/services/auth-service', () => ({ accountHeld: () => false }))
vi.mock('@/db/services/session-service', () => ({
  sessionRecordVersion: () => 0,
}))
vi.mock('@/lib/analytics', () => ({ trackEvent: routeMocks.trackEvent }))
vi.mock('./progress-data', () => ({
  loadProgressModel: routeMocks.loadProgressModel,
}))
vi.mock('./ProgressPage', () => ({
  ProgressPage: function MockProgressPage(props: {
    status: 'loading' | 'ready' | 'empty' | 'error'
    snapshot?: { moment: { id: string; title: string } }
    errorMessage?: string
    onRetry?: () => void
    onShareMoment?: (id: string) => void
  }) {
    return (
      <>
        <div data-testid="mock-progress-status">{props.status}</div>
        <Show when={props.snapshot}>
          {(snapshot) => (
            <div data-testid="mock-progress-snapshot">
              {snapshot().moment.title}
            </div>
          )}
        </Show>
        <Show when={props.status === 'error'}>
          <div role="alert">{props.errorMessage}</div>
          <button type="button" onClick={() => props.onRetry?.()}>
            {props.snapshot === undefined ? 'Try again' : 'Retry'}
          </button>
        </Show>
        <button
          type="button"
          disabled={props.snapshot === undefined}
          onClick={() => {
            const momentId = props.snapshot?.moment.id
            if (momentId !== undefined) props.onShareMoment?.(momentId)
          }}
        >
          Share current moment
        </button>
      </>
    )
  },
}))
vi.mock('./ProgressShareStudio', () => ({
  ProgressShareStudio: function MockProgressShareStudio(props: {
    open: boolean
    moment: { claim: string }
  }) {
    return (
      <Show when={props.open}>
        <div data-testid="mock-progress-share">{props.moment.claim}</div>
      </Show>
    )
  },
}))

import { setAuthToken } from '@/db/services/user-service'
import type { ProgressModel } from './model'
import { buildProgressModel } from './model'
import { ProgressRoute } from './ProgressRoute'

function deferred<T>(): {
  promise: Promise<T>
  resolve(value: T): void
} {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

function accountModel(
  userId: string,
  recordId: string,
  melodyName: string,
): ProgressModel {
  return buildProgressModel(
    {
      records: [
        {
          id: recordId,
          createdAt: '2026-08-11T10:00:00.000Z',
          updatedAt: '2026-08-11T10:00:00.000Z',
          userId,
          melodyName,
          startedAt: '2026-08-11T09:59:00.000Z',
          endedAt: '2026-08-11T10:00:00.000Z',
          score: 84,
          accuracy: 84,
          notesHit: 4,
          notesTotal: 5,
          streak: 3,
          source: 'exercise',
          instrument: 'voice',
          results: [],
        },
      ],
      voiceprints: [],
      badgeDefinitions: [],
      userBadges: [],
      achievementDefinitions: [],
      userAchievements: [],
      challengeDefinitions: [],
      activityRows: [],
      recentActivity: [],
      league: null,
    },
    { now: new Date('2026-08-11T12:00:00.000Z') },
  )
}

const accountAModel = accountModel(
  'account-a',
  'account-a-run',
  'Private warm-up',
)
const accountBModel = accountModel(
  'account-b',
  'account-b-run',
  'Second singer session',
)
const accountAUnavailableModel: ProgressModel = {
  ...accountAModel,
  coverage: accountAModel.coverage.map((item) =>
    item.id === 'sessions' ? { ...item, status: 'unavailable' as const } : item,
  ),
}

beforeEach(() => {
  localStorage.clear()
  setAuthToken(null)
  routeMocks.loadProgressModel.mockResolvedValue(accountAModel)
  routeMocks.trackEvent.mockClear()
})

afterEach(() => {
  cleanup()
  setAuthToken(null)
  vi.clearAllMocks()
})

describe('ProgressRoute identity safety and recovery', () => {
  it('removes the open share payload as soon as authentication changes', async () => {
    render(() => <ProgressRoute />)

    const shareButton = await screen.findByRole('button', {
      name: 'Share current moment',
    })
    await waitFor(() => expect(shareButton).not.toBeDisabled())
    fireEvent.click(shareButton)
    expect(routeMocks.trackEvent).toHaveBeenCalledWith('progress_share_opened')
    expect(await screen.findByTestId('mock-progress-share')).toBeInTheDocument()

    setAuthToken('new-account-token')

    await waitFor(() => {
      expect(screen.queryByTestId('mock-progress-share')).toBeNull()
    })
  })

  it('removes the previous singer snapshot while the next identity loads', async () => {
    const nextIdentityLoad = deferred<typeof accountBModel>()
    routeMocks.loadProgressModel
      .mockResolvedValueOnce(accountAModel)
      .mockReturnValueOnce(nextIdentityLoad.promise)

    render(() => <ProgressRoute />)

    expect(
      await screen.findByTestId('mock-progress-snapshot'),
    ).toHaveTextContent('Private warm-up')

    setAuthToken('account-b-token')

    await waitFor(() => {
      expect(routeMocks.loadProgressModel).toHaveBeenCalledTimes(2)
      expect(screen.queryByTestId('mock-progress-snapshot')).toBeNull()
      expect(screen.getByTestId('mock-progress-status')).toHaveTextContent(
        'loading',
      )
    })

    nextIdentityLoad.resolve(accountBModel)

    await waitFor(() => {
      expect(screen.getByTestId('mock-progress-snapshot')).toHaveTextContent(
        'Second singer session',
      )
      expect(screen.getByTestId('mock-progress-status')).toHaveTextContent(
        'ready',
      )
    })
  })

  it('recovers from a cold load failure after retrying', async () => {
    const recoveryLoad = deferred<typeof accountBModel>()
    routeMocks.loadProgressModel
      .mockRejectedValueOnce(new Error('Progress service unavailable'))
      .mockReturnValueOnce(recoveryLoad.promise)

    render(() => <ProgressRoute />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Progress service unavailable',
    )
    expect(screen.queryByTestId('mock-progress-snapshot')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => {
      expect(routeMocks.loadProgressModel).toHaveBeenCalledTimes(2)
      expect(screen.getByTestId('mock-progress-status')).toHaveTextContent(
        'loading',
      )
      expect(screen.queryByRole('alert')).toBeNull()
    })

    recoveryLoad.resolve(accountBModel)

    await waitFor(() => {
      expect(screen.getByTestId('mock-progress-snapshot')).toHaveTextContent(
        'Second singer session',
      )
      expect(screen.getByTestId('mock-progress-status')).toHaveTextContent(
        'ready',
      )
      expect(screen.queryByRole('alert')).toBeNull()
    })
  })

  it('retains a same-key snapshot when its retry fails', async () => {
    routeMocks.loadProgressModel
      .mockResolvedValueOnce(accountAUnavailableModel)
      .mockRejectedValueOnce(new Error('Progress refresh unavailable'))

    render(() => <ProgressRoute />)

    expect(
      await screen.findByTestId('mock-progress-snapshot'),
    ).toHaveTextContent('Private warm-up')
    expect(screen.getByTestId('mock-progress-status')).toHaveTextContent(
      'error',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(routeMocks.loadProgressModel).toHaveBeenCalledTimes(2)
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Progress refresh unavailable',
      )
      expect(screen.getByTestId('mock-progress-snapshot')).toHaveTextContent(
        'Private warm-up',
      )
    })
  })
})
