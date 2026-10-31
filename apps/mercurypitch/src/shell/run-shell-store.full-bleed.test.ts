// ============================================================
// A full-bleed premium room keeps the rail away for the whole room
// ============================================================
//
// Decision D1 (13 Oct 2026): a premium room drawn full-bleed shows no tab
// rail at all, not just while a note is held, and the rail comes back with
// the screen under it.

import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TAB_SINGING } from '@/features/tabs/constants'
import { consumeRunParked, registerRunControls, setExerciseFocus, } from '@/stores/native-shell-store'
import { setActiveTab } from '@/stores/ui-store'
import { fullBleedOnTop, popScreen, pushScreen, quietRunForRoom, railVisible, resetRunShell, transportVisible, } from './run-shell-store'

beforeEach(() => {
  setActiveTab(TAB_SINGING)
  resetRunShell()
  setExerciseFocus(false)
})

afterEach(() => {
  setExerciseFocus(false)
  resetRunShell()
})

describe('a full-bleed room', () => {
  it('hides the rail from the moment it opens until it closes', () => {
    expect(railVisible()).toBe(true)

    pushScreen('long-note')
    expect(fullBleedOnTop()).toBe(true)
    expect(railVisible()).toBe(false)

    popScreen()
    expect(fullBleedOnTop()).toBe(false)
    expect(railVisible()).toBe(true)
  })

  it('keeps the rail away after a held note ends', () => {
    pushScreen('long-note')
    setExerciseFocus(true)
    setExerciseFocus(false)

    expect(railVisible()).toBe(false)
  })

  it('leaves the rail with a screen that is not a room', () => {
    pushScreen('settings')

    expect(fullBleedOnTop()).toBe(false)
    expect(railVisible()).toBe(true)
  })
})

describe('a full-bleed room over a run', () => {
  let unregister: (() => void) | null = null

  afterEach(() => {
    unregister?.()
    unregister = null
    consumeRunParked(TAB_SINGING)
  })

  it('takes the transport away with the rail, and gives both back', () => {
    const [playing, setPlaying] = createSignal(true)
    unregister = registerRunControls({
      tab: TAB_SINGING,
      roomLabel: 'Sing',
      isPlaying: playing,
      isPaused: () => !playing(),
      pause: vi.fn(() => setPlaying(false)),
      resume: vi.fn(() => setPlaying(true)),
      stop: vi.fn(() => setPlaying(false)),
      park: vi.fn(() => setPlaying(false)),
    })
    expect(transportVisible()).toBe(true)

    pushScreen('long-note')
    // The room's art fills the screen: nothing of the dock over it.
    expect(transportVisible()).toBe(false)

    popScreen()
    expect(transportVisible()).toBe(true)
  })

  it('quiets the run for the room, and leaves no park mark behind', () => {
    const [playing, setPlaying] = createSignal(true)
    const park = vi.fn(() => setPlaying(false))
    unregister = registerRunControls({
      tab: TAB_SINGING,
      roomLabel: 'Sing',
      isPlaying: playing,
      isPaused: () => !playing(),
      pause: vi.fn(() => setPlaying(false)),
      resume: vi.fn(() => setPlaying(true)),
      stop: vi.fn(() => setPlaying(false)),
      park,
    })

    quietRunForRoom()
    expect(park).toHaveBeenCalledTimes(1)
    // No tab changed: the run's room must not find a park to spend on its
    // next, unrelated leave.
    expect(consumeRunParked(TAB_SINGING)).toBe(false)
  })
})
