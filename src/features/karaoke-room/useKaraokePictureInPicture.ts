// ============================================================
// The Karaoke room's lyrics window: Android picture-in-picture, wired
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
// Android only. iOS has picture-in-picture for video alone, and the web has
// no device, so neither ever reports a window and nothing here changes them.

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, on, onCleanup } from 'solid-js'
import type { NativeDeviceApi } from '@/stores/native-shell-store'
import { setRoomInPictureInPicture } from '@/stores/native-shell-store'
import { karaokePictureInPicture } from './karaoke-room-store'

export interface KaraokePictureInPictureOptions {
  readonly device: NativeDeviceApi | null
  /** A song is playing now. */
  readonly playing: Accessor<boolean>
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
  const wanted = createMemo(
    () => karaokePictureInPicture() && options.playing(),
  )
  createEffect(on(wanted, setAutoEnter))
  onCleanup(() => {
    setAutoEnter(false)
  })

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
