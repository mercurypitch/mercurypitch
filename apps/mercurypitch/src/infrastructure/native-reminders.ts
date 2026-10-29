// ============================================================
// Reminders, as the bridge hands them to the Ear Lab under `src/`
// ============================================================
//
// The Ear Lab with Merc's day's close can ask for a reminder each morning
// (src/features/ear-lab/merc/reminder.ts). It cannot import the plugin's
// wrappers (`@irchiinnuss/mobile-runtime/platform`, which eslint keeps out of
// `src/`), so they reach it through `NativeDeviceApi.reminders`, each
// carrying the Ear Lab as the tab a tap opens, which main.tsx then opens.
// Their Android status-bar icon is the plugin's default, which
// capacitor.config.ts names. Both only in a build with the Ear Lab with Merc
// (native-device.ts, main.tsx).

import { askForReminders, cancelReminders, onReminderTap, reminderPermission, scheduleReminders, } from '@irchiinnuss/mobile-runtime/platform'
import { createEffect, createRoot, createSignal, untrack } from 'solid-js'
import type { ActiveTab } from '@/features/tabs/constants'
import { TAB_EAR_LAB } from '@/features/tabs/constants'
import type { NativeReminders } from '@/stores/native-shell-store'

/** The tabs a tapped reminder may open the app on. */
const OPENED_BY_A_REMINDER: readonly ActiveTab[] = [TAB_EAR_LAB]

export function createNativeReminders(): NativeReminders {
  return {
    permission: () => reminderPermission(),
    ask: () => askForReminders(),
    schedule: (reminders) =>
      scheduleReminders(
        reminders.map((reminder) => ({
          ...reminder,
          extra: { tab: TAB_EAR_LAB },
        })),
      ),
    cancel: (ids) => cancelReminders(ids),
  }
}

/** Where a tapped reminder takes the app, and what it asks first. */
export interface ReminderShell {
  /** Go to a tab: the shell's goToTab, which parks a run on the tab it
   *  leaves. */
  open: (tab: ActiveTab) => void
  /** The tab on screen. */
  current: () => ActiveTab
  /** The shell has drawn, so a tab can be gone to. Read in a tracked
   *  scope: a tap held for it goes once it turns true. */
  ready: () => boolean
}

/**
 * A tapped reminder that names a tab opens the app on it. One that names
 * none, or a tab no reminder opens, leaves the app where it was, and so
 * does one tapped while its tab is already on screen: going there again
 * would park the run in progress. Once, from `main.tsx`, before the first
 * render: the plugin keeps the tap that started the app until something
 * listens, and a tap that comes before the shell has drawn waits for it.
 * Returns the unsubscribe.
 */
export function openTabFromReminders(shell: ReminderShell): () => void {
  return createRoot((dispose) => {
    const [tapped, setTapped] = createSignal<ActiveTab | null>(null)
    createEffect(() => {
      const tab = tapped()
      if (tab === null || !shell.ready()) return
      setTapped(null)
      untrack(() => {
        if (shell.current() !== tab) shell.open(tab)
      })
    })
    const stop = onReminderTap((tap) => {
      const named = tap.extra.tab
      const tab = OPENED_BY_A_REMINDER.find((known) => known === named)
      if (tab !== undefined) setTapped(tab)
    })
    return () => {
      stop()
      dispose()
    }
  })
}
