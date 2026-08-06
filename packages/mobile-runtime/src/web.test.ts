// ============================================================
// Web mobile runtime tests — foreground timing and safe fallback behavior
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_NOTIFICATION_ID, MIN_NOTIFICATION_ID, notificationId, } from './contracts'
import type { WebForegroundNotification } from './web'
import { createWebHapticsPort, createWebLocalNotificationsPort, createWebMobileRuntime, } from './web'

describe('notificationId', () => {
  it('accepts the complete signed int32 range', () => {
    expect(notificationId(MIN_NOTIFICATION_ID)).toBe(MIN_NOTIFICATION_ID)
    expect(notificationId(MAX_NOTIFICATION_ID)).toBe(MAX_NOTIFICATION_ID)
  })

  it.each([NaN, 1.5, MIN_NOTIFICATION_ID - 1, MAX_NOTIFICATION_ID + 1])(
    'rejects invalid value %s',
    (value) => {
      expect(() => notificationId(value)).toThrow(RangeError)
    },
  )
})

describe('web haptics', () => {
  it('maps semantic feedback to short vibration patterns', async () => {
    const vibrate = vi.fn(() => true)
    const haptics = createWebHapticsPort({ vibrate })

    await haptics.impact('light')
    await haptics.notification('success')

    expect(vibrate).toHaveBeenNthCalledWith(1, 10)
    expect(vibrate).toHaveBeenNthCalledWith(2, [15, 30, 40])
  })

  it('stays safe when vibration is absent or rejected', async () => {
    await expect(createWebHapticsPort(null).impact('medium')).resolves.toBe(
      undefined,
    )

    const haptics = createWebHapticsPort({
      vibrate() {
        throw new Error('gesture required')
      },
    })
    await expect(haptics.notification('warning')).resolves.toBe(undefined)
  })
})

