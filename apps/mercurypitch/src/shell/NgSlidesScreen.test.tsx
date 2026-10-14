// ============================================================
// NgSlidesScreen: opening Ng slides makes it the last exercise
// ============================================================
//
// As EchoScreen does for Echo: the screen writes the last
// exercise on mount, so every way in counts, and a singer who opens Ng slides
// and leaves before a result still finds it on the Sing screen's row. The
// room itself is stood in for: what it does is its own suites' business.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { lastExercise, resetLastExerciseForTests, } from '@/features/premium-exercises/last-exercise'
import { NgSlidesScreen } from './NgSlidesScreen'
import type { RenderedShell } from './render-for-test'
import { renderShell } from './render-for-test'

vi.mock('@/features/ng-slides/NgSlidesRoom', () => ({
  NgSlidesRoom: () => {
    const room = document.createElement('div')
    room.dataset.testid = 'ng-slides-room'
    return room
  },
}))

let view: RenderedShell | undefined

beforeEach(() => {
  localStorage.clear()
  resetLastExerciseForTests()
})

afterEach(() => {
  view?.unmount()
  view = undefined
})

describe('NgSlidesScreen', () => {
  it('records Ng slides as the last exercise the moment it opens', () => {
    expect(lastExercise()).toBeNull()

    view = renderShell(() => <NgSlidesScreen />)

    expect(localStorage.getItem('mp_last_exercise')).toBe('ng-slides-bridge')
    expect(lastExercise()).toBe('ng-slides-bridge')
  })

  it('shows the room it opens', () => {
    view = renderShell(() => <NgSlidesScreen />)

    expect(
      view.container.querySelector<HTMLElement>('[data-testid]')?.dataset
        .testid,
    ).toBe('ng-slides-room')
  })
})
