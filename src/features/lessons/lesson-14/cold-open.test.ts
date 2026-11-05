// ============================================================
// Lesson 14 cold open — the predict's states, and a take cut short
// ============================================================
//
// WEB-SPEC, Toys 2, on the page's own markup with the kit's runs recorded:
// the choice locks on the first press and opens Play take 2; before it
// only Play take 1 plays, and never reveals; a silent take shows the
// silent hint, and take 1 heard puts the lock hint back as the page wrote
// it, or `chosen` after a choice; the reveal waits until take 2 has been
// heard to its end with sound on, says "You said: it rises" or "it stays
// level", and Tavi celebrates; a take cut short by another sound reveals
// nothing; the hero's live line says take 1's words once it ends and take
// 2's only with the reveal; and no hint says right or wrong.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as MercDuo from '@/features/lessons/kit/merc-duo'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { Sound } from '@/features/lessons/kit/sound'
import { guess, HINTS, initColdOpen } from './cold-open'
import { TAKE_SAID } from './lines'
import { el, loadPage, settle, soundOn } from './page-dom.test-fixtures'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

const duo = vi.hoisted(() => ({ sing: vi.fn(), celebrate: vi.fn() }))

vi.mock('@/features/lessons/kit/merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuo>()),
  mercSing: duo.sing,
  mercCelebrate: duo.celebrate,
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
  duo.sing.mockReset()
  duo.celebrate.mockReset()
  document.body.textContent = ''
})

/** Sound off: a take draws in silence. */
function soundOff(): void {
  vi.spyOn(Sound, 'canPlay').mockReturnValue(false)
  vi.spyOn(Sound, 'state', 'get').mockReturnValue('off')
}

const hint = (): string =>
  (el('#predict .lock-hint').textContent ?? '').replace(/\s+/g, ' ').trim()
const reveal = (): HTMLElement => el('#predict .reveal')
const take1 = (): HTMLButtonElement => el('#heroPlay')
const take2 = (): HTMLButtonElement => el('.hero [data-play="take2"]')
const choice = (c: string): HTMLButtonElement =>
  el(`#predict [data-choice="${c}"]`)
const heroSaid = (): string =>
  el('#heroSong [data-hero-said]').textContent ?? ''

/** Presses a take and ends its run, heard to its end or not. */
async function play(btn: HTMLButtonElement, heard = true): Promise<void> {
  btn.click()
  await settle()
  runs.at(-1)?.end(heard)
  await settle()
}

describe("the cold open's predict", () => {
  it('locks the choice on the first press and opens Play take 2, which was locked before it', () => {
    // Arrange
    soundOn()
    initColdOpen()
    const lockedBefore = take2().disabled

    // Act
    choice('level').click()
    choice('rises').click()

    // Assert
    expect(lockedBefore).toBe(true)
    expect(take2().disabled).toBe(false)
    expect(choice('level').getAttribute('aria-pressed')).toBe('true')
    expect(choice('rises').getAttribute('aria-pressed')).toBe('false')
    expect(hint()).toBe('Locked in. Now play take 2, and watch “star”.')
  })

  it('plays take 1 before a choice, never reveals, and puts the lock hint back once a take is heard after a silent one', async () => {
    // Arrange
    soundOff()
    initColdOpen()

    // Act: silent first, then heard
    await play(take1())
    const silent = hint()
    vi.restoreAllMocks()
    soundOn()
    await play(take1())

    // Assert: Merc's take 1 of phrase 1, its voice split by the breath
    expect(runs.map((r) => [r.kind, r.lines.length])).toEqual([
      ['lines', 2],
      ['lines', 2],
    ])
    expect(silent).toBe(HINTS.silent)
    expect(hint()).toBe('Choose an answer to unlock Play take 2.')
    expect(reveal().hidden).toBe(true)
    expect(heroSaid()).toBe(TAKE_SAID[1])
  })

  it('reveals nothing from take 1 heard after a choice, and says `chosen` again', async () => {
    // Arrange
    soundOn()
    initColdOpen()
    choice('rises').click()

    // Act
    await play(take1())

    // Assert
    expect(reveal().hidden).toBe(true)
    expect(hint()).toBe(HINTS.chosen)
  })

  it('keeps the reveal and take 2’s words back after a silent take 2, then shows them once it is heard, with the guess and Tavi’s celebration', async () => {
    // Arrange
    soundOff()
    initColdOpen()
    choice('rises').click()

    // Act
    await play(take2())
    const silentHidden = reveal().hidden
    const silentSaid = heroSaid()
    vi.restoreAllMocks()
    soundOn()
    await play(take2())

    // Assert
    expect([silentHidden, silentSaid]).toEqual([true, ''])
    expect(reveal().hidden).toBe(false)
    expect(el('#predict .reveal .mono').textContent).toBe('You said: it rises')
    expect(hint()).toBe('Play either take again.')
    expect(heroSaid()).toBe(TAKE_SAID[2])
    expect(duo.celebrate).toHaveBeenCalledWith('orange')
  })

  it('reveals nothing when another sound cuts take 2 short, and reveals once it plays to its end', async () => {
    // Arrange
    soundOn()
    initColdOpen()
    choice('level').click()
    take2().click()
    await settle()

    // Act: a Four words play takes the page's sound
    NowPlaying.claim(() => undefined)
    await settle()
    const cut = [runs[0].stopped, reveal().hidden]
    await play(take2())

    // Assert
    expect(cut).toEqual([true, true])
    expect(reveal().hidden).toBe(false)
    expect(el('#predict .reveal .mono').textContent).toBe(
      'You said: it stays level',
    )
  })

  it("has the chosen voice's Merc sing the take, Tavi for the higher voice", async () => {
    // Arrange
    localStorage.clear()
    const { VoiceChoice } = await import('@/features/lessons/kit/voice-choice')
    VoiceChoice.set('higher')
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    soundOn()
    initColdOpen()

    // Act
    take1().click()
    vi.advanceTimersByTime(0)

    // Assert
    expect(duo.sing).toHaveBeenCalledWith('orange', 62, true)
    vi.useRealTimers()
    VoiceChoice.set('lower')
  })

  it('never says right or wrong in any hint or guess', () => {
    expect(
      [...Object.values(HINTS), guess('rises'), guess('level')].join(' '),
    ).not.toMatch(/\bright\b|\bwrong\b|correct/i)
  })
})
