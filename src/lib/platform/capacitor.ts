// ============================================================
// Platform services — native (Capacitor) implementations.
// ============================================================
//
// The native build aliases `@/lib/platform` to this file (see
// vite.config.native.ts), so every consumer of the platform seam —
// including the `haptics` re-export in @/lib/haptics — transparently uses
// these plugin-backed impls. Web builds never resolve to this module, so
// @capacitor/* stays out of the browser bundles.
//
// Mirrors docs/plans/mobile-native/capacitor-readiness.md §F.

import { KeepAwake } from '@capacitor-community/keep-awake'
import { Browser } from '@capacitor/browser'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { Share } from '@capacitor/share'
import { StatusBar, Style } from '@capacitor/status-bar'
import type { PlatformServices } from './index'

export const capacitorPlatform: PlatformServices = {
  haptics: {
    tapLight: () => void Haptics.impact({ style: ImpactStyle.Light }),
    success: () => void Haptics.notification({ type: NotificationType.Success }),
    warning: () => void Haptics.notification({ type: NotificationType.Warning }),
  },
  keepAwake: {
    enable: () => KeepAwake.keepAwake().then(() => undefined),
    disable: () => KeepAwake.allowSleep().then(() => undefined),
  },
  statusBar: {
    setStyle: (s) =>
      void StatusBar.setStyle({
        style: s === 'dark' ? Style.Dark : Style.Light,
      }),
  },
  share: (data) =>
    Share.share(data)
      .then(() => true)
      .catch(() => false),
  openExternal: (url) => void Browser.open({ url }),
}

// Drop-in replacement for `@/lib/platform` under the native alias.
export const platform = capacitorPlatform
export type {
  HapticsService,
  KeepAwakeService,
  PlatformServices,
  StatusBarService,
} from './index'
