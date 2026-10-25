// ============================================================
// Move do tests — four semitones either way, the ends, the count-in
// ============================================================
//
// Lesson 4's control, word for word: a whole semitone a press, four at
// most either way, and the button at an end aria-disabled, the other not,
// both still focusable. A page may pass a reach for each side, as Lesson
// 12 does (its Tests 9): four lower and three higher. The count-in plays
// do once, 0.8 s at 0.065, and hands back its voice.

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MoveReach } from './move-do'
import { clampMove, COUNT_IN, COUNT_IN_SEC, countIn, MOVE_MAX, MOVE_REACH, nextShift, setMoveEnds, } from './move-do'
import type { Voice } from './sound'
import { Sound } from './sound'

/** Move do's two buttons, lower then higher, as the lesson pages mark them up. */
function buttons(): [HTMLButtonElement, HTMLButtonElement] {
  const root = document.createElement('div')
  root.innerHTML =
    '<button type="button" data-move-do="-1">lower</button>' +
    '<button type="button" data-move-do="1">higher</button>'
  const [lower, higher] = Array.from(root.querySelectorAll('button'))
  return [lower, higher]
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Move do', () => {
  it('keeps do whole and within four semitones either way', () => {
    // Assert
    expect(MOVE_MAX).toBe(4)
    expect(MOVE_REACH).toEqual({ lower: 4, higher: 4 })
    expect(
      [-9, -5, -4, -1.4, 0, 2.6, 4, 5, 9].map((s) => clampMove(s)),
    ).toEqual([-4, -4, -4, -1, 0, 3, 4, 4, 4])
  })

  it('moves do a semitone by the pressed button, and no further than an end', () => {
    // Arrange
    const [lower, higher] = buttons()

    // Act
    const moved = [
      nextShift(0, lower),
      nextShift(0, higher),
      nextShift(-4, lower),
      nextShift(4, higher),
      nextShift(4, lower),
    ]

    // Assert
    expect(moved).toEqual([-1, 1, -4, 4, 3])
  })

  it('marks only the button whose end do has reached aria-disabled, and leaves both focusable', () => {
    // Arrange
    const [lower, higher] = buttons()
    const ends = (shift: number): (string | null)[] => {
      setMoveEnds([lower, higher], shift)
      return [
        lower.getAttribute('aria-disabled'),
        higher.getAttribute('aria-disabled'),
      ]
    }

    // Act
    const seen = [-4, -3, 0, 3, 4].map(ends)

    // Assert
    expect(seen).toEqual([
      ['true', 'false'],
      ['false', 'false'],
      ['false', 'false'],
      ['false', 'false'],
      ['false', 'true'],
    ])
    expect([lower.disabled, higher.disabled]).toEqual([false, false])
  })
})

describe('Move do with a reach for each side', () => {
  /** Lesson 12's reach (its FACTS 60): four lower, three higher. */
  const REACH: MoveReach = { lower: 4, higher: 3 }

  it('holds four lower and three higher, and refuses four higher and five lower', () => {
    // Act
    const kept = [-5, -4, 3, 4].map((s) => clampMove(s, REACH))

    // Assert
    expect(kept).toEqual([-4, -4, 3, 3])
  })

  it('stops a press at three higher and at four lower', () => {
    // Arrange
    const [lower, higher] = buttons()

    // Act
    const moved = [
      nextShift(2, higher, REACH),
      nextShift(3, higher, REACH),
      nextShift(3, lower, REACH),
      nextShift(-3, lower, REACH),
      nextShift(-4, lower, REACH),
    ]

    // Assert
    expect(moved).toEqual([3, 3, 2, -4, -4])
  })

  it('marks aria-disabled only the end that was reached', () => {
    // Arrange
    const [lower, higher] = buttons()
    const ends = (shift: number): (string | null)[] => {
      setMoveEnds([lower, higher], shift, REACH)
      return [
        lower.getAttribute('aria-disabled'),
        higher.getAttribute('aria-disabled'),
      ]
    }

    // Act
    const seen = [-4, -3, 2, 3].map(ends)

    // Assert: three higher is the top, where the default reach would go on to four
    expect(seen).toEqual([
      ['true', 'false'],
      ['false', 'false'],
      ['false', 'false'],
      ['false', 'true'],
    ])
  })
})

describe('countIn', () => {
  it('plays do once, 0.8 s at half a tapped note, and hands back its voice', () => {
    // Arrange
    const voice: Voice = {
      alive: true,
      setFreq: () => undefined,
      setGain: () => undefined,
      stop: () => undefined,
    }
    const played = vi.spyOn(Sound, 'voice').mockReturnValue(voice)

    // Act
    const counting = countIn(57, true)

    // Assert: A3, 220 Hz, then 0.2 s of quiet before the sweep
    expect(counting).toBe(voice)
    expect(played).toHaveBeenCalledTimes(1)
    expect(played.mock.calls[0][0]).toBeCloseTo(220, 6)
    expect(played.mock.calls[0][1]).toEqual({ dur: 0.8, gain: 0.065 })
    expect([COUNT_IN.note, COUNT_IN.quiet, COUNT_IN_SEC]).toEqual([0.8, 0.2, 1])
  })

  it('plays nothing when the press is silent', () => {
    // Arrange
    const played = vi.spyOn(Sound, 'voice')

    // Act
    const counting = countIn(57, false)

    // Assert
    expect(counting).toBeNull()
    expect(played).not.toHaveBeenCalled()
  })
})
