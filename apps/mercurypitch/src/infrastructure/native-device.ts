// ============================================================
// The device, as the bridge hands it to a room under `src/`
// ============================================================
//
// What the Karaoke room needs and cannot import: the app's one AudioContext
// and its background hold (`packages/audio-io`, which the root package does
// not depend on), and the screen's keep-awake and the system's media controls
// (`@irchiinnuss/mobile-runtime/platform`, which eslint keeps out of `src/`).
// Registered once from `main.tsx` through `registerNativeDevice`; the web
// registers nothing.

import { acquireSharedAudioContext, holdSharedAudioContextInBackground, } from '@irchiinnuss/audio-io'
import { keepAwake, onMediaAction, setNowPlaying, } from '@irchiinnuss/mobile-runtime/platform'
import type { NativeDeviceApi } from '@/stores/native-shell-store'

export function createNativeDevice(): NativeDeviceApi {
  return {
    acquireAudio: (owner) => acquireSharedAudioContext(owner),
    keepAwake: (on) => {
      // A phone without the plugin keeps its own sleep rules; nothing about
      // a song is worth an unhandled rejection.
      void keepAwake(on).catch(() => undefined)
    },
    holdAudioInBackground: (owner) => holdSharedAudioContextInBackground(owner),
    nowPlaying: (song) => {
      // As with keep-awake: a phone without the plugin shows nothing.
      void setNowPlaying(song).catch(() => undefined)
    },
    onMediaAction: (handler) => onMediaAction(handler),
  }
}
