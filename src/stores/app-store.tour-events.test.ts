// @vitest-environment jsdom
// ============================================================
// Tour events — what the tour runner tells the funnel
// ============================================================
//
// The telemetry call is the observable output, the same precedent as
// FirstLight.test.tsx's funnel mock: `trackTour` is mocked and the tests read
// what the runner sent, in order.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { trackTour } from '@/lib/guide-funnel'
import { provideJamRoomState } from '@/lib/jam/jam-room-presence'
import type { WalkthroughStep } from '@/stores/app-store'
import { endWalkthrough, isGuideSectionCompleted, nextWalkthroughStep, PAGE_TOURS, pageTourKey, skipSection, startTour, TOURS_AVAILABLE, walkthroughActive, } from '@/stores/app-store'
import type { ActiveTab } from '@/types'

vi.mock('@/lib/guide-funnel', () => ({ trackTour: vi.fn() }))

const room = { open: false }
provideJamRoomState(() => (room.open ? 'active' : 'idle'))

function steps(n: number, section?: string): WalkthroughStep[] {
  return Array.from({ length: n }, (_, i) => ({
    title: `Step ${i + 1}`,
    description: 'A step.',
    targetSelector: 'body',
    ...(section !== undefined ? { section } : {}),
  }))
}

beforeEach(() => {
  vi.mocked(trackTour).mockClear()
  localStorage.clear()
  room.open = false
})

afterEach(() => {
  endWalkthrough()
})

describe('tour events', () => {
  it('reports the tour and the step a singer left it on', () => {
    startTour(steps(5), 'home')
    nextWalkthroughStep()
    nextWalkthroughStep()
    endWalkthrough()
    expect(trackTour).toHaveBeenLastCalledWith('tour_exit', 'home', 3)
  })

  it('reports a finish when Next runs past the last step', () => {
    startTour(steps(2), 'path')
    nextWalkthroughStep()
    nextWalkthroughStep()
    expect(trackTour).toHaveBeenLastCalledWith('tour_done', 'path', 2)
  })

  it('reports a finish when the close is told the tour is done', () => {
    startTour(steps(3), 'guide')
    endWalkthrough('done')
    expect(trackTour).toHaveBeenLastCalledWith('tour_done', 'guide', 1)
  })

  it('reports the start of a tour with its key and no step', () => {
    startTour(steps(2), 'mixer')
    expect(vi.mocked(trackTour).mock.calls).toEqual([['tour_start', 'mixer']])
  })

  it('closes a running tour before the next one starts', () => {
    startTour(steps(3), 'home')
    startTour(steps(2), 'exercises')
    expect(vi.mocked(trackTour).mock.calls).toEqual([
      ['tour_start', 'home'],
      ['tour_exit', 'home', 1],
      ['tour_start', 'exercises'],
    ])
  })

  it('counts a section the singer finished and continued past as done', () => {
    startTour(steps(2), 'guide')
    nextWalkthroughStep()
    startTour(steps(3), 'guide')
    expect(vi.mocked(trackTour).mock.calls).toEqual([
      ['tour_start', 'guide'],
      ['tour_done', 'guide', 2],
      ['tour_start', 'guide'],
    ])
  })

  it('leaves a running tour alone when the new one has no step to show', () => {
    startTour(steps(3), 'home')
    vi.mocked(trackTour).mockClear()
    startTour([], 'exercises')
    expect(trackTour).not.toHaveBeenCalled()
    expect(walkthroughActive()).toBe(true)
    endWalkthrough()
    expect(trackTour).toHaveBeenLastCalledWith('tour_exit', 'home', 1)
  })

  it('writes no walkthrough-seen key and completes no section on a handover', () => {
    startTour(steps(3, 'practice'), 'guide')
    startTour(steps(2), 'exercises')
    expect(localStorage.getItem('pitchperfect_walkthrough_done')).toBeNull()
    expect(isGuideSectionCompleted('practice')).toBe(false)
  })

  it('reports an exit when skipping the last section ends the tour', () => {
    startTour(steps(3, 'practice'), 'guide')
    nextWalkthroughStep()
    skipSection()
    expect(trackTour).toHaveBeenLastCalledWith('tour_exit', 'guide', 2)
    expect(walkthroughActive()).toBe(false)
  })

  it('sends nothing when no tour is running', () => {
    endWalkthrough()
    endWalkthrough('done')
    expect(trackTour).not.toHaveBeenCalled()
  })

  it('reports an end only once for one tour', () => {
    startTour(steps(2), 'home')
    endWalkthrough()
    endWalkthrough()
    expect(vi.mocked(trackTour).mock.calls).toEqual([
      ['tour_start', 'home'],
      ['tour_exit', 'home', 1],
    ])
  })

  it('has a tour key for every tab with a page tour', () => {
    expect(TOURS_AVAILABLE).toBe(true)
    for (const tab of Object.keys(PAGE_TOURS) as ActiveTab[]) {
      expect(pageTourKey(tab)).not.toBeNull()
    }
  })

  it('names the room tour once a jam room is open', () => {
    expect(pageTourKey('jam' as ActiveTab)).toBe('jam')
    room.open = true
    expect(pageTourKey('jam' as ActiveTab)).toBe('jam-room')
  })

  it('has no tour key for a tab with no page tour', () => {
    expect(pageTourKey('settings' as ActiveTab)).toBeNull()
  })
})
