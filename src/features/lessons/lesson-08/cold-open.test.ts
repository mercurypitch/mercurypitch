// ============================================================
// Lesson 8 cold open tests — heard means finished, one sound at a time
// ============================================================
//
// WEB-SPEC, Tests 18, on the page's own markup, the beat clock a recorder
// (page-dom.test-fixtures.ts): "Play with claps on 1 and 3" plays before a
// choice and reveals nothing; "Play with claps on 2 and 4" waits for one; a
// play cut short, by another sound or by a newer play, resolves false and
// leaves the reveal hidden, and one heard to its end reveals; until then
// nothing is gold and beat 1 is the size of the rest. Any sound the page
// starts stops the one already sounding, and the live line is written once
// a change, never again with the same words.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { initColdOpen } from './cold-open'
import { el, live, loadPage, resetRuns, runs, settle, soundOn, } from './page-dom.test-fixtures'
import { bindQuizPlays } from './quiz-play'
import { initWords } from './words'

vi.mock('@/features/lessons/kit/beat-clock', async (actual) => ({
  ...(await actual<typeof BeatClockModule>()),
  BeatClock: (await import('./page-dom.test-fixtures')).FakeBeatClock,
}))

const reveal = (): HTMLElement => el('#predict .reveal')
const goldClaps = (): number =>
  document.querySelectorAll('#heroStrip i.clap.gold').length

beforeEach(() => {
  resetRuns()
  soundOn()
  loadPage()
  initColdOpen()
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe("Lesson 8's cold open", () => {
  it('plays claps on 1 and 3 before any choice, and reveals nothing with it', async () => {
    // Act
    el('#heroPlay').click()
    runs[0].end(true)
    await settle()

    // Assert
    expect(runs).toHaveLength(1)
    expect(reveal().hidden).toBe(true)
    expect(el<HTMLButtonElement>('#heroPlay24').disabled).toBe(true)
    expect(el('[data-hero-said]').textContent).toBe('Claps on 1 and 3')
  })

  it('keeps claps on 2 and 4 locked until a choice', () => {
    // Act
    el('#heroPlay24').click()

    // Assert
    expect(runs).toHaveLength(0)

    // Act
    el('#predict [data-choice="weak"]').click()

    // Assert
    expect(el<HTMLButtonElement>('#heroPlay24').disabled).toBe(false)
  })

  it('reveals nothing after a play cut short by another sound, and reveals once one is heard to its end', async () => {
    // Arrange
    el('#predict [data-choice="weak"]').click()

    // Act: another sound on the page starts while the claps on 2 and 4 play
    el('#heroPlay24').click()
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(reveal().hidden).toBe(true)
    expect(goldClaps()).toBe(0)
    expect(el('#heroStrip').classList.contains('accented')).toBe(false)

    // Act
    el('#heroPlay24').click()
    runs[1].end(true)
    await settle()

    // Assert
    expect(reveal().hidden).toBe(false)
    expect(el('#predict .reveal .mono').textContent).toBe(
      'You said: weak beats',
    )
    expect(goldClaps()).toBe(8)
    expect(el('#heroStrip').classList.contains('accented')).toBe(true)
    // the ghost of the claps on 1 and 3 stays beside them
    expect(document.querySelectorAll('#heroStrip i.ghost')).toHaveLength(8)
  })

  it('reveals nothing after claps on 1 and 3, even after the choice', async () => {
    // Arrange
    el('#predict [data-choice="strong"]').click()

    // Act
    el('#heroPlay').click()
    runs[0].end(true)
    await settle()

    // Assert
    expect(reveal().hidden).toBe(true)
  })

  it('moves the claps to 2 and 4 as that version starts, and says so once', async () => {
    // Arrange
    el('#predict [data-choice="strong"]').click()
    const said = el('[data-hero-said]')
    const writes = vi.fn()
    new MutationObserver(writes).observe(said, {
      childList: true,
      characterData: true,
      subtree: true,
    })

    // Act
    el('#heroPlay24').click()
    await settle()
    runs[0].end(false)
    await settle()
    el('#heroPlay24').click()
    await settle()

    // Assert
    const at = [
      ...document.querySelectorAll<HTMLElement>(
        '#heroStrip i.clap:not(.ghost)',
      ),
    ].map((d) => Number(d.style.getPropertyValue('--at')))
    expect(at.slice(0, 4)).toEqual([1, 3, 5, 7])
    expect(said.textContent).toBe('Claps moved to 2 and 4')
    expect(writes).toHaveBeenCalledTimes(1)
  })
})

describe("Lesson 8's one sound at a time", () => {
  it('stops the cold open when a word is pressed, and the word when the quiz plays', () => {
    // Arrange
    initWords()
    bindQuizPlays(document.body)
    document.body.insertAdjacentHTML(
      'beforeend',
      '<button type="button" data-quiz-play="bars">Play two bars</button>',
    )

    // Act
    el('#heroPlay').click()
    el('[data-word="tempo"] [data-word-play]').click()

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(live()).toHaveLength(1)

    // Act
    el('[data-quiz-play="bars"]').click()

    // Assert: the newest press wins
    expect(runs[1].stopped).toBe(true)
    expect(live()).toEqual([runs[2]])
    expect(runs[2].o.bar(0)?.beats).toBe(7)
  })

  it('ignores a second press of a word still sounding, as the kit strip does', () => {
    // Arrange
    initWords()

    // Act
    el('[data-word="beat"] [data-word-play]').click()
    el('[data-word="beat"] [data-word-play]').click()

    // Assert
    expect(runs).toHaveLength(1)
    expect(live()).toEqual([runs[0]])
    expect(el('[data-word="beat"] [data-word-play]').classList).toContain(
      'is-on',
    )
  })
})
