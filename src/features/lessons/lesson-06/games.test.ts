// ============================================================
// Lesson 6 games tests — a miss's replay asks nothing of a viewer with sound off
// ============================================================
//
// On the page's own markup, with sound off: a tap on Play a pair shows the
// sound-off note, as every tap does, and the slower replay after a miss,
// which a timer starts, plays silently and shows nothing.

import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { mulberry32 } from '@/features/lessons/kit/dom'
import { freshSeed } from '@/features/lessons/kit/ear-game'
import { Sound } from '@/features/lessons/kit/sound'
import { dealStepOrLeap } from './game-rounds'
import { el, mountSteps } from './page-dom.test-fixtures'

afterEach(() => {
  Sound.set('unset')
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe("Lesson 6's games, with sound off", () => {
  it("shows the sound-off note for a tap, and none for a miss's replay", () => {
    // Arrange: sound off, the games dealing from a known seed, and Step or leap?'s first pair tapped
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    Sound.set('off')
    vi.spyOn(Math, 'random').mockReturnValue(0.25)
    const round = dealStepOrLeap(mulberry32(freshSeed()))[0]
    mountSteps().show(2)
    const note = el('#toast')
    el('#stepLeapGame [data-eg-play]').click()
    const onTap = note.classList.contains('on')
    // the note goes after its four seconds, and the pair has long ended
    vi.advanceTimersByTime(5000)
    const gone = !note.classList.contains('on')

    // Act: the round missed, and its replay come due
    const wrong = round.answer === 'step' ? 'leap' : 'step'
    el(`#stepLeapGame [data-eg-answer="${wrong}"]`).click()
    vi.advanceTimersByTime(800)

    // Assert
    expect(el('#stepLeapGame [data-eg-feedback]').textContent).toMatch(
      /^Here it is again, slower\./,
    )
    expect(onTap).toBe(true)
    expect(gone).toBe(true)
    expect(note.classList.contains('on')).toBe(false)
  })
})
