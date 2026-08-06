import type { TargetTimeScheduleRule } from '@irchiinnuss/beside-cue-core'
import type { LocalNotificationRequest, MobileRuntime, NotificationId, NotificationPermissionState, } from '@irchiinnuss/mobile-runtime'
import { describe, expect, it } from 'vitest'
import type { DailyCueConfig } from '../app-config'
import { createDailyCueCoordinator } from './daily-cue-coordinator'
import { DAILY_CUE_NOTIFICATION_ID } from './daily-cue-plan'

const config: DailyCueConfig = {
  presets: [],
  channel: {
    id: 'gentle',
    name: 'Gentle cues',
    description: 'A quiet daily cue.',
  },
  notification: {
    title: 'A small cue is ready',
    body: 'Open Beside Cue when you choose.',
  },
}

const rule: TargetTimeScheduleRule = {
  id: 'rule-1',
  cueId: 'cue-1',
  kind: 'target_time',
  daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
  localTime: '09:00',
  enabled: true,
  createdAt: '2026-08-06T08:00:00.000Z',
  updatedAt: '2026-08-06T08:00:00.000Z',
}

function createRuntime(input: {
  permission?: NotificationPermissionState
  schedule?: (
    notifications: readonly LocalNotificationRequest[],
  ) => Promise<void>
  cancel?: (ids: readonly NotificationId[]) => Promise<void>
  removeDelivered?: (ids: readonly NotificationId[]) => Promise<void>
}): MobileRuntime {
  return {
    haptics: {
      async impact() {},
      async notification() {},
    },
    localNotifications: {
      async checkPermission() {
        return input.permission ?? 'granted'
      },
      async requestPermission() {
        return input.permission ?? 'granted'
      },
      async createChannel() {},
      schedule: input.schedule ?? (async () => undefined),
      cancel: input.cancel ?? (async () => undefined),
      removeDelivered: input.removeDelivered ?? (async () => undefined),
      async addActionListener() {
        return { async remove() {} }
      },
    },
  }
}

function deferred(): {
  readonly promise: Promise<void>
  resolve(): void
} {
  let resolve!: () => void
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

describe('daily cue coordinator', () => {
  it('clears its reserved notification even when no rule is stored', async () => {
    const cancelled: NotificationId[][] = []
    const removed: NotificationId[][] = []
    const coordinator = createDailyCueCoordinator(
      Promise.resolve(
        createRuntime({
          cancel: async (ids) => {
            cancelled.push([...ids])
          },
          removeDelivered: async (ids) => {
            removed.push([...ids])
          },
        }),
      ),
      'android',
    )

    await expect(coordinator.reconcile(undefined, config)).resolves.toBe(
      'cleared',
    )
    expect(cancelled).toEqual([[DAILY_CUE_NOTIFICATION_ID]])
    expect(removed).toEqual([[DAILY_CUE_NOTIFICATION_ID]])
  })

  it('clears persisted device work when notification permission is revoked', async () => {
    const cancelled: NotificationId[][] = []
    const scheduled: LocalNotificationRequest[][] = []
    const coordinator = createDailyCueCoordinator(
      Promise.resolve(
        createRuntime({
          permission: 'denied',
          cancel: async (ids) => {
            cancelled.push([...ids])
          },
          schedule: async (notifications) => {
            scheduled.push([...notifications])
          },
        }),
      ),
      'android',
    )

    await expect(coordinator.reconcile(rule, config)).resolves.toBe(
      'permission-denied',
    )
    expect(cancelled).toEqual([[DAILY_CUE_NOTIFICATION_ID]])
    expect(scheduled).toHaveLength(0)
  })

  it('runs a newer clear after an in-flight install settles', async () => {
    const scheduleGate = deferred()
    const scheduleStarted = deferred()
    const events: string[] = []
    const coordinator = createDailyCueCoordinator(
      Promise.resolve(
        createRuntime({
          cancel: async () => {
            events.push('cancel')
          },
          removeDelivered: async () => {
            events.push('remove-delivered')
          },
          schedule: async () => {
            events.push('schedule-start')
            scheduleStarted.resolve()
            await scheduleGate.promise
            events.push('schedule-end')
          },
        }),
      ),
      'android',
    )

    const install = coordinator.reconcile(rule, config)
    await scheduleStarted.promise
    const clear = coordinator.reconcile(undefined, config)
    scheduleGate.resolve()

    await expect(install).resolves.toBe('superseded')
    await expect(clear).resolves.toBe('cleared')
    expect(events).toEqual([
      'cancel',
      'remove-delivered',
      'schedule-start',
      'schedule-end',
      'cancel',
      'remove-delivered',
    ])
  })
})
