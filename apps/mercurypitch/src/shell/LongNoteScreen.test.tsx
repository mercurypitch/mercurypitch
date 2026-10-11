// ============================================================
// LongNoteScreen: opening Long note makes it the last exercise
// ============================================================
//
// The Sing screen's row offers the last exercise opened. The screen writes
// it on mount, so every way in (the row, the picker, the options) counts,
// and a singer who opens Long note and leaves before a result still finds
// it on the row. The room itself is stood in for: what it does is its own
// suites' business.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { lastExercise, resetLastExerciseForTests, } from '@/features/premium-exercises/last-exercise'
import { LongNoteScreen } from './LongNoteScreen'
import type { RenderedShell } from './render-for-test'
import { renderShell } from './render-for-test'

vi.mock('@/features/long-note/LongNoteRoom', () => ({
  LongNoteRoom: () => {
    const room = document.createElement('div')
    room.dataset.testid = 'long-note-room'
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

describe('LongNoteScreen', () => {
  it('records Long note as the last exercise the moment it opens', () => {
    expect(lastExercise()).toBeNull()

    view = renderShell(() => <LongNoteScreen />)

    expect(localStorage.getItem('mp_last_exercise')).toBe('long-note-lantern')
    expect(lastExercise()).toBe('long-note-lantern')
  })

  it('still shows the room it opens', () => {
    view = renderShell(() => <LongNoteScreen />)

    expect(
      view.container.querySelector<HTMLElement>('[data-testid]')?.dataset
        .testid,
    ).toBe('long-note-room')
  })
})
