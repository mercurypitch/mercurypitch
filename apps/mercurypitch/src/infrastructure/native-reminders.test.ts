// ============================================================
// Native reminders: the Ear Lab's mornings reach the phone
// ============================================================
//
// The day's close under `src/` sets its reminders through the bridge
// (NativeDeviceApi.reminders), and this is the side of it that the app
// fills in: the platform package's wrappers, with Android's status-bar
// icon, and a tap that opens the app on the Ear Lab. main.tsx listens for
// that tap before the first render, behind the Ear Lab with Merc's switch.

import type { ReminderTap } from '@irchiinnuss/mobile-runtime/platform'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createNativeReminders, openTabFromReminders, REMINDER_ICON, REMINDER_ICON_COLOR, } from './native-reminders'

const platform = vi.hoisted(() => {
  const taps: ((tap: ReminderTap) => void)[] = []
  return {
    taps,
    reminderPermission: vi.fn(async () => 'granted' as const),
    askForReminders: vi.fn(async () => 'denied' as const),
    scheduleReminders: vi.fn(async (_reminders: unknown) => true),
    cancelReminders: vi.fn(async (_ids: readonly number[]) => true),
    onReminderTap: vi.fn((handler: (tap: ReminderTap) => void) => {
      taps.push(handler)
      return vi.fn()
    }),
  }
})

vi.mock('@irchiinnuss/mobile-runtime/platform', () => platform)

afterEach(() => {
  vi.clearAllMocks()
  platform.taps.length = 0
})

describe('createNativeReminders', () => {
  it("hands the Ear Lab the platform's answers", async () => {
    const reminders = createNativeReminders()

    await expect(reminders.permission()).resolves.toBe('granted')
    await expect(reminders.ask()).resolves.toBe('denied')
    await expect(reminders.cancel([8301, 8302])).resolves.toBe(true)
    expect(platform.cancelReminders).toHaveBeenCalledWith([8301, 8302])
  })

  it("schedules each with this app's status-bar icon, opening the Ear Lab", async () => {
    const at = new Date(2026, 9, 30, 8, 30)

    await createNativeReminders().schedule([
      {
        id: 8301,
        title: 'Merc',
        body: "Today's three are waiting in the Ear Lab.",
        at,
      },
    ])

    expect(platform.scheduleReminders).toHaveBeenCalledWith([
      {
        id: 8301,
        title: 'Merc',
        body: "Today's three are waiting in the Ear Lab.",
        at,
        smallIcon: REMINDER_ICON,
        iconColor: REMINDER_ICON_COLOR,
        extra: { tab: 'ear-lab' },
      },
    ])
  })

  it('names an icon the Android app draws, and keeps from the shrinker', () => {
    const drawable = readFileSync(
      new URL(
        `../../android/app/src/main/res/drawable/${REMINDER_ICON}.xml`,
        import.meta.url,
      ),
      'utf8',
    )
    const keep = readFileSync(
      new URL(
        '../../android/app/src/main/res/raw/keep_reminder_icon.xml',
        import.meta.url,
      ),
      'utf8',
    )
    expect(drawable).toContain('<vector')
    expect(keep).toContain(`tools:keep="@drawable/${REMINDER_ICON}"`)
  })
})

describe('openTabFromReminders', () => {
  it('opens the app on the Ear Lab from a reminder that names it', () => {
    const open = vi.fn()
    openTabFromReminders(open)

    platform.taps[0]?.({ id: 8301, extra: { tab: 'ear-lab' } })

    expect(open.mock.calls).toEqual([['ear-lab']])
  })

  it('leaves the app where it was for a reminder naming no tab it opens', () => {
    const open = vi.fn()
    openTabFromReminders(open)

    platform.taps[0]?.({ id: 1, extra: {} })
    platform.taps[0]?.({ id: 2, extra: { tab: 'karaoke' } })
    platform.taps[0]?.({ id: 3, extra: { tab: 42 } })

    expect(open).not.toHaveBeenCalled()
  })
})

describe('main.tsx', () => {
  it('listens for a tap before the first render, behind the Ear Lab with Merc', () => {
    const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')
    const listen = main.indexOf(
      '\nif (EAR_LAB_WITH_MERC) openTabFromReminders(goToTab)',
    )
    expect(listen).toBeGreaterThan(-1)
    expect(listen).toBeLessThan(main.indexOf('render('))
  })
})
