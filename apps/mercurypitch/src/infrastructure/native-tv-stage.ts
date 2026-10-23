// ============================================================
// The TV stage, as the bridge hands it to the Karaoke room
// ============================================================
//
// iOS: a TV connected to the phone that draws the room's stage while a test
// build's "Stage on a connected TV" is on (ios/App/App/LyricsWindow/
// TVStage.swift). The room hears whether the TV shows it and sends what to
// draw (src/features/karaoke-room/useKaraokeTvStage.ts); none of it exists
// on Android or the web, where no TV takes the stage.

import { onTvStage, pictureInPictureNeedsLyrics, readTvStage, sendTvStage, } from '@irchiinnuss/mobile-runtime/platform'
import type { NativeTvStage } from '@/stores/native-shell-store'

/**
 * Whether the TV shows the stage, as it stands and then on every change.
 * The first read is dropped if a change was heard before it came back, or
 * once the room has stopped listening.
 */
function watchTvStage(handler: (showing: boolean) => void): () => void {
  let heard = false
  let listening = true
  const stop = onTvStage((state) => {
    heard = true
    handler(state.showing)
  })
  void readTvStage().then((state) => {
    if (listening && !heard && state !== null) handler(state.showing)
  })
  return () => {
    listening = false
    stop()
  }
}

/** The stage on a connected TV, or null on a phone that cannot give one. */
export function createTvStage(): NativeTvStage | null {
  // The phone whose app draws on a TV itself is the one whose lyrics window
  // draws itself: iOS.
  if (!pictureInPictureNeedsLyrics()) return null
  return {
    watch: watchTvStage,
    send: (message) => {
      // A build without the stage shows nothing; a frame is not worth an
      // unhandled rejection.
      void sendTvStage(message).catch(() => undefined)
    },
  }
}
