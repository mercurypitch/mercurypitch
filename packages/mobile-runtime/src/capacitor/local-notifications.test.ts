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
    vi.resetAllMocks()
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

  it('maps permission checks and requests without prompting implicitly', async () => {
    localNotifications.checkPermissions.mockResolvedValueOnce({
      display: 'prompt',
    })
    localNotifications.requestPermissions.mockResolvedValueOnce({
      display: 'granted',
    })
    const port = createCapacitorLocalNotificationsPort()

    await expect(port.checkPermission()).resolves.toBe('prompt')
    expect(localNotifications.requestPermissions).not.toHaveBeenCalled()
    await expect(port.requestPermission()).resolves.toBe('granted')
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

  it('cancels selected notifications and treats an empty selection as a no-op', async () => {
    const port = createCapacitorLocalNotificationsPort()

    await port.cancel([])
    expect(localNotifications.cancel).not.toHaveBeenCalled()

    await port.cancel([notificationId(12), notificationId(13)])
    expect(localNotifications.cancel).toHaveBeenCalledWith({
      notifications: [{ id: 12 }, { id: 13 }],
    })
  })

  it('removes only selected delivered notifications', async () => {
    const first = { id: 21, title: 'First', body: 'First body' }
    const second = { id: 22, title: 'Second', body: 'Second body' }
    localNotifications.getDeliveredNotifications.mockResolvedValueOnce({
      notifications: [first, second],
    })
    const port = createCapacitorLocalNotificationsPort()

    await port.removeDelivered([notificationId(22)])

    expect(
      localNotifications.removeDeliveredNotifications,
    ).toHaveBeenCalledWith({ notifications: [second] })
  })

  it('does not query delivered notifications for an empty selection', async () => {
    const port = createCapacitorLocalNotificationsPort()

    await port.removeDelivered([])

    expect(localNotifications.getDeliveredNotifications).not.toHaveBeenCalled()
  })

  it('forwards native actions and delegates listener removal', async () => {
    interface PerformedAction {
      readonly notification: { readonly id: number; readonly extra?: unknown }
      readonly actionId: string
      readonly inputValue?: string
    }

    let nativeListener: ((action: PerformedAction) => void) | undefined
    const remove = vi.fn(async () => undefined)
    localNotifications.addListener.mockImplementationOnce(
      async (_event: string, listener: (action: PerformedAction) => void) => {
        nativeListener = listener
        return { remove }
      },
    )
    const listener = vi.fn()
    const port = createCapacitorLocalNotificationsPort()
    const handle = await port.addActionListener(listener)

    nativeListener?.({
      notification: { id: 31, extra: { route: '/cue/31' } },
      actionId: 'open',
      inputValue: 'answer',
    })

    expect(listener).toHaveBeenCalledWith({
      notificationId: 31,
      actionId: 'open',
      inputValue: 'answer',
      extra: { route: '/cue/31' },
    })
    await handle.remove()
    expect(remove).toHaveBeenCalledTimes(1)
  })

  it('reports synchronous and asynchronous action-listener failures', async () => {
    interface PerformedAction {
      readonly notification: { readonly id: number }
      readonly actionId: string
    }

    const nativeListeners: Array<(action: PerformedAction) => void> = []
    localNotifications.addListener.mockImplementation(
      async (_event: string, listener: (action: PerformedAction) => void) => {
        nativeListeners.push(listener)
        return { remove: vi.fn(async () => undefined) }
      },
    )
    const synchronousFailure = new Error('Synchronous listener failure')
    const asynchronousFailure = new Error('Asynchronous listener failure')
    const onListenerError = vi.fn()
    const port = createCapacitorLocalNotificationsPort({ onListenerError })

    await port.addActionListener(() => {
      throw synchronousFailure
    })
    await port.addActionListener(async () => {
      throw asynchronousFailure
    })

    for (const listener of nativeListeners) {
      listener({ notification: { id: 32 }, actionId: 'open' })
    }
    await Promise.resolve()

    expect(onListenerError).toHaveBeenCalledWith(synchronousFailure)
    expect(onListenerError).toHaveBeenCalledWith(asynchronousFailure)
  })
})
