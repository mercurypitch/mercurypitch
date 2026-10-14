// ============================================================
// LipRollScreen: opening Lip roll makes it the last exercise
// ============================================================
//
// As EchoScreen does for Echo: the screen writes the last
// exercise on mount, so every way in counts, and a singer who opens Lip roll
// and leaves before a result still finds it on the Sing screen's row. The
// room itself is stood in for: what it does is its own suites' business.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { lastExercise, resetLastExerciseForTests, } from '@/features/premium-exercises/last-exercise'
import { LipRollScreen } from './LipRollScreen'
import type { RenderedShell } from './render-for-test'
import { renderShell } from './render-for-test'

vi.mock('@/features/lip-roll/LipRollRoom', () => ({
  LipRollRoom: () => {
    const room = document.createElement('div')
    room.dataset.testid = 'lip-roll-room'
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

describe('LipRollScreen', () => {
  it('records Lip roll as the last exercise the moment it opens', () => {
    expect(lastExercise()).toBeNull()

    view = renderShell(() => <LipRollScreen />)

    expect(localStorage.getItem('mp_last_exercise')).toBe('lip-roll-bay')
    expect(lastExercise()).toBe('lip-roll-bay')
  })

  it('shows the room it opens', () => {
    view = renderShell(() => <LipRollScreen />)

    expect(
      view.container.querySelector<HTMLElement>('[data-testid]')?.dataset
        .testid,
    ).toBe('lip-roll-room')
  })
})
