// ============================================================
// Notification-free port — for an app that schedules nothing
// ============================================================
//
// The counterpart to `unavailable-purchases.ts`, and it exists for the same
// reason: `MobileRuntime` names four capabilities, and an app that wants one
// of them should not have to install the plugin behind another.
//
// That is hazard 3 from the native plan in one sentence. Composing through
// `./capacitor` pulls in every adapter, and every adapter pulls in its plugin
// at module scope — so an app with no reminders still ships
// `@capacitor/local-notifications`, and calls it through a bridge where the
// plugin was never registered. This port is what such an app composes
// instead: permission reads answer `'unsupported'`, which is the truth, and
// the writes do nothing rather than failing a start-up path.
//
// Scheduling is deliberately silent rather than throwing. A notification is
// an app telling someone something later; an app that has nothing to say
// later is not in an error state, and a product feature-detects this port
// through `checkPermission()` returning `'unsupported'`.

import type { LocalNotificationActionListener, LocalNotificationListenerHandle, LocalNotificationsPort, } from './contracts'

export function createUnavailableLocalNotificationsPort(): LocalNotificationsPort {
  return {
    async checkPermission() {
      return 'unsupported'
    },
    async requestPermission() {
      return 'unsupported'
    },
    async createChannel() {
      // No channel can exist without a notification service behind it.
    },
    async schedule() {
      // Nothing is scheduled, and nothing will arrive. See the header.
    },
    async cancel() {
      // Nothing was scheduled, so there is nothing to cancel.
    },
    async removeDelivered() {
      // Nothing was delivered either.
    },
    async addActionListener(
      _listener: LocalNotificationActionListener,
    ): Promise<LocalNotificationListenerHandle> {
      return {
        async remove() {
          // No action can arrive, so there is nothing to detach.
        },
      }
    },
  }
}
