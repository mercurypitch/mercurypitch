// ============================================================
// Lesson 12 Step 5 tests — the tune toy's three buttons, Stop, the walk and the count
// ============================================================
//
// On the page's own markup and deck, its runs recorded (kit/run-recorder.
// test-fixtures.ts): Tune 1, Tune 2 and Even notes each play their tune
// over the loop as the ring's one run; while one plays its button reads
// "Stop" and is named "Stop tune 1" (WCAG 2.5.3), and a press stops it;
// the walk follows each sung note, lighting each chord's room and chip, the
// polite line says the tune as it starts and its count as it ends, and the
// walk and the count stay, faint, until the next play (WEB-SPEC, Toys 5).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { Sound } from '@/features/lessons/kit/sound'
import { chips, el, mountSteps, said, settle, soundOn, } from './page-dom.test-fixtures'
import { slow, tune } from './sounds'
import { tuneSound } from './tune-play'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

const tuneButton = (id: string): HTMLButtonElement =>
  el<HTMLButtonElement>(`#toyRooms [data-tune="${id}"]`)
const face = (id: string): { words: string; name: string | null } => ({
  words: tuneButton(id).textContent?.trim() ?? '',
  name: tuneButton(id).getAttribute('aria-label'),
})
/** Starts every note of the run in turn, as the kit's timers would. */
const playThrough = (i: number): void => {
  runs[i].notes.forEach((_, k) => runs[i].note(k))
}

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

describe("Lesson 12's Step 5, the tune toy", () => {
  it.each(['tune-1', 'tune-2', 'even'] as const)(
    'plays %s over the loop as one run, its own notes carrying their tone and level',
    (id) => {
      // Arrange
      const deck = mountSteps()
      deck.show(5)

      // Act
      tuneButton(id).click()

      // Assert
      expect(runs).toHaveLength(1)
      expect(runs[0].notes).toEqual(tune(id, 'C'))
      expect(runs[0].o).toMatchObject({ audible: true, kind: 'soft' })
      expect(deck.rooms.tune).toBe(id)
    },
  )

  it('reads "Stop" while it plays, named "Stop tune 1", and its own words again once it ends', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(5)

    // Act
    tuneButton('tune-1').click()
    const playing = face('tune-1')
    runs[0].end(true)
    await settle()

    // Assert
    expect(playing).toEqual({ words: 'Stop', name: 'Stop tune 1' })
    expect(face('tune-1')).toEqual({ words: 'Tune 1', name: 'Play tune 1' })
  })

  it.each([
    ['tune-2', 'Stop tune 2'],
    ['even', 'Stop tune 2 with even notes'],
  ] as const)('names %s "%s" while it plays', (id, name) => {
    // Arrange
    const deck = mountSteps()
    deck.show(5)

    // Act
    tuneButton(id).click()

    // Assert
    expect(face(id)).toEqual({ words: 'Stop', name })
  })

  it('stops the tune on a press of its Stop, its run cut short and its button back', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(5)
    tuneButton('tune-2').click()

    // Act
    tuneButton('tune-2').click()
    await settle()

    // Assert
    expect(runs).toHaveLength(1)
    expect(runs[0].stopped).toBe(true)
    expect(deck.rooms.tune).toBe(null)
    expect(face('tune-2')).toEqual({ words: 'Tune 2', name: 'Play tune 2' })
  })

  it('stops one tune when another starts: the first button back, the second reading Stop', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(5)
    tuneButton('tune-1').click()

    // Act
    tuneButton('even').click()
    await settle()

    // Assert
    expect(runs.map((r) => r.stopped)).toEqual([true, false])
    expect(face('tune-1').words).toBe('Tune 1')
    expect(face('even')).toEqual({
      words: 'Stop',
      name: 'Stop tune 2 with even notes',
    })
  })

  it("says the tune as it starts and its count as it ends: tune 1's 11 of 15", async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(5)

    // Act
    tuneButton('tune-1').click()
    const starting = said()
    playThrough(0)
    runs[0].end(true)
    await settle()

    // Assert
    expect(starting).toBe('Tune 1, over the four chords.')
    expect(said()).toBe('On a corner: 11 of 15.')
  })

  it('says the count where a stop left it: 4 of 5 after five of tune 1', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(5)
    tuneButton('tune-1').click()
    const s = tuneSound('tune-1', 'C', false)
    // up to the fifth of the tune's notes, and the chords under them
    const fifth = s.notes.findIndex((_, i) => s.sungAt(i) === 4)
    for (let k = 0; k <= fifth; k++) runs[0].note(k)

    // Act
    tuneButton('tune-1').click()
    await settle()

    // Assert
    expect(said()).toBe('On a corner: 4 of 5.')
  })

  it("lights each chord's chip as its chord starts, and none once the tune ends", async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(5)
    tuneButton('tune-2').click()
    const s = tuneSound('tune-2', 'C', false)
    const lit = (): number[] =>
      chips().flatMap((b, i) => (b.classList.contains('is-on') ? [i] : []))

    // Act
    const seen: number[][] = []
    s.notes.forEach((_, k) => {
      runs[0].note(k)
      if (s.chordAt(k) !== null) seen.push(lit())
    })
    runs[0].end(true)
    await settle()

    // Assert
    expect([...new Set(seen.map((d) => d.join()))]).toEqual([
      '0',
      '4',
      '5',
      '3',
    ])
    expect(lit()).toEqual([])
  })

  it('keeps the walk and its count once the tune ends, until the next play', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(5)
    tuneButton('tune-1').click()
    playThrough(0)
    runs[0].end(true)
    await settle()
    const kept = deck.rooms.state().walk

    // Act
    chips()[0].click()

    // Assert
    expect(kept).toMatchObject({ id: 'tune-1', key: 'C', stoppedAt: null })
    expect(deck.rooms.state().walk).toBe(null)
  })

  it('marks where a stop cut the walk short, so it stays where it reached', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(5)
    tuneButton('tune-2').click()
    vi.advanceTimersByTime(1500)

    // Act
    tuneButton('tune-2').click()
    await settle()

    // Assert
    const walk = deck.rooms.state().walk
    expect(walk?.stoppedAt).toBeGreaterThan(walk?.at ?? Infinity)
  })

  it('plays every length twice as long under Slow', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(5)
    el<HTMLButtonElement>('#toyRooms [data-rooms-slow]').click()

    // Act
    tuneButton('tune-1').click()

    // Assert
    expect(runs[0].notes).toEqual(slow(tune('tune-1', 'C')))
    expect(deck.rooms.state().walk?.by).toBe(2)
  })

  it('stops the tune and puts its button back as the deck leaves Step 5', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(5)
    tuneButton('tune-1').click()

    // Act
    deck.show(4)
    await settle()

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(face('tune-1')).toEqual({ words: 'Tune 1', name: 'Play tune 1' })
    expect(deck.rooms.state().walk).toBe(null)
  })

  it('plays the tune silent, its walk still drawn, when sound is off', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(5)
    vi.spyOn(Sound, 'canPlay').mockReturnValue(false)

    // Act
    tuneButton('tune-1').click()

    // Assert
    expect(runs[0].o.audible).toBe(false)
    expect(deck.rooms.state().walk?.id).toBe('tune-1')
  })
})
