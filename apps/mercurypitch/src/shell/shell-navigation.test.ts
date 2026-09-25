// ============================================================
// The rail's five destinations, and what Back means
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TAB_EAR_LAB, TAB_GUITAR, TAB_HOME, TAB_PIANO, TAB_PROGRESS, TAB_SINGING, } from '@/features/tabs/constants'
import { registerRunControls } from '@/stores/native-shell-store'
import { setPlaybackState } from '@/stores/playback-state-store'
import { setActiveTab } from '@/stores/ui-store'
import { canGoBack, installHistoryDepth } from './history-depth'
import { openColumn, openMore, pushed, pushScreen, requestEnd, resetRunShell, } from './run-shell-store'
import { cancelDoorOpen, goToTab, performBack, railItems, registerDoorClear, registerDoorOpen, resolveBack, returnToRun, selectedRailItem, shellBackHost, stageLabelFor, stageTabFor, } from './shell-navigation'

// Only for the ORDER of the first four outcomes, which never reach history.
// Everything about leaving the room is driven through the real host below:
// the bug this file did not catch was invisible to an injected depth.
const host = (canGo: boolean) => ({
  canGoBack: canGo,
  back: vi.fn(),
  minimize: vi.fn(),
})

/** jsdom lands a history traversal a task or two after it is asked for. */
async function until(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (condition()) return
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  }
}

let unregister: (() => void) | null = null

beforeEach(() => {
  setActiveTab(TAB_SINGING)
  setPlaybackState('stopped')
  resetRunShell()
  window.location.hash = ''
})

afterEach(() => {
  unregister?.()
  unregister = null
  setPlaybackState('stopped')
  resetRunShell()
})

describe('the rail is fixed', () => {
  it('offers the same five destinations in every scope', () => {
    for (const scope of ['all', 'singing', 'guitar', 'piano'] as const) {
      expect(railItems(scope).map((item) => item.id)).toEqual([
        'rooms',
        'stage',
        'ear',
        'progress',
        'more',
      ])
    }
  })

  it('keeps the Ear Lab whatever the practice scope says', () => {
    // `mobileBarTabs()` can drop it. The rail does not consult that policy.
    expect(railItems('guitar').map((item) => item.tab)).toContain(TAB_EAR_LAB)
  })

  it('puts the scope’s own instrument in slot two', () => {
    expect(stageTabFor('all')).toBe(TAB_SINGING)
    expect(stageTabFor('singing')).toBe(TAB_SINGING)
    expect(stageTabFor('guitar')).toBe(TAB_GUITAR)
    expect(stageTabFor('piano')).toBe(TAB_PIANO)
    expect(stageLabelFor('guitar')).toBe('Guitar')
  })

  it('marks More for anything that is not one of the four', () => {
    expect(selectedRailItem(TAB_HOME, 'all')).toBe('rooms')
    expect(selectedRailItem(TAB_SINGING, 'all')).toBe('stage')
    expect(selectedRailItem(TAB_PROGRESS, 'all')).toBe('progress')
    expect(selectedRailItem(TAB_GUITAR, 'all')).toBe('more')
  })
})

describe('going somewhere', () => {
  it('parks the run on the way out of the room it belongs to', () => {
    const controls = {
      tab: TAB_SINGING,
      roomLabel: 'Sing',
      isPlaying: () => true,
      isPaused: () => false,
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
      park: vi.fn(),
    }
    unregister = registerRunControls(controls)
    setPlaybackState('playing')

    goToTab(TAB_PROGRESS)

    expect(controls.park).toHaveBeenCalledTimes(1)
    expect(window.location.hash).toContain('progress')
  })

  it('parks nothing when there is no run', () => {
    const controls = {
      tab: TAB_SINGING,
      roomLabel: 'Sing',
      isPlaying: () => false,
      isPaused: () => false,
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
      park: vi.fn(),
    }
    unregister = registerRunControls(controls)

    goToTab(TAB_EAR_LAB)

    expect(controls.park).not.toHaveBeenCalled()
  })
})

