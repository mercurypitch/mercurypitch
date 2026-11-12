// ============================================================
// Lesson 18 cold open tests — the predict, Merc's read and Merc's way
// ============================================================
//
// On the page's own markup, with the beat clock a recorder (WEB-SPEC,
// Toys 1): the read waits for a choice, and the choice unlocks Step 1's
// toy; Watch Merc read sings do first, then names each note on one beat
// and sings it on the next on Merc's "ooh", with no tags, and says what it
// played; the reveal holds Read Merc's way, which brackets each pattern as
// the cursor reaches it; and leaving the hero stops its play.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
import { hz } from '@/features/lessons/kit/notes'
import type * as SoundAheadModule from '@/features/lessons/kit/sound-ahead'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import type * as WoodblockModule from '@/features/lessons/kit/woodblock'
import { Choice, resetChoice } from './choice'
import { COLD_PREDICT, initColdOpen } from './cold-open'
import { drive, el, finish, loadPage, resetRuns, runs, settle, soundOn, words, } from './page-dom.test-fixtures'
import { READ_LINES } from './reads'

vi.mock('@/features/lessons/kit/beat-clock', async (actual) => ({
  ...(await actual<typeof BeatClockModule>()),
  BeatClock: (await import('./page-dom.test-fixtures')).FakeBeatClock,
}))
const voices: { freq: number; kind: string | undefined }[] = []
vi.mock('@/features/lessons/kit/sound-ahead', async (actual) => ({
  ...(await actual<typeof SoundAheadModule>()),
  bookNote: (freq: number, o: { kind?: string }) => {
    voices.push({ freq, kind: o.kind })
    return null
  },
}))
vi.mock('@/features/lessons/kit/woodblock', async (actual) => ({
  ...(await actual<typeof WoodblockModule>()),
  bookWood: () => undefined,
}))

function mountHero() {
  loadPage()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Sing it', selector: '#sing' },
  })
  deck.start()
  const open = initColdOpen(deck)
  return { deck, open }
}

const hero = () => el('#heroStaff')
const texts = (sel: string): string[] =>
  Array.from(hero().querySelectorAll(sel), (e) => words(e))
const choose = (c: string) =>
  el<HTMLButtonElement>(`#predict [data-choice="${c}"]`).click()
const G3 = 55
const A3 = 57
const B3 = 59

beforeEach(() => {
  resetRuns()
  resetChoice()
  voices.length = 0
  soundOn()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
})

describe('the cold open', () => {
  it('words the predict’s hints and guesses as the spec does', () => {
    // Assert
    expect(COLD_PREDICT).toEqual({
      hints: {
        chosen: 'Locked in. Watch Merc read.',
        silent:
          'Sound is off: nothing played. Turn sound on, then play it again.',
        again: 'Play it again.',
      },
      guess: { seven: 'You said: all seven', four: 'You said: only four' },
    })
  })

  it('keeps the read locked until a choice, which unlocks Step 1’s toy too', () => {
    // Arrange
    mountHero()
    const read = el<HTMLButtonElement>('#heroPlay')

    // Act
    const before = [read.disabled, Choice.made]
    choose('four')

    // Assert
    expect(before).toEqual([true, false])
    expect(read.disabled).toBe(false)
    expect(Choice.made).toBe(true)
  })

  it('sings do, then names each note on one beat and sings it on the next on Merc’s ooh, with no tags, and says what it played', async () => {
    // Arrange
    mountHero()
    choose('seven')

    // Act
    el<HTMLButtonElement>('#heroPlay').click()
    drive()
    const names = texts('.rd-name')
    const tags = texts('.rd-tag')
    await finish()

    // Assert
    expect(voices).toEqual([
      { freq: hz(G3), kind: 'soft' },
      { freq: hz(G3), kind: 'merc' },
      { freq: hz(A3), kind: 'merc' },
      { freq: hz(B3), kind: 'merc' },
      { freq: hz(A3), kind: 'merc' },
    ])
    expect(names).toEqual(['do', 're', 'mi', 're'])
    expect(tags).toEqual([])
    expect(words(el('[data-hero-said]'))).toBe(READ_LINES.heroByName)
    expect(el('#predict .reveal').hidden).toBe(false)
    expect(words(el('#predict .reveal'))).toContain('You said: all seven')
  })

  it('reads Merc’s way from the reveal, each bracket fading in as the cursor reaches its pattern', async () => {
    // Arrange
    mountHero()
    choose('four')
    el<HTMLButtonElement>('#heroPlay').click()
    await finish()

    // Act
    el<HTMLButtonElement>('#predict [data-play="way"]').click()
    const onFrame = runs[runs.length - 1].o.onFrame
    onFrame?.({ bar: 1, beat: 0, beats: 4 })
    const one = texts('.rd-bracket text')
    onFrame?.({ bar: 2, beat: 0, beats: 8 })
    await finish()

    // Assert: the names of the read go, the brackets come
    expect(one).toEqual(['a run of steps'])
    expect(texts('.rd-bracket text')).toEqual(['a run of steps', 'do-mi-so'])
    expect(texts('.rd-name')).toEqual([])
    expect(words(el('[data-hero-said]'))).toBe(READ_LINES.heroWay)
  })

  it('stops the read when the deck changes step, so a read cut short reveals nothing', async () => {
    // Arrange
    const { deck } = mountHero()
    choose('four')
    el<HTMLButtonElement>('#heroPlay').click()
    const run = runs[runs.length - 1]

    // Act
    deck.show(2)
    await settle()

    // Assert
    expect(run.stopped).toBe(true)
    expect(el('#predict .reveal').hidden).toBe(true)
  })
})
