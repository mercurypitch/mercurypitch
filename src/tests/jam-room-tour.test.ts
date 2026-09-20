// ============================================================
// The Jam tab has two tours, and Tour picks the one for the screen
// ============================================================
//
// Owner report, 2026-09-20: "in the sidebar the 'tour' button is there, but
// it doesn't showcase the in room tour guide ... it actually shows the tour
// guide for the welcome screen where you can create the room and join one."
//
// One tab, two screens. The lobby's four steps point at a name field, a
// Create button and a code field, and none of those exist inside a room: the
// tour ran there as four tooltips about nothing. The room has its own now,
// and which one plays is decided by whether a room is open.

import { afterEach, describe, expect, it, vi } from 'vitest'

const viewport = vi.hoisted(() => ({ narrow: false }))

vi.mock('@/lib/use-viewport', () => ({
  isNarrow: () => viewport.narrow,
}))

import { TAB_JAM, TAB_PIANO } from '@/features/tabs/constants'
import { provideJamRoomState } from '@/lib/jam/jam-room-presence'
import { endWalkthrough, hasPageTour, JAM_ROOM_TOUR_STEPS, PAGE_TOURS, pageTourSteps, startPageTour, tourSteps, walkthroughActive, } from '@/stores/app-store'

const room = { open: false }
provideJamRoomState(() => (room.open ? 'active' : 'idle'))

afterEach(() => {
  endWalkthrough()
  room.open = false
  viewport.narrow = false
})

const LOBBY_ONLY = ['#jam-display-name', '#jam-room-id', 'jam.actions']

describe('which tour the Jam tab plays', () => {
  it('is the lobby’s until a room opens', () => {
    expect(pageTourSteps(TAB_JAM)).toBe(PAGE_TOURS[TAB_JAM])
  })

  it('is the room’s once one has', () => {
    room.open = true
    expect(pageTourSteps(TAB_JAM)).toBe(JAM_ROOM_TOUR_STEPS)
    expect(hasPageTour(TAB_JAM)).toBe(true)
  })

  it('goes back to the lobby’s when the room is left', () => {
    room.open = true
    room.open = false
    expect(pageTourSteps(TAB_JAM)).toBe(PAGE_TOURS[TAB_JAM])
  })

  it('leaves every other tab alone while a room is open', () => {
    // The room outlives a tab switch, so this is the usual case and not an
    // edge: somebody in a room looks at the Piano page and presses Tour.
    room.open = true
    expect(pageTourSteps(TAB_PIANO)).toBe(PAGE_TOURS[TAB_PIANO])
  })

  it('starts the one for the screen, from whichever button asked', () => {
    // The sidebar's Tour, the Guide dialog and the first-visit offer all go
    // through startPageTour, so none of them has to know there are two.
    startPageTour(TAB_JAM)
    expect(walkthroughActive()).toBe(true)
    expect(tourSteps()[0]?.targetSelector).toBe('#jam-display-name')
    endWalkthrough()

    room.open = true
    startPageTour(TAB_JAM)
    expect(walkthroughActive()).toBe(true)
    expect(tourSteps()[0]?.targetSelector).toBe(
      '[data-testid="jam-room-header"]',
    )
  })
})

describe('the room’s tour', () => {
  it('points at nothing that only the lobby has, and the reverse', () => {
    for (const step of JAM_ROOM_TOUR_STEPS) {
      for (const lobby of LOBBY_ONLY) {
        expect(step.targetSelector, step.title).not.toContain(lobby)
      }
    }
    const roomTargets = new Set(
      JAM_ROOM_TOUR_STEPS.map((step) => step.targetSelector),
    )
    for (const step of PAGE_TOURS[TAB_JAM] ?? []) {
      expect(roomTargets.has(step.targetSelector), step.title).toBe(false)
    }
  })

  it('covers what was asked for: the way in, the song list, the playback', () => {
    const targets = JAM_ROOM_TOUR_STEPS.map((step) => step.targetSelector)
    expect(targets).toContain('[data-testid="jam-room-code"]')
    expect(targets).toContain('[data-tour="jam.rail-picker"]')
    expect(targets).toContain('[data-testid="jam-controls"]')
  })

  it('stays on the Jam tab from the first step to the last', () => {
    for (const step of JAM_ROOM_TOUR_STEPS) {
      expect(step.requiredTab, step.title).toBe(TAB_JAM)
    }
  })

  it('opens the sidebar, and the section, for what lives in the sidebar', () => {
    const rail = JAM_ROOM_TOUR_STEPS.filter((step) =>
      step.targetSelector.includes('jam.rail-'),
    )
    expect(rail).toHaveLength(2)
    for (const step of rail) {
      // A phone keeps the sidebar in a drawer, and either section can have
      // been folded shut: without both, the spotlight lands on nothing.
      expect(step.inSidebar, step.title).toBe(true)
      expect(step.reveal, step.title).toMatch(
        /^\[data-collapsible="sidebar-jam-(room|picker)-open"\]$/,
      )
    }
    // Next to each other, so a phone's drawer opens once and not twice.
    const at = rail.map((step) => JAM_ROOM_TOUR_STEPS.indexOf(step))
    expect(at[1]! - at[0]!).toBe(1)
  })

  it('tells a phone and a desk the truth about the header’s buttons', () => {
    // On a phone all but the microphone and the way out fold into a menu.
    const runFor = (narrow: boolean): string[] => {
      viewport.narrow = narrow
      room.open = true
      startPageTour(TAB_JAM)
      const titles = tourSteps().map((step) => step.title)
      endWalkthrough()
      return titles
    }
    const desk = runFor(false)
    const phone = runFor(true)
    expect(desk).toEqual(phone)
    expect(new Set(desk).size).toBe(desk.length)

    const variants = JAM_ROOM_TOUR_STEPS.filter(
      (step) => step.targetSelector === '[data-tour="jam.room-actions"]',
    )
    expect(variants.map((step) => step.viewport).sort()).toEqual([
      'desktop',
      'mobile',
    ])
    expect(variants.find((s) => s.viewport === 'mobile')?.description).toMatch(
      /menu button/,
    )
  })

  it('is written the way the rest of the app talks', () => {
    for (const step of JAM_ROOM_TOUR_STEPS) {
      const words = `${step.title} ${step.description}`
      expect(words, step.title).not.toMatch(/\bdemo\b/i)
      expect(words, step.title).not.toMatch(/\bAI\b/)
      expect(words, step.title).not.toMatch(/\b(peer|sync(ed)?|WebRTC)\b/i)
    }
  })
})

describe('the lobby’s tour', () => {
  it('says the room has a tour of its own', () => {
    const last = (PAGE_TOURS[TAB_JAM] ?? []).at(-1)
    expect(last?.description).toMatch(/tour of its own/)
  })
})
