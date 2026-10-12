import { describe, expect, it } from 'vitest'
import { createChipPacer } from './chip-pacer'

describe('createChipPacer', () => {
  it('shows the first line at once', () => {
    // Arrange
    const pacer = createChipPacer(0.9)

    // Act
    pacer.want('lock')

    // Assert
    expect(pacer.take(5)).toBe('lock')
    expect(pacer.shown).toBe('lock')
  })

  it('lets a line stand its time before the next one shows', () => {
    // Arrange
    const pacer = createChipPacer(0.9)
    pacer.want('lock')
    pacer.take(1)

    // Act
    pacer.want('driftSharp')
    const early = pacer.take(1.5)
    const onTime = pacer.take(1.9)

    // Assert
    expect(early).toBeNull()
    expect(onTime).toBe('driftSharp')
  })

  it('shows the latest situation when the wait is over', () => {
    // Arrange: sharp, then back on the note before sharp could show.
    const pacer = createChipPacer(0.9)
    pacer.want('steady')
    pacer.take(0)
    pacer.want('driftSharp')
    pacer.take(0.3)

    // Act
    pacer.want('lock')

    // Assert
    expect(pacer.take(0.95)).toBe('lock')
  })

  it('never re-words a situation that is still on screen', () => {
    // Arrange
    const pacer = createChipPacer(0.9)
    pacer.want('driftSharp')
    pacer.take(0)

    // Act: still sharp, long after the hold.
    pacer.want('driftSharp')

    // Assert
    expect(pacer.take(5)).toBeNull()
    expect(pacer.shown).toBe('driftSharp')
  })

  it('drops a wish that the screen already shows', () => {
    // Arrange: sharp on screen, a lock asked for, then sharp again.
    const pacer = createChipPacer(0.9)
    pacer.want('driftSharp')
    pacer.take(0)
    pacer.want('lock')
    pacer.want('driftSharp')

    // Act
    const later = pacer.take(3)

    // Assert
    expect(later).toBeNull()
  })

  it('empties on reset, and the next line shows at once', () => {
    // Arrange
    const pacer = createChipPacer(0.9)
    pacer.want('lock')
    pacer.take(10)

    // Act
    pacer.reset()
    pacer.want('driftFlat')

    // Assert
    expect(pacer.shown).toBeNull()
    expect(pacer.take(10.1)).toBe('driftFlat')
  })
})