describe('a door open in flight', () => {
  afterEach(() => {
    cancelDoorOpen()
  })

  it('Back calls it off and reports the press handled, at the root too', () => {
    const cancel = vi.fn(() => true)
    registerDoorOpen(cancel)
    const back = host(false)

    expect(performBack(back)).toBe('door-open')
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(back.minimize).not.toHaveBeenCalled()
    expect(back.back).not.toHaveBeenCalled()
    // Once: the next press is an ordinary one.
    expect(performBack(back)).toBe('minimize')
  })

  it('a rail tab calls it off and still goes where it was pointed', () => {
    const cancel = vi.fn(() => true)
    registerDoorOpen(cancel)

    goToTab(TAB_PROGRESS)

    expect(cancel).toHaveBeenCalledTimes(1)
    expect(window.location.hash).toContain('progress')
  })

  it('the pill calls it off and still goes back to the run', () => {
    // A keyboard press on the pill fires no pointerdown, and the grow's last
    // frame could cover and navigate to the door's room over the run's.
    unregister = registerRunControls({
      tab: TAB_SINGING,
      roomLabel: 'Sing',
      isPlaying: () => true,
      isPaused: () => false,
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
      park: vi.fn(),
    })
    setPlaybackState('playing')
    setActiveTab(TAB_HOME)
    const cancel = vi.fn(() => true)
    registerDoorOpen(cancel)

    returnToRun()

    expect(cancel).toHaveBeenCalledTimes(1)
    expect(window.location.hash).toContain('singing')
  })

  it('an open that has covered is not in flight any more', () => {
    const cancel = vi.fn(() => true)
    const done = registerDoorOpen(cancel)
    done()

    expect(performBack(host(false))).toBe('minimize')
    expect(cancel).not.toHaveBeenCalled()
  })

  it('an open that refuses the cancel is not a handled press', () => {
    registerDoorOpen(() => false)
    expect(performBack(host(false))).toBe('minimize')
  })
})

describe('a door picked on the alley', () => {
  // The card, its Enter and the dim are the alley's overlay. Back fell
  // through to 'history' (leaving Rooms) or 'minimize' (backgrounding the
  // app) with the card still up, while Escape put the door back.
  it('Back puts it back and reports the press handled, at the root', () => {
    const clear = vi.fn(() => true)
    unregister = registerDoorClear(clear)
    const back = host(false)

    expect(performBack(back)).toBe('door-cleared')
    expect(clear).toHaveBeenCalledTimes(1)
    expect(back.minimize).not.toHaveBeenCalled()
    expect(back.back).not.toHaveBeenCalled()
  })

  it('Back puts it back rather than leaving Rooms, with history behind', () => {
    unregister = registerDoorClear(() => true)
    const back = host(true)

    expect(performBack(back)).toBe('door-cleared')
    expect(back.back).not.toHaveBeenCalled()
  })

  it('with no door picked, the press goes on down the order', () => {
    unregister = registerDoorClear(() => false)
    expect(performBack(host(false))).toBe('minimize')
  })

  it('the More sheet outranks it', () => {
    const clear = vi.fn(() => true)
    unregister = registerDoorClear(clear)
    openMore()

    expect(performBack(host(false))).toBe('sheet')
    expect(clear).not.toHaveBeenCalled()
  })

  it('an alley that has gone takes its door with it', () => {
    registerDoorClear(() => true)()
    expect(performBack(host(false))).toBe('minimize')
  })
})

