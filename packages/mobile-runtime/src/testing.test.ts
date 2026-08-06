// ============================================================
// Mobile runtime test probe tests — deterministic calls and native actions
// ============================================================

import { describe, expect, it } from 'vitest'
import { notificationId } from './contracts'
import { createMobileRuntimeProbe } from './testing'

describe('mobile runtime test probe', () => {
  it('records permission and capability calls as stable snapshots', async () => {
    const probe = createMobileRuntimeProbe({
      permission: 'prompt',
      requestedPermission: 'granted',
    })
    const at = new Date('2026-08-06T12:00:00.000Z')

    await probe.runtime.haptics.impact('medium')
    await probe.runtime.haptics.notification('success')
    await expect(
      probe.runtime.localNotifications.checkPermission(),
    ).resolves.toBe('prompt')
    await expect(
      probe.runtime.localNotifications.requestPermission(),
    ).resolves.toBe('granted')
    await probe.runtime.localNotifications.createChannel({
      id: 'test',
      name: 'Test channel',
    })
    await probe.runtime.localNotifications.schedule([
      {
        id: notificationId(7),
        title: 'A cue',
        body: 'Open the app',
        schedule: { kind: 'at', at },
      },
    ])
    await probe.runtime.localNotifications.cancel([notificationId(7)])
    await probe.runtime.localNotifications.removeDelivered([notificationId(7)])
    at.setUTCFullYear(2030)

    expect(probe.calls).toMatchObject({
      impacts: ['medium'],
      hapticNotifications: ['success'],
      channels: [{ id: 'test', name: 'Test channel' }],
      cancelled: [[7]],
      removedDelivered: [[7]],
      permissionChecks: 1,
      permissionRequests: 1,
    })
    expect(probe.calls.scheduled[0]?.[0]?.schedule).toEqual({
      kind: 'at',
      at: new Date('2026-08-06T12:00:00.000Z'),
    })
  })

  it('emits actions only to listeners that remain registered', async () => {
    const probe = createMobileRuntimeProbe()
    const actions: string[] = []
    const handle = await probe.runtime.localNotifications.addActionListener(
      (action) => {
        actions.push(action.actionId)
      },
    )

    await probe.emitNotificationAction({
      notificationId: notificationId(9),
      actionId: 'open',
    })
    await handle.remove()
    await probe.emitNotificationAction({
      notificationId: notificationId(9),
      actionId: 'open-again',
    })

    expect(actions).toEqual(['open'])
  })
})
