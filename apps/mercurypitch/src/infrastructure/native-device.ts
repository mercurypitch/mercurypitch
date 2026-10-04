// ============================================================
// The device, as the bridge hands it to a room under `src/`
// ============================================================
//
// What the Karaoke room needs and cannot import: the app's one AudioContext
// and its background hold (`packages/audio-io`, which the root package does
// not depend on), and the screen's keep-awake, the system's media controls
// and the picture-in-picture window (`@irchiinnuss/mobile-runtime/
// platform`, which eslint keeps out of `src/`).
// Registered once from `main.tsx` through `registerNativeDevice`; the web
// registers nothing.

import { acquireSharedAudioContext, holdSharedAudioContextInBackground, } from '@irchiinnuss/audio-io'
import { claimNowPlaying, keepAwake, micStopsOtherApps, onMediaAction, onNowPlayingHoldsAudio, onPictureInPicture, pictureInPictureNeedsLyrics, setNowPlaying, setPictureInPictureAutoEnter, setPictureInPictureLyrics, } from '@irchiinnuss/mobile-runtime/platform'
import { standUnlockClipAside } from '@/lib/audio-unlock'
import type { NativeDeviceApi } from '@/stores/native-shell-store'

/**
 * The picture the system's media controls show with every song: behind it in
 * Android's media player and its notification, beside it on the lock screen.
 * native-only/now-playing.webp, served at the bundle's root (native-assets.mjs).
 */
const NOW_PLAYING_ARTWORK = '/now-playing.webp'

export function createNativeDevice(): NativeDeviceApi {
  return {
    micStopsOtherApps: micStopsOtherApps(),
    acquireAudio: (owner, options) => acquireSharedAudioContext(owner, options),
    keepAwake: (on) => {
      // A phone without the plugin keeps its own sleep rules; nothing about
      // a song is worth an unhandled rejection.
      void keepAwake(on).catch(() => undefined)
    },
    holdAudioInBackground: (owner) => holdSharedAudioContextInBackground(owner),
    nowPlaying: (song) => {
      // As with keep-awake: a phone without the plugin shows nothing.
      void setNowPlaying(
        song === null ? null : { ...song, artwork: NOW_PLAYING_ARTWORK },
      ).catch(() => undefined)
    },
    onMediaAction: (handler) => onMediaAction(handler),
    pictureInPictureAutoEnter: (on) => {
      // A phone without the window leaves the app as it always did.
      void setPictureInPictureAutoEnter(on).catch(() => undefined)
    },
    onPictureInPicture: (handler) => onPictureInPicture(handler),
    pictureInPictureLyrics: pictureInPictureNeedsLyrics()
      ? (script) => {
          // As with the window itself: a phone without it shows nothing.
          void setPictureInPictureLyrics(script).catch(() => undefined)
        }
      : null,
  }
}

/**
 * While iOS's lock-screen carrier holds the playback session, the silent
 * unlock clip stands aside, so the two never compete for the lock screen or
 * a headset's press (see standUnlockClipAside), and a press of play has the
 * carrier take the session in its place. Once, from `main.tsx`.
 */
export function standUnlockClipAsideForNowPlaying(): () => void {
  return onNowPlayingHoldsAudio((holds) => {
    // Aside, a press of play has the carrier take the session instead.
    standUnlockClipAside(holds, claimNowPlaying)
  })
}