describe('web local notifications', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-06T09:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reports that OS notification permission is unsupported', async () => {
    const port = createWebLocalNotificationsPort({
      onForegroundNotification: vi.fn(),
    })

    await expect(port.checkPermission()).resolves.toBe('unsupported')
    await expect(port.requestPermission()).resolves.toBe('unsupported')
  })

  it('delivers a scheduled notification through the foreground callback', async () => {
    const deliveries: WebForegroundNotification[] = []
    const port = createWebLocalNotificationsPort({
      onForegroundNotification: (delivery) => {
        deliveries.push(delivery)
      },
    })

    await port.schedule([
      {
        id: notificationId(41),
        title: 'Notice',
        body: 'A gentle cue',
        schedule: {
          kind: 'at',
          at: new Date('2026-08-06T09:00:05.000Z'),
        },
      },
    ])

    await vi.advanceTimersByTimeAsync(4_999)
    expect(deliveries).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(1)
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0]?.notification.id).toBe(41)
  })

  it('cancels pending timers and replaces a pending notification with the same id', async () => {
    const deliveredTitles: string[] = []
    const port = createWebLocalNotificationsPort({
      onForegroundNotification: ({ notification }) => {
        deliveredTitles.push(notification.title)
      },
    })
    const replacedId = notificationId(7)
    const cancelledId = notificationId(8)

    await port.schedule([
      {
        id: replacedId,
        title: 'Old',
        body: 'Old body',
        schedule: {
          kind: 'at',
          at: new Date('2026-08-06T09:00:02.000Z'),
        },
      },
      {
        id: cancelledId,
        title: 'Cancelled',
        body: 'Cancelled body',
        schedule: {
          kind: 'at',
          at: new Date('2026-08-06T09:00:03.000Z'),
        },
      },
    ])
    await port.schedule([
      {
        id: replacedId,
        title: 'New',
        body: 'New body',
        schedule: {
          kind: 'at',
          at: new Date('2026-08-06T09:00:04.000Z'),
        },
      },
    ])
    await port.cancel([cancelledId])

    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(deliveredTitles).toEqual(['New'])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('re-arms one recurring daily timer and releases it on cancellation', async () => {
    const start = new Date(2026, 7, 6, 9, 0, 0)
    vi.setSystemTime(start)
    const delivery = vi.fn()
    const port = createWebLocalNotificationsPort({
      onForegroundNotification: delivery,
    })
    const id = notificationId(81)

    await port.schedule([
      {
        id,
        title: 'Daily notice',
        body: 'One gentle cue',
        schedule: { kind: 'daily', hour: 9, minute: 1 },
      },
    ])

    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(delivery).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(1)

    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1_000)
    expect(delivery).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(1)

    await port.cancel([id])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('routes foreground actions to listeners and honors listener removal', async () => {
    const deliveries: WebForegroundNotification[] = []
    const listener = vi.fn()
    const port = createWebLocalNotificationsPort({
      onForegroundNotification: (delivery) => {
        deliveries.push(delivery)
      },
    })
    const handle = await port.addActionListener(listener)

    await port.schedule([
      {
        id: notificationId(12),
        title: 'Notice',
        body: 'Open the cue',
        schedule: {
          kind: 'at',
          at: new Date('2026-08-06T09:00:01.000Z'),
        },
        extra: { route: '/cue/12' },
      },
    ])
    await vi.advanceTimersByTimeAsync(1_000)
    await deliveries[0]?.performAction('open')

    expect(listener).toHaveBeenCalledWith({
      notificationId: 12,
      actionId: 'open',
      extra: { route: '/cue/12' },
    })

    await handle.remove()
    await deliveries[0]?.performAction('open-again')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('reports synchronous and asynchronous delivery callback failures', async () => {
    const onError = vi.fn()
    const synchronousError = new Error('sync delivery failed')
    const asynchronousError = new Error('async delivery failed')
    const onForegroundNotification = vi
      .fn()
      .mockImplementationOnce(() => {
        throw synchronousError
      })
      .mockRejectedValueOnce(asynchronousError)
    const port = createWebLocalNotificationsPort({
      onForegroundNotification,
      onError,
    })

    await port.schedule([
      {
        id: notificationId(20),
        title: 'First',
        body: 'First body',
        schedule: {
          kind: 'at',
          at: new Date('2026-08-06T09:00:01.000Z'),
        },
      },
      {
        id: notificationId(21),
        title: 'Second',
        body: 'Second body',
        schedule: {
          kind: 'at',
          at: new Date('2026-08-06T09:00:02.000Z'),
        },
      },
    ])

    await vi.advanceTimersByTimeAsync(2_000)
    expect(onError).toHaveBeenNthCalledWith(1, synchronousError)
    expect(onError).toHaveBeenNthCalledWith(2, asynchronousError)
  })

  it('rejects duplicate ids before scheduling any timer', async () => {
    const onForegroundNotification = vi.fn()
    const port = createWebLocalNotificationsPort({
      onForegroundNotification,
    })
    const id = notificationId(99)

    await expect(
      port.schedule([
        {
          id,
          title: 'First',
          body: 'First body',
          schedule: {
            kind: 'at',
            at: new Date('2026-08-06T09:00:01.000Z'),
          },
        },
        {
          id,
          title: 'Second',
          body: 'Second body',
          schedule: {
            kind: 'at',
            at: new Date('2026-08-06T09:00:02.000Z'),
          },
        },
      ]),
    ).rejects.toThrow('occurs more than once')

    await vi.advanceTimersByTimeAsync(3_000)
    expect(onForegroundNotification).not.toHaveBeenCalled()
  })

  it.each([
    { hour: -1, minute: 0 },
    { hour: 24, minute: 0 },
    { hour: 9.5, minute: 0 },
    { hour: 9, minute: -1 },
    { hour: 9, minute: 60 },
    { hour: 9, minute: 1.5 },
  ])('rejects an invalid daily wall-clock schedule: %o', async (schedule) => {
    const port = createWebLocalNotificationsPort({
      onForegroundNotification: vi.fn(),
    })

    await expect(
      port.schedule([
        {
          id: notificationId(100),
          title: 'Invalid',
          body: 'Invalid time',
          schedule: { kind: 'daily', ...schedule },
        },
      ]),
    ).rejects.toThrow('invalid daily wall-clock time')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('composes the web ports into an immutable runtime', () => {
    const runtime = createWebMobileRuntime({
      vibrationTarget: null,
      onForegroundNotification: vi.fn(),
    })

    expect(Object.isFrozen(runtime)).toBe(true)
    expect(runtime.haptics).toBeDefined()
    expect(runtime.localNotifications).toBeDefined()
  })
})