describe('the order of Back', () => {
  it('closes the column first, then the alert, the sheet and the screen', () => {
    // A room that has something to lose, so Stop really does raise the alert.
    unregister = registerRunControls({
      tab: TAB_SINGING,
      roomLabel: 'Sing',
      isPlaying: () => true,
      isPaused: () => false,
      hasUnsavedTake: () => true,
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
      park: vi.fn(),
    })
    pushScreen('settings')
    openMore()
    requestEnd()
    openColumn()

    expect(performBack(host(true))).toBe('column')
    expect(performBack(host(true))).toBe('alert')
    expect(performBack(host(true))).toBe('sheet')
    expect(performBack(host(true))).toBe('pushed')
  })

  it('leaves the room once nothing is open', () => {
    const back = host(true)

    expect(performBack(back)).toBe('history')
    expect(back.back).toHaveBeenCalledTimes(1)
    expect(back.minimize).not.toHaveBeenCalled()
  })

  it('minimizes rather than exiting at the root', () => {
    const back = host(false)

    expect(performBack(back)).toBe('minimize')
    expect(back.minimize).toHaveBeenCalledTimes(1)
    expect(back.back).not.toHaveBeenCalled()
  })

  it('parks a run on the way out of the room', () => {
    const controls = {
      tab: TAB_SINGING,
      roomLabel: 'Sing',
      isPlaying: () => true,
      isPaused: () => false,
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
      park: vi.fn(),
    }
    unregister = registerRunControls(controls)
    setPlaybackState('playing')

    performBack(host(true))

    expect(controls.park).toHaveBeenCalledTimes(1)
  })

  it('gives the room its own overlay before falling through to history', () => {
    // The failure: the Sing room's end card is the room's, not the shell's,
    // so Back went to history and the room unmounted with the take undecided.
    const closeRoomOverlay = vi.fn(() => true)
    unregister = registerRunControls({
      tab: TAB_SINGING,
      roomLabel: 'Sing',
      isPlaying: () => false,
      isPaused: () => false,
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
      park: vi.fn(),
      closeRoomOverlay,
    })
    const back = host(true)

    expect(performBack(back)).toBe('room-overlay')
    expect(closeRoomOverlay).toHaveBeenCalledTimes(1)
    expect(back.back).not.toHaveBeenCalled()
  })

  it('is not asked while the shell has a layer of its own open', () => {
    const closeRoomOverlay = vi.fn(() => true)
    unregister = registerRunControls({
      tab: TAB_SINGING,
      roomLabel: 'Sing',
      isPlaying: () => false,
      isPaused: () => false,
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
      park: vi.fn(),
      closeRoomOverlay,
    })
    openMore()

    expect(performBack(host(true))).toBe('sheet')
    expect(closeRoomOverlay).not.toHaveBeenCalled()
  })

  it('falls through when the room has nothing open', () => {
    const closeRoomOverlay = vi.fn(() => false)
    unregister = registerRunControls({
      tab: TAB_SINGING,
      roomLabel: 'Sing',
      isPlaying: () => false,
      isPaused: () => false,
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
      park: vi.fn(),
      closeRoomOverlay,
    })
    const back = host(true)

    expect(performBack(back)).toBe('history')
    expect(closeRoomOverlay).toHaveBeenCalledTimes(1)
    expect(back.back).toHaveBeenCalledTimes(1)
  })

  it('resolves without doing anything', () => {
    expect(resolveBack(false)).toBe('minimize')
    expect(resolveBack(true)).toBe('history')
  })
})

describe('how deep in we are, through the real host', () => {
  // `history.length` answered this before, and it never shrinks: after one
  // navigation Back reported itself handled forever and the app could not be
  // minimized again. These cases drive `shellBackHost()` itself.
  it('is at the root on launch', () => {
    const stop = installHistoryDepth()
    try {
      expect(canGoBack()).toBe(false)
      expect(shellBackHost().canGoBack).toBe(false)
      expect(resolveBack(shellBackHost().canGoBack)).toBe('minimize')
    } finally {
      stop()
    }
  })

  it('sees an entry the hash router pushed, which fires no event', async () => {
    // The Rooms gallery navigates with `setActiveTab`, whose sync pushes with
    // `history.pushState` — no hashchange, no popstate. An index that only
    // learned from events never moved, so Back after tapping a room cover
    // minimized the app instead of returning to the gallery.
    const stop = installHistoryDepth()
    try {
      expect(canGoBack()).toBe(false)

      window.history.pushState(null, '', '#/singing')

      expect(canGoBack()).toBe(true)
      expect(resolveBack(shellBackHost().canGoBack)).toBe('history')

      window.history.back()
      await until(() => !canGoBack())
      expect(resolveBack(shellBackHost().canGoBack)).toBe('minimize')
    } finally {
      stop()
    }
  })

  it('keeps the floor where it is when the document reloads onto a stamped entry', () => {
    // A reloaded document keeps the history it had: the entries below are the
    // same document's and `history.back()` still reaches them. Moving the
    // floor up would throw away a back stack that works — and this app
    // reloads itself on a failed chunk load.
    const first = installHistoryDepth()
    window.history.pushState(null, '', '#/progress')
    expect(canGoBack()).toBe(true)
    first()

    // Install again on the same, already-stamped entry: a reload.
    const second = installHistoryDepth()
    try {
      expect(canGoBack()).toBe(true)
    } finally {
      second()
    }
  })

  it('has somewhere to go after a rail tap, and not after coming back', async () => {
    const stop = installHistoryDepth()
    try {
      goToTab(TAB_PROGRESS)
      await until(() => canGoBack())
      expect(canGoBack()).toBe(true)
      expect(resolveBack(shellBackHost().canGoBack)).toBe('history')

      window.history.back()
      await until(() => !canGoBack())
      expect(canGoBack()).toBe(false)
      expect(resolveBack(shellBackHost().canGoBack)).toBe('minimize')
    } finally {
      stop()
    }
  })
})

describe('a pushed screen and a rail tap', () => {
  it('pops the screen, or the tab changes under a full-screen cover', () => {
    pushScreen('settings')

    goToTab(TAB_PROGRESS)

    expect(pushed()).toBeNull()
  })
})
