// ============================================================
// The rail's five destinations, and what Back means
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TAB_EAR_LAB, TAB_GUITAR, TAB_HOME, TAB_PIANO, TAB_PROGRESS, TAB_SINGING, } from '@/features/tabs/constants'
import { registerRunControls } from '@/stores/native-shell-store'
import { setPlaybackState } from '@/stores/playback-state-store'
import { setActiveTab } from '@/stores/ui-store'
import { openColumn, openMore, pushScreen, requestEnd, resetRunShell, } from './run-shell-store'
import { goToTab, performBack, railItems, resolveBack, selectedRailItem, stageLabelFor, stageTabFor, } from './shell-navigation'

const host = (historyDepth: number) => ({
  historyDepth,
  back: vi.fn(),
  minimize: vi.fn(),
})

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

describe('the order of Back', () => {
  it('closes the column first, then the alert, the sheet and the screen', () => {
    setPlaybackState('playing')
    pushScreen('settings')
    openMore()
    requestEnd()
    openColumn()

    expect(performBack(host(3))).toBe('column')
    expect(performBack(host(3))).toBe('alert')
    expect(performBack(host(3))).toBe('sheet')
    expect(performBack(host(3))).toBe('pushed')
  })

  it('leaves the room once nothing is open', () => {
    const back = host(3)

    expect(performBack(back)).toBe('history')
    expect(back.back).toHaveBeenCalledTimes(1)
    expect(back.minimize).not.toHaveBeenCalled()
  })

  it('minimizes rather than exiting at the root', () => {
    const back = host(1)

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

    performBack(host(3))

    expect(controls.park).toHaveBeenCalledTimes(1)
  })

  it('resolves without doing anything', () => {
    expect(resolveBack(1)).toBe('minimize')
    expect(resolveBack(9)).toBe('history')
  })
})
