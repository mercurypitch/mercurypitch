// ============================================================
// Lesson 17 cold open tests — one written bar, at 60 and at 120 BPM
// ============================================================
//
// On the page's own markup, with the beat clock a recorder (WEB-SPEC, Toys
// 2 and 3): nothing written and no length before a play, the faster play
// locked until a choice; the 60 BPM play writes each note as it sounds and
// reads its cell as it ends, then says its lengths; the 120 BPM play keeps
// the written bar, its readings gone until each note ends at 0.5 s, and
// the reveal waits for it heard to its end, its lengths spoken with it; a
// 120 BPM play cut short reveals and says nothing; and the metronome swings
// with the play and stills as it ends.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
import { Motion } from '@/features/lessons/kit/motion-switch'
import { Sound } from '@/features/lessons/kit/sound'
import type * as SoundAheadModule from '@/features/lessons/kit/sound-ahead'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import type * as WoodblockModule from '@/features/lessons/kit/woodblock'
import { COLD_PREDICT, HERO_WRITTEN, initColdOpen } from './cold-open'
import { drive, el, finish, loadPage, resetRuns, runs, settle, soundOn, words, } from './page-dom.test-fixtures'

vi.mock('@/features/lessons/kit/beat-clock', async (actual) => ({
  ...(await actual<typeof BeatClockModule>()),
  BeatClock: (await import('./page-dom.test-fixtures')).FakeBeatClock,
}))
vi.mock('@/features/lessons/kit/sound-ahead', async (actual) => ({
  ...(await actual<typeof SoundAheadModule>()),
  bookNote: () => null,
}))
vi.mock('@/features/lessons/kit/woodblock', async (actual) => ({
  ...(await actual<typeof WoodblockModule>()),
  bookWood: () => undefined,
}))

beforeEach(() => {
  resetRuns()
  soundOn()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
})

/** The hero on the page's own markup and deck, as main.ts mounts it. */
function mountHero(): StepDeck {
  loadPage()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Tap it', selector: '#sing' },
  })
  deck.start()
  initColdOpen(deck)
  return deck
}

const written = (): number[] =>
  Array.from(
    document.querySelectorAll('#heroPads .rb-sym:not(.is-hidden)'),
    (g) => Number(g.getAttribute('data-i')),
  )
const readings = (): string[] =>
  Array.from(
    document.querySelectorAll('#heroPads .rb-read:not(.is-hidden)'),
    (t) => t.textContent ?? '',
  )
const said = () => words(el('[data-hero-said]'))
const play = (bpm: 60 | 120) => el<HTMLButtonElement>(`#heroPlay${bpm}`)
const choose = (c: 'same' | 'half') =>
  el<HTMLButtonElement>(`#predict [data-choice="${c}"]`).click()

