import type { MobileRuntime } from './runtime'
import { createMobileRuntime } from './runtime'
import { createCapacitorHapticsPort } from './capacitor/haptics'
import type { CapacitorLocalNotificationsOptions } from './capacitor/local-notifications'
import { createCapacitorLocalNotificationsPort } from './capacitor/local-notifications'

export { createCapacitorHapticsPort } from './capacitor/haptics'
export type { CapacitorLocalNotificationsOptions } from './capacitor/local-notifications'
export { createCapacitorLocalNotificationsPort } from './capacitor/local-notifications'

export interface CapacitorMobileRuntimeOptions extends CapacitorLocalNotificationsOptions {}

/**
 * Convenience composition for apps that opt into both native capabilities.
 * Consumers that only need one capability can import its narrower subpath.
 */
export function createCapacitorMobileRuntime(
  options: CapacitorMobileRuntimeOptions = {},
): MobileRuntime {
  return createMobileRuntime({
    haptics: createCapacitorHapticsPort(),
    localNotifications: createCapacitorLocalNotificationsPort(options),
  })
}
