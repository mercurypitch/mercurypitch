// ============================================================
// RoomsStrip: a card a room, at the top of the web's Exercises tab
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EXERCISE_HARMONY_LAKE, EXERCISE_LEAP_CLIFFS, } from '@/lib/domain/exercise-contracts'
import RoomsStrip from './RoomsStrip'
import { WEB_ROOM_IDS } from './web-room-ids'

const cards = (): HTMLElement[] => screen.getAllByTestId('exercise-room-card')

describe('RoomsStrip', () => {
  afterEach(cleanup)

  it('draws a card for every room, in the order of the list', () => {
    render(() => <RoomsStrip onOpen={() => {}} />)

    expect(cards().map((card) => card.getAttribute('data-room'))).toEqual([
      ...WEB_ROOM_IDS,
    ])
  })

  it("says the catalogue's name and line on a card", () => {
    render(() => <RoomsStrip onOpen={() => {}} />)
    const harmony = cards().find(
      (card) => card.getAttribute('data-room') === EXERCISE_HARMONY_LAKE,
    )

    expect(harmony?.textContent).toContain('Harmony')
    expect(harmony?.textContent).toContain(
      'Merc sings a short line. Sing it a third above him.',
    )
  })

  it('gives every card a picture, which says nothing to a screen reader', () => {
    render(() => <RoomsStrip onOpen={() => {}} />)

    const pictures = cards().map((card) => card.querySelector('img'))

    expect(
      pictures.filter((img) => (img?.getAttribute('src') ?? '') === ''),
    ).toEqual([])
    expect(pictures.filter((img) => img?.getAttribute('alt') !== '')).toEqual(
      [],
    )
  })

  it('opens the room whose card was pressed', () => {
    const onOpen = vi.fn()
    render(() => <RoomsStrip onOpen={onOpen} />)

    fireEvent.click(
      cards().find(
        (card) => card.getAttribute('data-room') === EXERCISE_LEAP_CLIFFS,
      ) as HTMLElement,
    )

    expect(onOpen).toHaveBeenCalledExactlyOnceWith(EXERCISE_LEAP_CLIFFS)
  })

  it('puts the focus back on the card the singer left by, once', () => {
    const first = render(() => <RoomsStrip onOpen={() => {}} />)
    fireEvent.click(
      cards().find(
        (card) => card.getAttribute('data-room') === EXERCISE_LEAP_CLIFFS,
      ) as HTMLElement,
    )
    // The tab draws the room in the list's place, then the list again.
    first.unmount()

    render(() => <RoomsStrip onOpen={() => {}} />)

    expect(document.activeElement?.getAttribute('data-room')).toBe(
      EXERCISE_LEAP_CLIFFS,
    )

    cleanup()
    render(() => <RoomsStrip onOpen={() => {}} />)

    expect(document.activeElement?.getAttribute('data-room') ?? null).toBeNull()
  })
})
