// ============================================================
// Lesson 13 cold open — the predict's states, and a play cut short
// ============================================================
//
// WEB-SPEC, Toys 2; Tests 11 and 16, on the page's own markup with the
// kit's runs recorded: the choice locks on the first press; before it only
// Play Merc's ‘ee’ plays; after it the reveal waits until ‘ee’, then ‘ah’
// has been heard to its end with sound on, and a silent play shows the
// silent hint; Merc's ‘ee’ heard puts the lock hint back before a choice
// and `chosen` after one; after the reveal a silent play leaves "Play
// either again."; the reveal says "You said: their heights" or "their
// places"; no hint says "right" or "wrong"; and a play cut short by
// another sound never counts as heard.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { Sound } from '@/features/lessons/kit/sound'
import { initColdOpen } from './cold-open'
import { el, loadPage, settle, soundOn } from './page-dom.test-fixtures'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

beforeEach(() => {
  localStorage.clear()
  resetRuns()
  loadPage()
})

afterEach(async () => {
  NowPlaying.claim(() => undefined)
  await settle()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

/** Sound off: a play runs its strip in silence. */
function soundOff(): void {
  vi.spyOn(Sound, 'canPlay').mockReturnValue(false)
  vi.spyOn(Sound, 'state', 'get').mockReturnValue('off')
}

const hint = (): string =>
  (el('#predict .lock-hint').textContent ?? '').replace(/\s+/g, ' ').trim()
const reveal = (): HTMLElement => el('#predict .reveal')
const ee = (): HTMLButtonElement => el('#heroPlay')
const eeAh = (): HTMLButtonElement => el('.hero [data-play="ee-ah"]')
const choice = (c: string): HTMLButtonElement =>
  el(`#predict [data-choice="${c}"]`)
const heroSaid = (): string => el('#heroVowels [data-said]').textContent ?? ''

/** Presses a play and ends its run, heard to its end or not. */
async function play(btn: HTMLButtonElement, heard = true): Promise<void> {
  btn.click()
  await settle()
  runs.at(-1)?.end(heard)
  await settle()
}

describe("the cold open's predict (WEB-SPEC, Toys 2; Tests 11)", () => {
  it('locks the choice on the first press and opens ‘ee’, then ‘ah’, which was locked before it', () => {
    // Arrange
    soundOn()
    initColdOpen()
    const lockedBefore = eeAh().disabled

    // Act
    choice('places').click()
    choice('heights').click()

    // Assert
    expect(lockedBefore).toBe(true)
    expect(eeAh().disabled).toBe(false)
    expect(choice('places').getAttribute('aria-pressed')).toBe('true')
    expect(choice('heights').getAttribute('aria-pressed')).toBe('false')
    expect([choice('places').disabled, choice('heights').disabled]).toEqual([
      true,
      true,
    ])
    expect(hint()).toBe('Locked in. Now play ‘ee’, then ‘ah’.')
  })

  it("plays Merc's ‘ee’ before a choice, never reveals, and puts the lock hint back after a silent one", async () => {
    // Arrange
    soundOff()
    initColdOpen()

    // Act: silent first, then heard
    await play(ee())
    const silent = hint()
    vi.restoreAllMocks()
    soundOn()
    await play(ee())

    // Assert
    expect(runs).toHaveLength(2)
    expect(silent).toBe(
      'Sound is off, so nothing played. Turn sound on to hear it, then play it again.',
    )
    expect(hint()).toBe('Choose an answer to unlock ‘ee’, then ‘ah’.')
    expect(reveal().hidden).toBe(true)
    expect(heroSaid()).toBe("Merc's ‘ee’ on A 3: the line stayed level.")
  })

  it('plays nothing from ‘ee’, then ‘ah’ before a choice', async () => {
    // Arrange
    soundOn()
    initColdOpen()

    // Act
    eeAh().disabled = false
    eeAh().click()
    await settle()

    // Assert
    expect(runs).toHaveLength(0)
  })

  it('keeps the reveal hidden after a silent ‘ee’, then ‘ah’, then shows it once one is heard, with the guess', async () => {
    // Arrange
    soundOff()
    initColdOpen()
    choice('places').click()

    // Act
    await play(eeAh())
    const silentHidden = reveal().hidden
    const silentHint = hint()
    vi.restoreAllMocks()
    soundOn()
    await play(eeAh())

    // Assert
    expect(silentHidden).toBe(true)
    expect(silentHint).toMatch(/^Sound is off/)
    expect(reveal().hidden).toBe(false)
    expect(el('#predict .reveal .mono').textContent).toBe(
      'You said: their places',
    )
    expect(hint()).toBe('Play either again.')
    expect(heroSaid()).toBe('‘Ah’: peaks on the 3rd bar and the 5th.')
  })

  it("puts `chosen` in place of the silent hint once Merc's ‘ee’ is heard after a choice, and reveals nothing", async () => {
    // Arrange
    soundOff()
    initColdOpen()
    choice('heights').click()
    await play(ee())

    // Act
    vi.restoreAllMocks()
    soundOn()
    await play(ee())

    // Assert
    expect(hint()).toBe('Locked in. Now play ‘ee’, then ‘ah’.')
    expect(reveal().hidden).toBe(true)
  })

  it('leaves "Play either again." after the reveal, whatever plays next, and says "their heights" for that choice', async () => {
    // Arrange
    soundOn()
    initColdOpen()
    choice('heights').click()
    await play(eeAh())

    // Act
    vi.restoreAllMocks()
    soundOff()
    await play(ee())

    // Assert
    expect(hint()).toBe('Play either again.')
    expect(el('#predict .reveal .mono').textContent).toBe(
      'You said: their heights',
    )
  })

  it('never says right or wrong in any hint', () => {
    expect(
      [
        hint(),
        'Locked in. Now play ‘ee’, then ‘ah’.',
        'Play either again.',
      ].join(' '),
    ).not.toMatch(/\bright\b|\bwrong\b/i)
  })
})

describe('a play cut short never counts as heard (Tests 16)', () => {
  it('reveals nothing when another sound cuts ‘ee’, then ‘ah’ short, and reveals once it runs to its end', async () => {
    // Arrange
    soundOn()
    initColdOpen()
    choice('heights').click()

    // Act: another source takes the page's sound mid-play
    eeAh().click()
    await settle()
    NowPlaying.claim(() => undefined)
    await settle()
    const cut = { stopped: runs[0].stopped, hidden: reveal().hidden }
    await play(eeAh())

    // Assert
    expect(cut).toEqual({ stopped: true, hidden: true })
    expect(hint()).toBe('Play either again.')
    expect(reveal().hidden).toBe(false)
  })

  it('sings ‘ee’ for 2.0 s, a 0.5 s change, and ‘ah’ for 2.0 s, every point on A3', async () => {
    // Arrange
    soundOn()
    initColdOpen()
    choice('heights').click()

    // Act
    eeAh().click()
    await settle()

    // Assert
    expect(runs[0].points.map((p) => [p.t, p.hz])).toEqual([
      [0, 220],
      [2, 220],
      [2.5, 220],
      [4.5, 220],
    ])
  })
})
