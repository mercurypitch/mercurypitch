// ============================================================
// The device, as the bridge hands it to a room under `src/`
// ============================================================
//
// Two things the Karaoke room needs and cannot import: the app's one
// AudioContext (`packages/audio-io`, which the root package does not depend
// on), and the screen's keep-awake (`@irchiinnuss/mobile-runtime/platform`,
// which eslint keeps out of `src/`). Registered once from `main.tsx` through
// `registerNativeDevice`; the web registers nothing.

import { acquireSharedAudioContext } from '@irchiinnuss/audio-io'
import { keepAwake } from '@irchiinnuss/mobile-runtime/platform'
import type { NativeDeviceApi } from '@/stores/native-shell-store'

export function createNativeDevice(): NativeDeviceApi {
  return {
    acquireAudio: (owner) => acquireSharedAudioContext(owner),
    keepAwake: (on) => {
      // A phone without the plugin keeps its own sleep rules; nothing about
      // a song is worth an unhandled rejection.
      void keepAwake(on).catch(() => undefined)
    },
  }
}
