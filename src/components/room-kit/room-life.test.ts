// ============================================================
// Room life: timers that die with the screen, and the screen's watch
// ============================================================
//
// The real page, app-leave, screen-awake, mic watchdog and shell store
// throughout: only the phone's keep-awake switch is a stand-in (a native
// device), and the clocks are fake for the whole file: the mic watchdog
// starts its one interval with the first room, and keeps it. A room
// disposes its life in its own cleanup, so each room here does too.

import { createRoot, createSignal, onCleanup } from 'solid-js'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi, } from 'vitest'
import { micSentinelDump } from '@/lib/mic-sentinel'
import type { NativeDeviceApi } from '@/stores/native-shell-store'
import { exerciseHoldsFocus, registerNativeDevice, setExerciseFocus, } from '@/stores/native-shell-store'
import { announceAppLeave } from './app-leave'
import type { RoomLife, RoomWatch } from './room-life'
import { createRoomLife } from './room-life'

let pageHidden = false
Object.defineProperty(document, 'visibilityState', {
  configurable: true,
  get: () => (pageHidden ? 'hidden' : 'visible'),
})

function hidePage(hidden: boolean): void {
  pageHidden = hidden
  document.dispatchEvent(new Event('visibilitychange'))
}

/** A room's screen, watched, with the room's switches in hand. */
function room(holdsFocus?: boolean) {
  const [listening, setListening] = createSignal(false)
  const [demoOn, setDemoOn] = createSignal(false)
  const [demoPlaying, setDemoPlaying] = createSignal(false)
  const [micOn, setMicOn] = createSignal(false)
  const leave = vi.fn()
  const died = vi.fn()
  let life: RoomLife | null = null
  const unmount = createRoot((dispose) => {
    const own = createRoomLife()
    life = own
    own.watch({
      leave,
      listening,
      demo: { on: demoOn, playing: demoPlaying },
      holdsFocus,
      mic: { exercise: 'room-life-test', on: micOn, died },
    })
    onCleanup(() => {
      own.dispose()
    })
    return dispose
  })
  return {
    life: life as unknown as RoomLife,
    leave,
    died,
    setListening,
    setDemoOn,
    setDemoPlaying,
    setMicOn,
    unmount,
  }
}

const keepAwake = vi.fn()
let unregisterDevice = (): void => undefined

beforeAll(() => {
  vi.useFakeTimers()
})

afterAll(() => {
  vi.useRealTimers()
})

beforeEach(() => {
  pageHidden = false
  keepAwake.mockClear()
  unregisterDevice = registerNativeDevice({
    keepAwake,
  } as unknown as NativeDeviceApi)
})

afterEach(() => {
  unregisterDevice()
  setExerciseFocus(false)
  vi.restoreAllMocks()
})

describe('createRoomLife: later', () => {
  it('runs a timer once its time is up, while the screen lives', () => {
    const life = createRoomLife()
    const fn = vi.fn()

    life.later(100, fn)
    vi.advanceTimersByTime(99)
    const early = fn.mock.calls.length
    vi.advanceTimersByTime(1)

    expect([early, fn.mock.calls.length]).toEqual([0, 1])
  })

  it('drops every waiting timer when the screen goes, and says it has gone', () => {
    const life = createRoomLife()
    const fn = vi.fn()
    // The mic watchdog's interval may be on the clock already.
    const before = vi.getTimerCount()
    life.later(100, fn)
    life.later(5000, fn)

    life.dispose()
    const left = vi.getTimerCount() - before
    vi.advanceTimersByTime(10_000)

    expect(left).toBe(0)
    expect(fn).not.toHaveBeenCalled()
    expect(life.alive()).toBe(false)
  })

  it('runs nothing scheduled after the screen has gone', () => {
    const life = createRoomLife()
    const fn = vi.fn()
    life.dispose()

    // A late callback (a promise the screen outlived) still asks.
    life.later(100, fn)
    vi.advanceTimersByTime(100)

    expect(fn).not.toHaveBeenCalled()
  })
})

describe('createRoomLife: watch', () => {
  it('hears the singer leave when the page hides, not when it shows', () => {
    const screen = room()

    hidePage(false)
    hidePage(true)

    expect(screen.leave).toHaveBeenCalledTimes(1)
    screen.unmount()
  })

  it('hears the singer leave when the app goes with the page still showing', () => {
    const screen = room()

    announceAppLeave()

    expect(screen.leave).toHaveBeenCalledTimes(1)
    screen.unmount()
  })

  it('keeps the screen on while the room listens, and while the demo plays', () => {
    const screen = room()
    const states: boolean[] = []
    const note = (): void => {
      states.push(keepAwake.mock.calls.at(-1)?.[0] as boolean)
    }

    screen.setListening(true)
    note()
    screen.setDemoOn(true)
    note()
    screen.setDemoPlaying(true)
    note()
    screen.setDemoOn(false)
    screen.setListening(false)
    note()

    // On with the run; off on the demo's card; on while it plays; off at rest.
    expect(states).toEqual([true, false, true, false])
    screen.unmount()
  })

  it('holds the rail while the room listens, for a room that asks', () => {
    const screen = room(true)

    screen.setListening(true)
    const during = exerciseHoldsFocus()
    screen.setListening(false)

    expect([during, exerciseHoldsFocus()]).toEqual([true, false])
    screen.unmount()
  })

  it('leaves the rail alone while a room that holds it itself listens', () => {
    const screen = room()

    screen.setListening(true)

    expect(exerciseHoldsFocus()).toBe(false)
    screen.unmount()
  })

  it("shows the room's mic icon to the app's watchdog, which stops a room whose mic died", () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const screen = room()
    screen.setMicOn(true)
    const icon = micSentinelDump().indicators.find(
      (i) => i.id === 'room-life-test',
    )

    // On, with no live microphone: two of the watchdog's checks, then off.
    vi.advanceTimersByTime(6000)

    expect(icon).toEqual({ id: 'room-life-test', on: true })
    expect(screen.died).toHaveBeenCalledTimes(1)
    screen.unmount()
  })

  it('watches a screen once', () => {
    const screen = room()

    expect(() => screen.life.watch({} as RoomWatch)).toThrow(
      'A room watches its screen once',
    )
    screen.unmount()
  })
})

describe('createRoomLife: dispose', () => {
  it('stops watching: no leave, no icon, the screen free to sleep, the rail back', () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const screen = room(true)
    screen.setListening(true)

    screen.unmount()
    hidePage(true)
    announceAppLeave()

    expect(screen.leave).not.toHaveBeenCalled()
    expect(
      micSentinelDump().indicators.some((i) => i.id === 'room-life-test'),
    ).toBe(false)
    expect(keepAwake.mock.calls.at(-1)).toEqual([false])
    expect(exerciseHoldsFocus()).toBe(false)
  })

  it('leaves the rail to a room that holds it on its own moments', () => {
    const screen = room()
    // Long note holds the rail from the take's first voice (enterHold).
    setExerciseFocus(true)

    screen.unmount()

    expect(exerciseHoldsFocus()).toBe(true)
  })
})
