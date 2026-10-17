// ============================================================
// Room life: a premium room's screen, from its first line to its cleanup
// ============================================================
//
// Echo, Long note and the glide rooms live the same way while their screen
// shows, and this is that life:
//
//   later      a timer that dies with the screen: nothing a room scheduled
//              runs once the screen has gone (`alive`)
//   watch      the singer leaving, whether the page hides or the app goes
//              with the page still showing (app-leave.ts); the screen kept
//              on while the room listens, or while its demo plays
//              (screen-awake.ts); the rail out of reach while the room
//              listens, for a room that holds it that way; and the app's
//              mic watchdog (mic-sentinel.ts), which stops a room whose
//              microphone died
//   dispose    the screen's end: no timer, no watch, the screen free to
//              sleep and the rail back
//
// A room makes its life first, since its timers are needed from its first
// lines, and watches once its leave and stop exist. It disposes the life
// last in its own cleanup, after stopping its loop and its sounds.

import { createEffect } from 'solid-js'
import { registerMicIndicator } from '@/lib/mic-sentinel'
import { setExerciseFocus } from '@/stores/native-shell-store'
import { onAppLeave } from './app-leave'
import { createScreenAwake } from './screen-awake'

/** What a room's screen watches, once the room's leave and stop exist. */
export interface RoomWatch {
  /** The singer left: the page hid, or the app went with it showing. */
  readonly leave: () => void
  /** The room hears the singer: a run, or a take, is on. */
  readonly listening: () => boolean
  /**
   * The demo: on, and playing. While it is on, the screen stays on only
   * while it plays.
   */
  readonly demo: {
    readonly on: () => boolean
    readonly playing: () => boolean
  }
  /**
   * The rail is out of reach while the room listens. Long note leaves this
   * out: its rail goes with the take's first voice, not with the mic.
   */
  readonly holdsFocus?: boolean
  /** The app's mic watchdog for this room. */
  readonly mic: {
    /** The exercise the mic's icon belongs to. */
    readonly exercise: string
    /** The icon is on: the room hears the singer. */
    readonly on: () => boolean
    /** The microphone died under the room. */
    readonly died: () => void
  }
}

export interface RoomLife {
  /** False once the screen has gone. */
  readonly alive: () => boolean
  /** Calls `fn` after `ms`, unless the screen has gone by then. */
  readonly later: (ms: number, fn: () => void) => void
  /** Watches the page, the app, the screen and the mic for the room. Once. */
  readonly watch: (watch: RoomWatch) => void
  /** The screen's end: no timer, no watch, the screen free to sleep. */
  readonly dispose: () => void
}

export function createRoomLife(): RoomLife {
  let alive = true
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let watching = false
  let unwatch = (): void => undefined

  return {
    alive: () => alive,
    later: (ms, fn) => {
      const id = setTimeout(() => {
        timers.delete(id)
        if (alive) fn()
      }, ms)
      timers.add(id)
    },
    watch: (watch) => {
      if (watching) throw new Error('A room watches its screen once')
      watching = true
      // The clock stops with the page, and a room must not go on without
      // the singer hearing it.
      const onVisibility = (): void => {
        if (document.visibilityState === 'hidden') watch.leave()
      }
      document.addEventListener('visibilitychange', onVisibility)
      // Or with the page still showing: the clock's park (app-leave.ts).
      const stopAppLeave = onAppLeave(watch.leave)

      const awake = createScreenAwake()
      createEffect(() => {
        const listening = watch.listening()
        awake.set(watch.demo.on() ? watch.demo.playing() : listening)
        if (watch.holdsFocus === true) setExerciseFocus(listening)
      })

      const unregisterIndicator = registerMicIndicator(
        watch.mic.exercise,
        watch.mic.on,
        watch.mic.died,
      )

      unwatch = () => {
        document.removeEventListener('visibilitychange', onVisibility)
        stopAppLeave()
        unregisterIndicator()
        awake.set(false)
        if (watch.holdsFocus === true) setExerciseFocus(false)
      }
    },
    dispose: () => {
      alive = false
      for (const id of timers) clearTimeout(id)
      timers.clear()
      unwatch()
      unwatch = () => undefined
    },
  }
}
