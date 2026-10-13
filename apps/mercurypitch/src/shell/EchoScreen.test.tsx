// ============================================================
// EchoScreen: opening Echo makes it the last exercise
// ============================================================
//
// As LongNoteScreen does for Long note: the screen writes the last
// exercise on mount, so every way in counts, and a singer who opens Echo
// and leaves before a result still finds it on the Sing screen's row. The
// room itself is stood in for: what it does is its own suites' business.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { lastExercise, resetLastExerciseForTests, } from '@/features/premium-exercises/last-exercise'
import { EchoScreen } from './EchoScreen'
import type { RenderedShell } from './render-for-test'
import { renderShell } from './render-for-test'

vi.mock('@/features/echo/EchoRoom', () => ({
  EchoRoom: () => {
    const room = document.createElement('div')
    room.dataset.testid = 'echo-room'
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

describe('EchoScreen', () => {
  it('records Echo as the last exercise the moment it opens', () => {
    expect(lastExercise()).toBeNull()

    view = renderShell(() => <EchoScreen />)

    expect(localStorage.getItem('mp_last_exercise')).toBe('echo-stars')
    expect(lastExercise()).toBe('echo-stars')
  })

  it('shows the room it opens', () => {
    view = renderShell(() => <EchoScreen />)

    expect(
      view.container.querySelector<HTMLElement>('[data-testid]')?.dataset
        .testid,
    ).toBe('echo-room')
  })
})
