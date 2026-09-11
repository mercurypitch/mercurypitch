// A tap in the hand, from the 3D worlds.
// ============================================================
//
// Through the app's own haptics port (@irchiinnuss/mobile-runtime), the
// same one Beside Cue's timer uses: `@capacitor/haptics` on a device, and
// in a browser the web port, which is `navigator.vibrate` behind a guard
// (Android Chrome buzzes; iOS Safari has no vibrate and stays silent).
// Chosen the way `createBesideCueMobileRuntime` chooses, and loaded the
// first time a world asks, so a player who never breaks glass never loads
// either.
//
// P5 (slice-5-polish-to-v1.md §2.1): no switch of the games' own. The
// system settings gate haptics on both platforms already.
//
// A tap never throws and never waits: a haptic that failed is a haptic
// that was not felt, and the frame that asked for it has a break to draw.

import { Capacitor } from '@capacitor/core'
import type { HapticImpactStyle, HapticsPort, } from '@irchiinnuss/mobile-runtime'

let port: Promise<HapticsPort | null> | null = null

const portFor = (): Promise<HapticsPort | null> => {
  port ??= (async (): Promise<HapticsPort | null> => {
    try {
      if (Capacitor.isNativePlatform()) {
        const { createCapacitorHapticsPort } =
          await import('@irchiinnuss/mobile-runtime/capacitor/haptics')
        return createCapacitorHapticsPort()
      }
      const { createWebHapticsPort } =
        await import('@irchiinnuss/mobile-runtime/web')
      return createWebHapticsPort()
    } catch {
      return null
    }
  })()
  return port
}

/** One impact, fired and forgotten. */
export const tap = (style: HapticImpactStyle): void => {
  void portFor()
    .then((p) => p?.impact(style))
    .catch(() => {
      // Not felt. Nothing else to do.
    })
}
