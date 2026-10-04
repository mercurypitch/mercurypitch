// ============================================================
// The Karaoke room's lyrics window: picture-in-picture, wired
// ============================================================
//
// With "Show lyrics in a small window" on, the default, a singer who leaves
// the app while a song plays keeps the room in a floating window, as a video
// app's player does, and can work in other apps under it. The room draws a
// compact view into it: the line being sung, the next, the title.
//
// Auto-enter is on for exactly as long as a song is playing with the setting
// on, so a paused song, an empty stage or a room that is gone leaves the app
// the ordinary way. Turning it off does not close a window already open.
//
// The window is somewhere other than the room, so it gets what leaving the
// app gets: the microphone goes the moment the window opens (`onEnter`). A
// hot microphone behind someone else's app is not something a singer asked
// for. The room turns it back on once they are back (`onExit`).
//
// The shell is told (`setRoomInPictureInPicture`), so it takes its own
// chrome off the screen while the window is up; the room cannot reach that.
//
// Android shrinks the whole app into the window, and the room draws a compact
// view of itself there (KaraokeLyricsWindow.tsx). iOS puts only video in its
// window, so there the app draws the lyrics natively, from the whole song's
// lyrics worked out ahead (`lyrics`, sent while the window could open) and
// the clock of the lock screen's reports. The page is hidden behind another
// app meanwhile, and the room pauses a song the singer leaves unless "Keep
// playing in the background" is on, so on iOS the window arms only with it
// on. The web has no device and never reports a window.

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, on, onCleanup } from 'solid-js'
import type { LyricWindowScript } from '@/lib/lyric-window-script'
import type { NativeDeviceApi } from '@/stores/native-shell-store'
import { setRoomInPictureInPicture } from '@/stores/native-shell-store'
import { karaokePictureInPicture } from './karaoke-room-store'

export interface KaraokePictureInPictureOptions {
  readonly device: NativeDeviceApi | null
  /** A song is playing now. */
  readonly playing: Accessor<boolean>
  /**
   * "Keep playing in the background", which a window that draws itself
   * (iOS) needs: without it the song pauses as the app is left.
   */
  readonly backgroundPlay: Accessor<boolean>
  /**
   * The song's lyrics worked out ahead, or null without a song: what a
   * window that draws itself shows. Never read on a phone whose window
   * shows the page.
   */
  readonly lyrics: Accessor<LyricWindowScript | null>
  /** The window opened: let go of what the room should not hold in there. */
  readonly onEnter: () => void
  /** The window closed, back to the full app or away with the window. */
  readonly onExit?: () => void
}

/** Whether the room is in the window now. */
export function useKaraokePictureInPicture(
  options: KaraokePictureInPictureOptions,
): Accessor<boolean> {
  const device = options.device
  const [inWindow, setInWindow] = createSignal(false)
  if (device === null) return inWindow

  // Told only of a change, and told off on the way out if it was ever on.
  let autoEnter = false
  const setAutoEnter = (on: boolean): void => {
    if (on === autoEnter) return
    autoEnter = on
    device.pictureInPictureAutoEnter(on)
  }
  const showLyrics = device.pictureInPictureLyrics
  const possible = (): boolean =>
    karaokePictureInPicture() &&
    (showLyrics === null || options.backgroundPlay())
  const wanted = createMemo(() => possible() && options.playing())
  createEffect(on(wanted, setAutoEnter))
  onCleanup(() => {
    setAutoEnter(false)
  })

  // The lyrics for a window that draws itself, for as long as one could
  // open, and null once it cannot, which closes one that is open.
  if (showLyrics !== null) {
    const lyrics = createMemo(() => (possible() ? options.lyrics() : null))
    createEffect(on(lyrics, showLyrics))
    onCleanup(() => {
      showLyrics(null)
    })
  }

  onCleanup(
    device.onPictureInPicture((entered) => {
      setInWindow(entered)
      if (entered) options.onEnter()
      else options.onExit?.()
    }),
  )

  createEffect(
    on(inWindow, (entered) => {
      setRoomInPictureInPicture(entered)
    }),
  )
  onCleanup(() => {
    setRoomInPictureInPicture(false)
  })

  return inWindow
}
