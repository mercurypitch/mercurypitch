// ============================================================
// Merc's moves tests — the glide states in and out
// ============================================================

import { createRoot } from 'solid-js'
import { describe, expect, it } from 'vitest'
import type { MercMoves } from './merc-moves'
import { createMercMoves } from './merc-moves'

function movesWith(still: boolean): {
  moves: MercMoves
  timers: (() => void)[]
  dispose: () => void
} {
  const timers: (() => void)[] = []
  return createRoot((dispose) => ({
    moves: createMercMoves({
      later: (_ms, fn) => timers.push(fn),
      still: () => still,
      afterCheer: () => 'ride',
    }),
    timers,
    dispose,
  }))
}

describe('createMercMoves, the glide states', () => {
  it('goes from humming at the foot of the bridge to riding it, and back', () => {
    // Arrange
    const { moves, dispose } = movesWith(false)

    // Act
    moves.set('hum')
    const humming = moves.state()
    moves.set('ride')
    const riding = moves.state()
    moves.set('idle')

    // Assert
    expect([humming, riding, moves.state()]).toEqual(['hum', 'ride', 'idle'])
    dispose()
  })

  it('keeps hum and ride under reduced motion: the stage stills them', () => {
    // Arrange
    const { moves, dispose } = movesWith(true)

    // Act
    moves.set('ride')
    const riding = moves.state()
    moves.set('hum')

    // Assert
    expect(riding).toBe('ride')
    expect(moves.state()).toBe('hum')
    dispose()
  })

  it('lands a hop in ride, and goes back to riding after a cheer', () => {
    // Arrange
    const { moves, timers, dispose } = movesWith(false)

    // Act
    moves.hopTo('inside', 'ride')
    const inTheAir = moves.state()
    timers.shift()?.()
    const landed = moves.state()
    moves.cheer()
    const cheering = moves.state()
    timers.splice(0).forEach((fn) => fn())

    // Assert
    expect([inTheAir, landed]).toEqual(['hop', 'ride'])
    expect(cheering).toBe('hop')
    expect(moves.state()).toBe('ride')
    dispose()
  })
})
