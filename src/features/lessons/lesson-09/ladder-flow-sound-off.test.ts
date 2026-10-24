// ============================================================
// Lesson 9 ladder flow tests — Sing it with the sound off
// ============================================================
//
// Merc sings the ladder before every take, so what waits on hearing it
// waits while the sound is off (Lesson 1's rule; WEB-SPEC, state 5): Start,
// Start again and either Again begin no take and use nothing up, and the
// hint beside each names the button pressed, as every lesson's does. The
// sound turned off while Merc sings, before the take listens, ends the take
// without counting it, and the card goes back to how it stood before its
// button, with that button's hint: no take is spent on a ladder the viewer
// could not hear.

import { describe, expect, it } from 'vitest'
import { next, offers } from './ladder-flow'
import { begin, briefed, feel, run, SILENCED, SING, SOUND_OFF, SOUND_ON, take, visit, } from './ladder-flow.test-fixtures'

describe('with the sound off', () => {
  const off = () => run([SING], visit({ sound: false }))
  /** The three cards with a button that begins a take, and that button. */
  const BUTTONS = [
    ['Start', () => off(), 'full', 'briefing', 'soundOff'],
    [
      'Start again',
      () => run([...take('full', 'none'), SOUND_OFF], briefed()),
      'smaller',
      'noVoice',
      'soundOffStartAgain',
    ],
    [
      'Again',
      () => run([...take('full', 'all'), feel('easy'), SOUND_OFF], briefed()),
      'full',
      'reading',
      'soundOffAgain',
    ],
    [
      'Again smaller',
      () => run([...take('full', 'all'), feel('easy'), SOUND_OFF], briefed()),
      'smaller',
      'reading',
      'soundOffAgain',
    ],
  ] as const

  it('shows no hint until a button is pressed', () => {
    // Act
    const o = offers(off())

    // Assert
    expect(o.hint).toBeNull()
  })

  it.each(BUTTONS)(
    'begins no take from %s, uses nothing up, and shows the hint naming it',
    (_, card, ladder, stage, hint) => {
      // Arrange
      const v = card()

      // Act
      const pressed = next(v, begin(ladder))

      // Assert
      expect(pressed).toEqual({ ...v, silentPress: true })
      expect(offers(pressed)).toMatchObject({ stage, hint })
    },
  )

  it("shows Start's hint after Play Merc's ladder in the briefing", () => {
    // Act
    const played = next(off(), { type: 'play' })

    // Assert
    expect(offers(played).hint).toBe('soundOff')
  })

  it('takes the hint away when the sound comes on', () => {
    // Arrange
    const pressed = next(off(), begin('full'))

    // Act
    const on = next(pressed, SOUND_ON)

    // Assert
    expect(offers(on).hint).toBeNull()
  })

  it('begins the take from Start once the sound is on', () => {
    // Arrange
    const on = run([begin('full'), SOUND_ON], off())

    // Act
    const taking = next(on, begin('full'))

    // Assert
    expect(taking.taking).toBe('full')
  })

  it.each(BUTTONS)(
    'ends a take uncounted when the sound goes off while Merc sings, the card back as before %s, with its hint',
    (_, card, ladder, stage, hint) => {
      // Arrange
      const before = run([SOUND_ON], card())
      const singing = run([begin(ladder), SOUND_OFF], before)

      // Act
      const after = next(singing, SILENCED)

      // Assert
      expect(after).toEqual({ ...before, sound: false, silentPress: true })
      expect(offers(after)).toMatchObject({ stage, hint })
    },
  )

  it('leaves a take alone when the sound is on', () => {
    // Arrange
    const taking = run([begin('full')], briefed())

    // Act
    const after = next(taking, SILENCED)

    // Assert
    expect(after).toBe(taking)
  })
})
