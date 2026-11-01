// ============================================================
// The Ear rooms on the Ear Lab tab: a card a room, its best on it
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setExerciseLevel } from '@/stores/exercise-level'
import { recordHomeNoteBest, resetHomeNoteStoreForTests, } from '@/stores/home-note-store'
import { recordLeapBest, resetLeapStoreForTests } from '@/stores/leap-store'
import { EarRoomsRow } from './EarRoomsRow'

function card(id: string): HTMLElement {
  const found = screen
    .getAllByTestId('ear-rooms-card')
    .find((one) => one.dataset.exercise === id)
  if (found === undefined) throw new Error(`no card for ${id}`)
  return found
}

describe('the Ear rooms row', () => {
  beforeEach(() => {
    localStorage.removeItem('mp_leap_bests')
    localStorage.removeItem('mp_home_note_bests')
    resetLeapStoreForTests()
    resetHomeNoteStoreForTests()
    setExerciseLevel('singer')
  })

  afterEach(() => {
    cleanup()
  })

  it('has a card for each Ear room, which opens it', () => {
    const onOpen = vi.fn()
    render(() => <EarRoomsRow onOpen={onOpen} />)
    expect(
      screen
        .getAllByTestId('ear-rooms-card')
        .map((one) => one.dataset.exercise),
    ).toEqual(['home-note-lighthouse', 'first-note-stage', 'leap-cliffs'])
    fireEvent.click(card('leap-cliffs'))
    expect(onOpen).toHaveBeenCalledWith('leap-cliffs')
  })

  it('shows no best on a room not yet run', () => {
    render(() => <EarRoomsRow onOpen={() => undefined} />)
    expect(screen.queryAllByTestId('ear-rooms-best')).toEqual([])
  })

  it("shows each room's best at the singer's level on its card", () => {
    recordLeapBest('singer', { landed: 5, rounds: 6, seconds: 0.6, at: 1 })
    recordHomeNoteBest('learning', { found: 6, rounds: 6, seconds: 1.1, at: 1 })
    render(() => <EarRoomsRow onOpen={() => undefined} />)
    expect(card('leap-cliffs').textContent).toContain('Best 5 of 6')
    // Home note's best is at another level: not the singer's.
    expect(card('home-note-lighthouse').textContent).not.toContain('Best')
    setExerciseLevel('learning')
    expect(card('home-note-lighthouse').textContent).toContain('Best 6 of 6')
    expect(card('leap-cliffs').textContent).not.toContain('Best')
  })
})
