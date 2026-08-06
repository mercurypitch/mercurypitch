// ============================================================
// Capacitor notification adapter tests — native schedule mapping and fallbacks
// ============================================================

import { CapacitorException, ExceptionCode } from '@capacitor/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { notificationId } from '../contracts'
import { createCapacitorLocalNotificationsPort } from './local-notifications'

const localNotifications = vi.hoisted(() => ({
  addListener: vi.fn(),
  cancel: vi.fn(),
  checkPermissions: vi.fn(),
  createChannel: vi.fn(),
  getDeliveredNotifications: vi.fn(),
  removeDeliveredNotifications: vi.fn(),
  requestPermissions: vi.fn(),
  schedule: vi.fn(),
}))

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: localNotifications,
}))

describe('Capacitor local notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps recurring daily wall-clock schedules to Capacitor calendar matching', async () => {
    const port = createCapacitorLocalNotificationsPort()

    await port.schedule([
      {
        id: notificationId(41),
        title: 'Daily notice',
        body: 'One gentle cue',
        schedule: { kind: 'daily', hour: 18, minute: 30 },
        channelId: 'gentle-cues',
        allowWhileIdle: false,
      },
    ])

    expect(localNotifications.schedule).toHaveBeenCalledWith({
      notifications: [
        {
          id: 41,
          title: 'Daily notice',
          body: 'One gentle cue',
          schedule: {
            on: { hour: 18, minute: 30 },
            allowWhileIdle: false,
          },
          channelId: 'gentle-cues',
        },
      ],
    })
  })

  it('preserves one-shot dates without sharing their mutable Date object', async () => {
    const port = createCapacitorLocalNotificationsPort()
    const at = new Date('2026-08-06T18:30:00.000Z')

    await port.schedule([
      {
        id: notificationId(42),
        title: 'One notice',
        body: 'One cue',
        schedule: { kind: 'at', at },
      },
    ])

    const request = localNotifications.schedule.mock.calls[0]?.[0] as {
      notifications: Array<{ schedule: { at: Date } }>
    }
    const mappedAt = request.notifications[0]?.schedule.at
    expect(mappedAt).toEqual(at)
    expect(mappedAt).not.toBe(at)
  })

  it('treats an unavailable notification-channel API as a safe no-op', async () => {
    localNotifications.createChannel.mockRejectedValueOnce(
      new CapacitorException(
        'Notification channels are unavailable',
        ExceptionCode.Unavailable,
      ),
    )
    const port = createCapacitorLocalNotificationsPort()

    await expect(
      port.createChannel({ id: 'gentle-cues', name: 'Gentle cues' }),
    ).resolves.toBeUndefined()
  })

  it('keeps unrelated notification-channel failures visible', async () => {
    const failure = new CapacitorException(
      'Native bridge failed',
      ExceptionCode.Unimplemented,
    )
    localNotifications.createChannel.mockRejectedValueOnce(failure)
    const port = createCapacitorLocalNotificationsPort()

    await expect(
      port.createChannel({ id: 'gentle-cues', name: 'Gentle cues' }),
    ).rejects.toBe(failure)
  })
})
