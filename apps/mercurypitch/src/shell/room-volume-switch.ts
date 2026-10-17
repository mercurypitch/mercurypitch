// ============================================================
// "One volume in rooms": the Developer screen's switch for a room's visit
// ============================================================
//
// On, a premium room asks WebKit for its play-and-record session from the
// door to the way out (room-visit.ts), so the mic opening and closing no
// longer moves iOS between its media level and its call level. Off, the
// room leaves the session to WebKit, as it did before, so a tester can hear
// the difference on one phone. A room reads it as it opens.
//
// On by default, and kept on the phone only as an off. Read only in a build
// with the portable console, and read inline (portable-console.ts says why):
// a store build has no Developer screen to turn it off from, and folds it to
// the default, whatever a TestFlight build before it left in storage. The
// signal is made on first read for the same reason as the Karaoke switches
// (stream-switches.ts): a module-level call is one a bundler has to keep.

import type { Accessor, Setter } from 'solid-js'
import { createSignal } from 'solid-js'

export const ONE_VOLUME_KEY = 'mp:dev-one-volume-in-rooms'

function storedOn(): boolean {
  try {
    return localStorage.getItem(ONE_VOLUME_KEY) !== '0'
  } catch {
    return true
  }
}

function store(on: boolean): void {
  try {
    if (on) localStorage.removeItem(ONE_VOLUME_KEY)
    else localStorage.setItem(ONE_VOLUME_KEY, '0')
  } catch {
    // Storage refused: the switch holds for this session only.
  }
}

interface Switch {
  read: Accessor<boolean>
  write: Setter<boolean>
}

let oneVolume: Switch | undefined

function oneVolumeSwitch(): Switch {
  if (oneVolume === undefined) {
    const [read, write] = createSignal(storedOn())
    oneVolume = { read, write }
  }
  return oneVolume
}

/** A premium room keeps one session, and one volume, for its whole visit. */
export function oneVolumeInRooms(): boolean {
  return (
    import.meta.env.VITE_PORTABLE_CONSOLE !== 'true' || oneVolumeSwitch().read()
  )
}

export function setOneVolumeInRooms(on: boolean): void {
  store(on)
  oneVolumeSwitch().write(on)
}

/** The switch as storage has it, for a test that changed storage. */
export function reloadOneVolumeForTests(): void {
  oneVolumeSwitch().write(storedOn())
}
