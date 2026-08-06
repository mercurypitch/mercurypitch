import type { TargetTimeScheduleRule } from '@irchiinnuss/beside-cue-core'
import { createMobileRuntimeProbe } from '@irchiinnuss/mobile-runtime/testing'
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
    const probe = createMobileRuntimeProbe({ permission: 'granted' })
    const coordinator = createDailyCueCoordinator(
      Promise.resolve(probe.runtime),
      'android',
    )

    await expect(coordinator.reconcile(undefined, config)).resolves.toBe(
      'cleared',
    )
    expect(probe.calls.cancelled).toEqual([[DAILY_CUE_NOTIFICATION_ID]])
    expect(probe.calls.removedDelivered).toEqual([[DAILY_CUE_NOTIFICATION_ID]])
  })

  it('clears persisted device work when notification permission is revoked', async () => {
    const probe = createMobileRuntimeProbe({ permission: 'denied' })
    const coordinator = createDailyCueCoordinator(
      Promise.resolve(probe.runtime),
      'android',
    )

    await expect(coordinator.reconcile(rule, config)).resolves.toBe(
      'permission-denied',
    )
    expect(probe.calls.cancelled).toEqual([[DAILY_CUE_NOTIFICATION_ID]])
    expect(probe.calls.scheduled).toHaveLength(0)
  })

  it('keeps an unchanged installed cue intact during foreground reconciliation', async () => {
    const probe = createMobileRuntimeProbe({ permission: 'granted' })
    const coordinator = createDailyCueCoordinator(
      Promise.resolve(probe.runtime),
      'android',
    )

    await expect(coordinator.reconcile(rule, config)).resolves.toBe('scheduled')
    await expect(coordinator.reconcile(rule, config)).resolves.toBe('scheduled')

    expect(probe.calls.cancelled).toEqual([[DAILY_CUE_NOTIFICATION_ID]])
    expect(probe.calls.removedDelivered).toEqual([[DAILY_CUE_NOTIFICATION_ID]])
    expect(probe.calls.scheduled).toHaveLength(1)
  })

  it('runs a newer clear after an in-flight install settles', async () => {
    const scheduleGate = deferred()
    const scheduleStarted = deferred()
    const events: string[] = []
    const probe = createMobileRuntimeProbe({
      permission: 'granted',
      onCancel: () => {
        events.push('cancel')
      },
      onRemoveDelivered: () => {
        events.push('remove-delivered')
      },
      onSchedule: async () => {
        events.push('schedule-start')
        scheduleStarted.resolve()
        await scheduleGate.promise
        events.push('schedule-end')
      },
    })
    const coordinator = createDailyCueCoordinator(
      Promise.resolve(probe.runtime),
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
