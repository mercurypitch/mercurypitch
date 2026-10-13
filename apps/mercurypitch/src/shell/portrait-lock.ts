// ============================================================
// Portrait lock: a phone holds a premium room upright (decision D2)
// ============================================================
//
// The premium rooms are painted as portrait pictures, and a phone on its
// side would show a strip of one too small to sing with (ART-FIDELITY.md 8,
// D2). While a premium room is on top of the stack (premium-rooms.ts) a
// phone stays upright, and leaving the room lets it turn again. An iPad
// keeps turning, as D2 decides, and the web has no lock: holdPortrait does
// nothing there.
//
// One switch, held only while it is wanted: a room that never opens never
// touches the plugin.

import { holdPortrait } from '@irchiinnuss/mobile-runtime/platform'
import { createEffect, onCleanup } from 'solid-js'
import { deviceNoun } from '@/lib/device-noun'
import { isPremiumRoom } from './premium-rooms'
import { pushed } from './run-shell-store'

export interface PortraitLockDeps {
  /** A premium room is on top of the stack. */
  room: () => boolean
  /** The device in hand is a phone (not an iPad or a tablet). */
  phone: () => boolean
  /** Lock the screen upright, or let it turn. */
  hold: (on: boolean) => void
}

const DEVICE: PortraitLockDeps = {
  room: () => isPremiumRoom(pushed()),
  phone: () => deviceNoun() === 'phone',
  hold: (on) => {
    // A phone without the plugin keeps turning; nothing about a room is
    // worth an unhandled rejection.
    void holdPortrait(on).catch(() => undefined)
  },
}

/** Hold a phone upright while a premium room is open, for as long as the caller lives. */
export function installPortraitLock(deps: PortraitLockDeps = DEVICE): void {
  let held = false
  createEffect(() => {
    const want = deps.room() && deps.phone()
    if (want === held) return
    held = want
    deps.hold(want)
  })
  onCleanup(() => {
    if (!held) return
    held = false
    deps.hold(false)
  })
}
