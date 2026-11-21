// ============================================================
// Room return store: which room the Exercises tab comes back to
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import { exerciseEntered, exercisesTabLeft, exercisesTabShown, isRoomReturn, } from './room-return-store'

afterEach(() => exerciseEntered())

describe('a room the Exercises tab comes back to', () => {
  it('is a return when the tab shows the room it held as it went', () => {
    exercisesTabLeft('echo-stars')
    expect(isRoomReturn()).toBe(false)

    expect(exercisesTabShown('echo-stars')).toBe(true)
    expect(isRoomReturn()).toBe(true)
  })

  it('is a return once: the tab shown again without going is not one', () => {
    exercisesTabLeft('echo-stars')
    exercisesTabShown('echo-stars')

    expect(exercisesTabShown('echo-stars')).toBe(false)
    expect(isRoomReturn()).toBe(false)
  })

  it('is not a return when the tab went from its list', () => {
    exercisesTabLeft(null)

    expect(exercisesTabShown(null)).toBe(false)
    expect(exercisesTabShown('echo-stars')).toBe(false)
    expect(isRoomReturn()).toBe(false)
  })

  it('is not a return when the tab comes back to another room', () => {
    exercisesTabLeft('echo-stars')

    expect(exercisesTabShown('leap-cliffs')).toBe(false)
    expect(isRoomReturn()).toBe(false)
  })

  it('ends with a fresh way in: a card, a link, a share or a launch', () => {
    exercisesTabLeft('echo-stars')
    exercisesTabShown('echo-stars')

    exerciseEntered()

    expect(isRoomReturn()).toBe(false)
  })

  it('is forgotten by a fresh way in made while another tab was up', () => {
    exercisesTabLeft('echo-stars')
    // A link to the same room, followed from another tab.
    exerciseEntered()

    expect(exercisesTabShown('echo-stars')).toBe(false)
    expect(isRoomReturn()).toBe(false)
  })

  it('ends when the tab goes again', () => {
    exercisesTabLeft('echo-stars')
    exercisesTabShown('echo-stars')

    exercisesTabLeft('echo-stars')

    expect(isRoomReturn()).toBe(false)
  })
})
