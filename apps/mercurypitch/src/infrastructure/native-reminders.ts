// ============================================================
// Reminders, as the bridge hands them to the Ear Lab under `src/`
// ============================================================
//
// The Ear Lab with Merc's day's close can ask for a reminder each morning
// (src/features/ear-lab/merc/reminder.ts). It cannot import the plugin's
// wrappers (`@irchiinnuss/mobile-runtime/platform`, which eslint keeps out of
// `src/`), so they reach it through `NativeDeviceApi.reminders`. Each wears
// the status-bar icon this app draws for them on Android and carries the
// Ear Lab as the tab a tap opens, which main.tsx then opens. Both only in a
// build with the Ear Lab with Merc (native-device.ts, main.tsx).

import { askForReminders, cancelReminders, onReminderTap, reminderPermission, scheduleReminders, } from '@irchiinnuss/mobile-runtime/platform'
import type { ActiveTab } from '@/features/tabs/constants'
import { TAB_EAR_LAB } from '@/features/tabs/constants'
import type { NativeReminders } from '@/stores/native-shell-store'

/** android/app/src/main/res/drawable/ic_stat_reminder.xml: the mark, white
 *  on clear, as Android wants a status-bar icon. iOS shows the app's own. */
export const REMINDER_ICON = 'ic_stat_reminder'
/** The Ear Lab's brass, which Android tints that icon with in the shade. */
export const REMINDER_ICON_COLOR = '#c9a45e'

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
          smallIcon: REMINDER_ICON,
          iconColor: REMINDER_ICON_COLOR,
          extra: { tab: TAB_EAR_LAB },
        })),
      ),
    cancel: (ids) => cancelReminders(ids),
  }
}

/**
 * A tapped reminder that names a tab opens the app on it; one that names
 * none, or a tab no reminder opens, leaves the app where it was. Once, from
 * `main.tsx`, before the first render: the plugin keeps the tap that started
 * the app until something listens. Returns the unsubscribe.
 */
export function openTabFromReminders(
  open: (tab: ActiveTab) => void,
): () => void {
  return onReminderTap((tap) => {
    const named = tap.extra.tab
    const tab = OPENED_BY_A_REMINDER.find((known) => known === named)
    if (tab !== undefined) open(tab)
  })
}
