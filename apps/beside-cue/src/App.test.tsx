import type { BesideCueStateV1 } from '@irchiinnuss/beside-cue-core'
import type { LocalNotificationActionListener, LocalNotificationRequest, MobileRuntime, NotificationPermissionState, } from '@irchiinnuss/mobile-runtime'
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { App } from './App'
import type { BesideCueAppServices } from './app-services'
import type { ResettableBesideCueRepository } from './infrastructure/indexed-db-repository'

interface MemoryRepository extends ResettableBesideCueRepository {
  snapshot(): BesideCueStateV1 | null
}

function createMemoryRepository(): MemoryRepository {
  let state: BesideCueStateV1 | null = null

  return {
    async loadState() {
      return state
    },
    async saveState(nextState) {
      state = nextState
    },
    async clear() {
      state = null
    },
    snapshot() {
      return state
    },
  }
}

interface RuntimeProbe {
  readonly scheduled: LocalNotificationRequest[][]
  readonly cancelled: number[][]
  permissionRequests: number
  actionListener?: LocalNotificationActionListener
}

interface Deferred {
  readonly promise: Promise<void>
  resolve(): void
}

function deferred(): Deferred {
  let resolve!: () => void
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

function createSilentRuntime(
  probe?: RuntimeProbe,
  permission: NotificationPermissionState = 'unsupported',
  scheduleGate?: Promise<void>,
): MobileRuntime {
  return {
    haptics: {
      async impact() {},
      async notification() {},
    },
    localNotifications: {
      async checkPermission() {
        return permission
      },
      async requestPermission() {
        if (probe !== undefined) probe.permissionRequests += 1
        return permission
      },
      async createChannel() {},
      async schedule(notifications) {
        probe?.scheduled.push([...notifications])
        await scheduleGate
      },
      async cancel(ids) {
        probe?.cancelled.push([...ids])
      },
      async removeDelivered() {},
      async addActionListener(listener) {
        if (probe !== undefined) probe.actionListener = listener
        return { async remove() {} }
      },
    },
  }
}

function createTestServices(
  repository: MemoryRepository,
  options: {
    readonly runtime?: MobileRuntime
    readonly platform?: BesideCueAppServices['platform']
  } = {},
): BesideCueAppServices {
  let nextId = 0
  return {
    repository,
    runtime: Promise.resolve(options.runtime ?? createSilentRuntime()),
    platform: options.platform ?? 'web',
    now: () => new Date('2026-08-06T10:00:00'),
    createId: () => `test-${String((nextId += 1))}`,
  }
}

describe('Beside Cue app', () => {
  it('completes the manual cue loop and records a gentle reflection', async () => {
    const repository = createMemoryRepository()
    render(() => <App services={createTestServices(repository)} />)

    fireEvent.click(
      await screen.findByRole('button', { name: /make my first cue/iu }),
    )
    fireEvent.click(screen.getByRole('radio', { name: /another scroll/iu }))
    fireEvent.click(screen.getByRole('button', { name: /choose my b-side/iu }))
    fireEvent.click(
      screen.getByRole('button', { name: /keep this beside me/iu }),
    )

    expect(
      await screen.findByRole('heading', {
        name: /a better choice, kept close/iu,
      }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /cue me now/iu }))
    expect(
      await screen.findByRole('heading', {
        name: /put the phone in another room/iu,
      }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /choose the b-side/iu }))

    await waitFor(() => {
      expect(repository.snapshot()?.occurrences).toMatchObject([
        { state: 'resolved', outcome: 'b_side' },
      ])
    })

    fireEvent.click(
      screen.getByRole('button', { name: /let the screen go quiet/iu }),
    )
    fireEvent.click(screen.getByRole('button', { name: /reflection/iu }))
    expect(
      screen.getByRole('heading', { name: /small turns leave a trace/iu }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('B-side choice totals')).toHaveTextContent(
      /Today\s*1/iu,
    )
  })

  it('keeps empty onboarding neutral and validates before continuing', async () => {
    const repository = createMemoryRepository()
    render(() => <App services={createTestServices(repository)} />)

    fireEvent.click(
      await screen.findByRole('button', { name: /make my first cue/iu }),
    )
    fireEvent.click(screen.getByRole('button', { name: /choose my b-side/iu }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Side A needs between 1 and 120 characters.',
    )
    expect(repository.snapshot()).toBeNull()
  })

  it('keeps one configurable daily cue through the shared notification port', async () => {
    const repository = createMemoryRepository()
    const probe: RuntimeProbe = {
      scheduled: [],
      cancelled: [],
      permissionRequests: 0,
    }
    render(() => (
      <App
        services={createTestServices(repository, {
          platform: 'android',
          runtime: createSilentRuntime(probe, 'granted'),
        })}
      />
    ))

    fireEvent.click(
      await screen.findByRole('button', { name: /make my first cue/iu }),
    )
    fireEvent.click(screen.getByRole('radio', { name: /another scroll/iu }))
    fireEvent.click(screen.getByRole('button', { name: /choose my b-side/iu }))
    fireEvent.click(
      screen.getByRole('button', { name: /keep this beside me/iu }),
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))
    fireEvent.click(
      screen.getByRole('button', {
        name: /morning a small beginning 09:00/iu,
      }),
    )

    await waitFor(() => {
      expect(repository.snapshot()?.scheduleRules).toMatchObject([
        {
          kind: 'target_time',
          localTime: '09:00',
          enabled: true,
        },
      ])
    })
    await waitFor(() => expect(probe.scheduled.at(-1)).toHaveLength(1))
    expect(probe.permissionRequests).toBe(0)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Kept for around 09:00. Notifications stay discreet.',
    )

    const scheduled = probe.scheduled.at(-1)?.[0]
    if (scheduled === undefined || probe.actionListener === undefined) {
      throw new Error('Expected a planned notification and action listener.')
    }
    expect(scheduled.schedule).toEqual({
      kind: 'daily',
      hour: 9,
      minute: 0,
    })
    await probe.actionListener({
      notificationId: scheduled.id,
      actionId: 'open',
      extra: scheduled.extra,
    })

    expect(
      await screen.findByRole('heading', {
        name: /put the phone in another room/iu,
      }),
    ).toBeInTheDocument()
    expect(repository.snapshot()?.occurrences).toMatchObject([
      { source: 'scheduled', state: 'presented' },
    ])
  })

  it('preserves cue history while a native schedule update is still settling', async () => {
    const repository = createMemoryRepository()
    const scheduleGate = deferred()
    const probe: RuntimeProbe = {
      scheduled: [],
      cancelled: [],
      permissionRequests: 0,
    }
    render(() => (
      <App
        services={createTestServices(repository, {
          platform: 'android',
          runtime: createSilentRuntime(probe, 'granted', scheduleGate.promise),
        })}
      />
    ))

    fireEvent.click(
      await screen.findByRole('button', { name: /make my first cue/iu }),
    )
    fireEvent.click(screen.getByRole('radio', { name: /another scroll/iu }))
    fireEvent.click(screen.getByRole('button', { name: /choose my b-side/iu }))
    fireEvent.click(
      screen.getByRole('button', { name: /keep this beside me/iu }),
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))
    fireEvent.click(
      screen.getByRole('button', {
        name: /morning a small beginning 09:00/iu,
      }),
    )

    await waitFor(() => expect(probe.scheduled).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: /back/iu }))
    fireEvent.click(screen.getByRole('button', { name: /cue me now/iu }))
    fireEvent.click(screen.getByRole('button', { name: /choose the b-side/iu }))

    scheduleGate.resolve()
    await waitFor(() => {
      expect(repository.snapshot()?.occurrences).toMatchObject([
        { source: 'manual', state: 'resolved', outcome: 'b_side' },
      ])
      expect(repository.snapshot()?.scheduleRules).toMatchObject([
        { localTime: '09:00', enabled: true },
      ])
    })
  })
})
