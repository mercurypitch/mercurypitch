// ============================================================
// Mobile runtime composition — one dependency object for application shells
// ============================================================

import type { HapticsPort, LocalNotificationsPort } from './contracts'

export interface MobileRuntime {
  readonly haptics: HapticsPort
  readonly localNotifications: LocalNotificationsPort
}

export function createMobileRuntime(runtime: MobileRuntime): MobileRuntime {
  return Object.freeze({
    haptics: runtime.haptics,
    localNotifications: runtime.localNotifications,
  })
}
