// ============================================================
// Lesson 12 steps' plays tests — Steps 3 and 4's buttons, Slow and the names switch
// ============================================================
//
// On the page's own markup and deck, its runs recorded (kit/run-recorder.
// test-fixtures.ts): Step 3's Play I, then vi and Step 4's Play the loop and
// Play the roots each play the ring's sound, and each is the page's one
// sound, so the next stops the last (WEB-SPEC, Toys 1). Slow is a switch
// (`aria-pressed`) on Steps 3, 4 and 5, and its choice holds from step to
// step. The names switch, Letters · Do-re-mi, writes the page's one names
// store: its choice holds on every step, the chips of each following it,
// and it shows the store's state whichever control changed it; a change
// stops what sounds first.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { chips, el, mountSteps, settle, soundOn, words, } from './page-dom.test-fixtures'
import { iThenVi, loop, roots, slow } from './sounds'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

const play = (what: string): HTMLButtonElement =>
  el<HTMLButtonElement>(`#toyRooms [data-rooms-play="${what}"]`)
const slowSwitch = (): HTMLButtonElement =>
  el<HTMLButtonElement>('#toyRooms [data-rooms-slow]')
const namesButton = (mode: string): HTMLButtonElement =>
  el<HTMLButtonElement>(`#toyRooms [data-names="${mode}"]`)
const namesPressed = (): string[] =>
  ['letters', 'solfege'].filter(
    (m) => namesButton(m).getAttribute('aria-pressed') === 'true',
  )

beforeEach(() => {
  resetRuns()
  soundOn()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
})

afterEach(() => {
  NowPlaying.claim(() => undefined)
  vi.useRealTimers()
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
})

describe("Lesson 12's Steps 3 and 4, their plays", () => {
  it.each([
    [3, 'slide', iThenVi('C')],
    [4, 'loop', loop('C')],
    [4, 'roots', roots('C')],
  ] as const)(
    "plays Step %i's %s as the ring's sound, in the soft tone",
    (n, what, notes) => {
      // Arrange
      const deck = mountSteps()
      deck.show(n)

      // Act
      play(what).click()

      // Assert
      expect(runs).toHaveLength(1)
      expect(runs[0].notes).toEqual(notes)
      expect(runs[0].o).toMatchObject({ audible: true, kind: 'soft' })
    },
  )

  it('stops the loop when the roots start, and the roots when a chip plays: one sound at a time', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(4)

    // Act
    play('loop').click()
    play('roots').click()
    chips()[0].click()
    await settle()

    // Assert
    expect(runs.map((r) => r.stopped)).toEqual([true, true, false])
  })

  it("lights each play's button while it sounds: the next play takes the light, a chip puts it out, and so does the play's own end", async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(4)
    const lit = (): string[] =>
      ['loop', 'roots'].filter((w) => play(w).classList.contains('is-on'))

    // Act
    play('loop').click()
    const loopPlaying = lit()
    play('roots').click()
    await settle()
    const rootsPlaying = lit()
    chips()[0].click()
    await settle()
    const chipPlaying = lit()
    play('roots').click()
    const again = lit()
    runs[3].end(true)
    await settle()

    // Assert
    expect(loopPlaying).toEqual(['loop'])
    expect(rootsPlaying).toEqual(['roots'])
    expect(chipPlaying).toEqual([])
    expect(again).toEqual(['roots'])
    expect(lit()).toEqual([])
  })

  it("puts Step 3's lit play out as the deck moves on", async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(3)
    play('slide').click()
    const playing = play('slide').classList.contains('is-on')

    // Act
    deck.show(4)
    await settle()

    // Assert
    expect(playing).toBe(true)
    expect(play('slide').classList.contains('is-on')).toBe(false)
  })
})

describe("Lesson 12's Slow", () => {
  it('presses as it is turned on, and plays the next sound at twice its lengths', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(3)

    // Act
    slowSwitch().click()
    play('slide').click()

    // Assert
    expect(slowSwitch().getAttribute('aria-pressed')).toBe('true')
    expect(runs[0].notes).toEqual(slow(iThenVi('C')))
  })

  it('holds from Step 3 to Step 4 and back, pressed, and is off again once pressed again', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(3)
    slowSwitch().click()

    // Act
    deck.show(4)
    const onStep4 = slowSwitch().getAttribute('aria-pressed')
    play('loop').click()
    deck.show(3)
    slowSwitch().click()
    play('slide').click()

    // Assert
    expect(onStep4).toBe('true')
    expect(runs[0].notes).toEqual(slow(loop('C')))
    expect(slowSwitch().getAttribute('aria-pressed')).toBe('false')
    expect(runs[1].notes).toEqual(iThenVi('C'))
  })
})

describe("Lesson 12's names switch", () => {
  it('turns the chips to syllables under Do-re-mi and back under Letters, the store and the switch with them', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(3)

    // Act
    namesButton('solfege').click()
    const sung = {
      pressed: namesPressed(),
      store: deck.names.mode,
      la: words(chips()[5], 'notes'),
    }
    namesButton('letters').click()

    // Assert: WEB-SPEC, Toys 1, Slide; Tests 13
    expect(sung).toEqual({
      pressed: ['solfege'],
      store: 'solfege',
      la: 'la do mi',
    })
    expect(namesPressed()).toEqual(['letters'])
    expect(words(chips()[5], 'notes')).toBe('A C E')
  })

  it('holds on every step: Step 4 and Step 1 read the syllables chosen on Step 3', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(3)
    namesButton('solfege').click()

    // Act
    deck.show(4)
    const step4 = words(chips()[4], 'notes')
    deck.show(1)

    // Assert: the page's one store (WEB-SPEC, Contract)
    expect(step4).toBe('so ti re')
    expect(words(chips()[0], 'notes')).toBe('do mi so')
    expect(words(chips()[0], 'top')).toBe('on do')
    expect(deck.rooms.settings.names).toBe('solfege')
  })

  it('shows the store’s state whichever control changed it', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(3)

    // Act: another copy of the ring writes the store
    deck.names.set('solfege')

    // Assert
    expect(namesPressed()).toEqual(['solfege'])
    expect(words(chips()[0], 'notes')).toBe('do mi so')
  })

  it('stops the play still sounding before the names change', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(3)
    play('slide').click()

    // Act
    namesButton('solfege').click()
    await settle()

    // Assert
    expect(runs[0].stopped).toBe(true)
  })
})
