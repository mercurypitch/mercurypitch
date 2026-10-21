// ============================================================
// Now playing tests — a new source stops the last, and only another's
// ============================================================

import { describe, expect, it } from 'vitest'
import { createSoundOwner } from './now-playing'

/** A source: its stop, and how many times it has been stopped. */
function source(): { stop: () => void; stops: () => number } {
  let stops = 0
  return {
    stop: () => {
      stops += 1
    },
    stops: () => stops,
  }
}

describe('createSoundOwner', () => {
  it('stops the source sounding when a second one claims the page', () => {
    // Arrange
    const owner = createSoundOwner()
    const first = source()
    const second = source()
    owner.claim(first.stop)

    // Act
    owner.claim(second.stop)

    // Assert
    expect(first.stops()).toBe(1)
    expect(second.stops()).toBe(0)
  })

  it('stops nothing that has already ended and let go', () => {
    // Arrange
    const owner = createSoundOwner()
    const ended = source()
    const next = source()
    owner.claim(ended.stop)
    owner.release(ended.stop)

    // Act
    owner.claim(next.stop)

    // Assert
    expect(ended.stops()).toBe(0)
  })

  it('leaves a source that takes over from itself to restart itself', () => {
    // Arrange
    const owner = createSoundOwner()
    const game = source()
    owner.claim(game.stop)

    // Act
    owner.claim(game.stop)

    // Assert
    expect(game.stops()).toBe(0)
  })

  it('keeps the new source when the one it stopped lets go from inside its stop', () => {
    // Arrange: a source whose stop lets go, as every Lesson 6 source's does
    const owner = createSoundOwner()
    let quiet = 0
    const letsGo = (): void => {
      quiet += 1
      owner.release(letsGo)
    }
    const next = source()
    const third = source()
    owner.claim(letsGo)

    // Act
    owner.claim(next.stop)
    owner.claim(third.stop)

    // Assert
    expect(quiet).toBe(1)
    expect(next.stops()).toBe(1)
  })
})
