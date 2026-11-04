// ============================================================
// Which TV it is: its name, from where the sound goes
// ============================================================
//
// A screen that connects says nothing of who it is: iOS gives the app an
// external display and a size. The sound's route does say: Screen Mirroring
// carries the sound over AirPlay, and the route's port is named after the
// TV as the TV names itself ("LG webOS TV OLED48C24LA"); a cable's is the
// HDMI port's (audio-route-store.ts, `audioRoutePort`). So a TV is known by
// that name, and only on those two routes: on any other, the port is the
// phone's own speaker or a headset, which names no TV.
//
// THE ROUTE SETTLES AFTER THE SCREEN. iOS moves the sound once mirroring is
// up, and the app hears the move as a change of route a moment later. The
// route as the screen arrives may still be the one before it, which can be
// an AirPlay speaker with a name of its own, so a name is taken from the
// first move of the route that names a TV; with no such move by
// TV_NAME_WAIT_MS, from what the route names then, where it names a TV at
// all (the sound was on that TV's AirPlay already). Otherwise the TV goes
// without a name: on the owner's iPhone 13 Pro the app's own session
// reported the speaker throughout while the TV took the sound (MISTAKES.md,
// "Do not take the app's AVAudioSession route for WebKit's"), and there no
// name ever comes. The bound is a guess until a device test times it; the
// console line the chooser writes says how long each wait took.

import type { Accessor } from 'solid-js'
import { createEffect, createRoot, on } from 'solid-js'
import { audioRoute, audioRoutePort } from '@/stores/audio-route-store'
import type { NativeAudioRoute } from '@/stores/native-shell-store'

/** How long a TV that just connected waits for its name, in ms. */
export const TV_NAME_WAIT_MS = 2000

/** The routes whose port is the TV itself. */
const TV_ROUTES: ReadonlySet<NativeAudioRoute> = new Set(['airplay', 'hdmi'])

/** The TV's name, where the route goes to a TV and its port has a name. */
export function tvNameOf(
  route: NativeAudioRoute | null,
  port: string | null,
): string | null {
  if (route === null || !TV_ROUTES.has(route)) return null
  const name = port?.trim() ?? ''
  return name === '' ? null : name
}

export interface TvNameWaitOptions {
  /** Test seam. The phone's route otherwise. */
  readonly route?: Accessor<NativeAudioRoute | null>
  /** Test seam. The route's port otherwise. */
  readonly port?: Accessor<string | null>
  /** How long to wait, in ms: TV_NAME_WAIT_MS unless a test says. */
  readonly waitMs?: number
}

/** A wait for the TV's name, and the way to stop it. */
export interface TvNameWait {
  /** The name, as soon as the route gives one, or null once the wait ends. */
  readonly name: Promise<string | null>
  /** Stop waiting: the name resolves to null, if it has not come. */
  cancel(): void
}

/**
 * Wait for the route to settle on the TV: its first move that names one,
 * or at `waitMs` what it names then, or null.
 */
export function waitForTvName(options: TvNameWaitOptions = {}): TvNameWait {
  const route = options.route ?? audioRoute
  const port = options.port ?? audioRoutePort
  let settle: (name: string | null) => void = () => undefined
  const name = new Promise<string | null>((resolve) => {
    settle = resolve
  })
  let done = false
  let stopWatching: () => void = () => undefined

  const finish = (found: string | null): void => {
    if (done) return
    done = true
    clearTimeout(timer)
    stopWatching()
    settle(found)
  }

  createRoot((dispose) => {
    stopWatching = dispose
    // A move from here on: the route as the screen came does not count yet.
    createEffect(
      on(
        [route, port],
        ([movedTo, itsPort]) => {
          const found = tvNameOf(movedTo, itsPort)
          if (found !== null) finish(found)
        },
        { defer: true },
      ),
    )
  })
  const timer = setTimeout(() => {
    finish(tvNameOf(route(), port()))
  }, options.waitMs ?? TV_NAME_WAIT_MS)

  return {
    name,
    cancel: () => {
      finish(null)
    },
  }
}
