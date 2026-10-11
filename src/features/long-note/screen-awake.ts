// ============================================================
// The screen stays on while the Long note listens
// ============================================================
//
// A hidden page ends the hold (useLongNoteController's visibility rule),
// and the singer's last touch is the mic button: a phone that locks 30 s
// after a touch (Low Power Mode on an iPhone, a common Android timeout)
// hid the page mid-note and ended the hold there (review B of PR 973, M2).
// Karaoke's rule: the native device's keep-awake switch, on while it is
// needed and only then (KaraokeRoomStage.tsx). Without a native device
// (the web, a test) the platform's wake lock does it.

import { untrack } from 'solid-js'
import { platform } from '@/lib/platform'
import { nativeDeviceApi } from '@/stores/native-shell-store'

export interface ScreenAwake {
  /** Keep the screen on, or let it sleep; a repeat changes nothing. */
  set: (on: boolean) => void
}

export function createScreenAwake(): ScreenAwake {
  const device = untrack(nativeDeviceApi)
  let awake = false
  return {
    set: (on) => {
      if (on === awake) return
      awake = on
      if (device !== null) device.keepAwake(on)
      else if (on) void platform.keepAwake.enable()
      else void platform.keepAwake.disable()
    },
  }
}