describe('the cold open', () => {
  it('shows nothing written and no length before a play, and locks the faster play until a choice', () => {
    // Act
    mountHero()

    // Assert (WEB-SPEC, Toys 2)
    expect(document.querySelectorAll('#heroPads .rb-sym')).toHaveLength(4)
    expect(written()).toEqual([])
    expect(readings()).toEqual([])
    expect(document.querySelectorAll('#heroPads .rb-padbtn')).toHaveLength(0)
    expect(play(120).disabled).toBe(true)
    expect(el('#heroPads .hero-rb').getAttribute('aria-hidden')).toBe('true')
  })

  it('plays the bar at 60, each note written as it sounds and read as it ends, then says its lengths', async () => {
    // Arrange
    mountHero()

    // Act
    play(60).click()
    const tempo = runs[0].o.bpm()
    drive(1)
    const first = [written(), readings()]
    await finish()

    // Assert (WEB-SPEC, Toys 2)
    expect(first).toEqual([[0], []])
    expect(tempo).toBe(60)
    expect(written()).toEqual([0, 1, 2, 3])
    expect(readings()).toEqual(['1 s', '1 s', '1 s', '1 s'])
    expect(said()).toBe(
      'Four quarter notes at 60 beats per minute: 1 second each.',
    )
    expect(words(el('[data-hero-caption]'))).toBe(HERO_WRITTEN)
    expect(el('#predict .reveal').hidden).toBe(true)
  })

  it('plays the same written bar at 120 once a choice locks, reading 0.5 s as each note ends, and reveals once it is heard', async () => {
    // Arrange
    mountHero()
    play(60).click()
    await finish()
    await settle()

    // Act
    choose('half')
    play(120).click()
    const tempo = runs[1].o.bpm()
    const kept = [written(), readings(), said()]
    drive(1)
    const partway = readings()
    await finish()
    await settle()

    // Assert (WEB-SPEC, Toys 2 and 3)
    expect(play(120).disabled).toBe(false)
    expect(kept).toEqual([
      [0, 1, 2, 3],
      [],
      'Four quarter notes at 60 beats per minute: 1 second each.',
    ])
    expect(tempo).toBe(120)
    expect(partway).toEqual([])
    expect(readings()).toEqual(['0.5 s', '0.5 s', '0.5 s', '0.5 s'])
    expect(el('#predict .reveal').hidden).toBe(false)
    expect(words(el('#predict .reveal .mono'))).toBe(COLD_PREDICT.guess.half)
    expect(said()).toBe(
      'Four quarter notes at 120 beats per minute: 0.5 seconds each.',
    )
  })

  it('reveals nothing and says nothing of a 120 BPM play cut short by a step change', async () => {
    // Arrange
    const deck = mountHero()
    choose('same')

    // Act
    play(120).click()
    drive(2)
    deck.show(2)
    await settle()

    // Assert (WEB-SPEC, Toys 3)
    expect(runs[0].stopped).toBe(true)
    expect(el('#predict .reveal').hidden).toBe(true)
    expect(said()).toBe('')
    expect(words(el('#predict .lock-hint'))).toBe(COLD_PREDICT.hints.chosen)
  })

  it('says nothing of the faster play run with sound off, and keeps the reveal for a play heard', async () => {
    // Arrange
    vi.spyOn(Sound, 'canPlay').mockReturnValue(false)
    mountHero()
    choose('half')

    // Act
    play(120).click()
    await finish()
    await settle()

    // Assert (WEB-SPEC, Toys 3; Audio, "Sound off")
    expect(readings()).toEqual(['0.5 s', '0.5 s', '0.5 s', '0.5 s'])
    expect(el('#predict .reveal').hidden).toBe(true)
    expect(said()).toBe('')
    expect(words(el('#predict .lock-hint'))).toBe(COLD_PREDICT.hints.silent)
  })

  it('swings the metronome with the play, its lamp lit on each beat, and stills it as the play ends', async () => {
    // Arrange
    vi.spyOn(Motion, 'paused', 'get').mockReturnValue(false)
    mountHero()
    const arm = el<SVGGElement>('#heroPads .metro .arm')
    const lamp = el('#heroPads .l17-lamp')

    // Act
    play(60).click()
    const frame = runs[0].o.onFrame
    frame?.({ bar: 0, beat: 1, beats: 1 })
    const onBeat = [arm.style.transform, lamp.classList.contains('is-lit')]
    frame?.({ bar: 0, beat: 1, beats: 1.5 })
    const between = [arm.style.transform, lamp.classList.contains('is-lit')]
    await finish()

    // Assert
    expect(onBeat).toEqual(['rotate(24deg)', true])
    expect(between).toEqual(['rotate(0deg)', false])
    expect(arm.style.transform).toBe('')
    expect(lamp.classList.contains('is-lit')).toBe(false)
  })

  it('holds the arm still under reduced motion, its lamp still lighting on the beat', () => {
    // Arrange: the doubles report reduced motion
    mountHero()
    const arm = el<SVGGElement>('#heroPads .metro .arm')

    // Act
    play(60).click()
    runs[0].o.onFrame?.({ bar: 0, beat: 1, beats: 1 })

    // Assert (WEB-SPEC, Merc and Tavi)
    expect(arm.style.transform).toBe('')
    expect(el('#heroPads .l17-lamp').classList.contains('is-lit')).toBe(true)
  })
})
