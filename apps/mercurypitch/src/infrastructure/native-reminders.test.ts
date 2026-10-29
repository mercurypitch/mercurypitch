// ============================================================
// Native reminders: the Ear Lab's mornings reach the phone
// ============================================================
//
// The day's close under `src/` sets its reminders through the bridge
// (NativeDeviceApi.reminders), and this is the side of it that the app
// fills in: the platform package's wrappers, and a tap that opens the app
// on the Ear Lab, unless it is there already, once the shell has drawn.
// main.tsx listens for that tap before the first render, behind the Ear Lab
// with Merc's switch. Android's icon for them is the plugin's default, which
// capacitor.config.ts names.

import type { ReminderTap } from '@irchiinnuss/mobile-runtime/platform'
import { readFileSync } from 'node:fs'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ActiveTab } from '@/features/tabs/constants'
import type { ReminderShell } from './native-reminders'
import { createNativeReminders, openTabFromReminders } from './native-reminders'

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

const stops: (() => void)[] = []

afterEach(() => {
  for (const stop of stops.splice(0)) stop()
  vi.clearAllMocks()
  platform.taps.length = 0
})

/** A shell on `tab`, drawn or not yet. */
function shellOn(tab: ActiveTab, drawn = true) {
  const [ready, setReady] = createSignal(drawn)
  const open = vi.fn<(tab: ActiveTab) => void>()
  const shell: ReminderShell = { open, current: () => tab, ready }
  stops.push(openTabFromReminders(shell))
  return { open, setReady }
}

const tap = (extra: Record<string, unknown>): void =>
  platform.taps[0]?.({ id: 8301, extra })

describe('createNativeReminders', () => {
  it("hands the Ear Lab the platform's answers", async () => {
    const reminders = createNativeReminders()

    await expect(reminders.permission()).resolves.toBe('granted')
    await expect(reminders.ask()).resolves.toBe('denied')
    await expect(reminders.cancel([8301, 8302])).resolves.toBe(true)
    expect(platform.cancelReminders).toHaveBeenCalledWith([8301, 8302])
  })

  it('schedules each to open the Ear Lab when tapped', async () => {
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
        extra: { tab: 'ear-lab' },
      },
    ])
  })

  it('names an icon the Android app draws, and keeps from the shrinker', () => {
    const read = (path: string): string =>
      readFileSync(new URL(path, import.meta.url), 'utf8')
    const config = read('../../capacitor.config.ts')
    const icon = /LocalNotifications: \{\s*smallIcon: '([\w]+)'/u.exec(
      config,
    )?.[1]

    expect(icon).toBe('ic_stat_reminder')
    expect(
      read(`../../android/app/src/main/res/drawable/${icon}.xml`),
    ).toContain('<vector')
    expect(
      read('../../android/app/src/main/res/raw/keep_reminder_icon.xml'),
    ).toContain(`tools:keep="@drawable/${icon}"`)
  })
})

describe('openTabFromReminders', () => {
  it('opens the app on the Ear Lab from a reminder that names it', () => {
    const { open } = shellOn('home')

    tap({ tab: 'ear-lab' })

    expect(open.mock.calls).toEqual([['ear-lab']])
  })

  it('leaves the app where it was for a reminder naming no tab it opens', () => {
    const { open } = shellOn('home')

    tap({})
    tap({ tab: 'karaoke' })
    tap({ tab: 42 })

    expect(open).not.toHaveBeenCalled()
  })

  it('does nothing when the Ear Lab is already on screen: a run there stays', () => {
    const { open } = shellOn('ear-lab')

    tap({ tab: 'ear-lab' })

    expect(open).not.toHaveBeenCalled()
  })

  it('holds a tap that comes before the shell has drawn, then goes', () => {
    const { open, setReady } = shellOn('home', false)

    tap({ tab: 'ear-lab' })
    expect(open).not.toHaveBeenCalled()

    setReady(true)
    expect(open.mock.calls).toEqual([['ear-lab']])
    // Once: the held tap is spent.
    setReady(false)
    setReady(true)
    expect(open).toHaveBeenCalledTimes(1)
  })
})

describe('main.tsx', () => {
  it('listens for a tap before the first render, behind the Ear Lab with Merc', () => {
    const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')
    const listen = main.indexOf(
      '\nif (EAR_LAB_WITH_MERC) {\n  openTabFromReminders({',
    )
    expect(listen).toBeGreaterThan(-1)
    expect(listen).toBeLessThan(main.indexOf('render('))
    // The tab on screen and the shell's own registration, read as the tap
    // comes.
    expect(main).toMatch(/current: currentTab,/u)
    expect(main).toMatch(/ready: \(\) => nativeShellApi\(\) !== null,/u)
  })
})
