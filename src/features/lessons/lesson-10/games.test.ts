// ============================================================
// Lesson 10 games tests — Major or minor?, played on the page
// ============================================================
//
// The play half of WEB-SPEC, Tests 7, on the page's own markup and deck,
// its runs recorded (kit/run-recorder.test-fixtures.ts): each game deals
// from the kit's fresh seed and plays each round as one of the kit's runs
// in the soft tone, its notes at the run's level and a chords round's
// triad at a chord voice's, 0.075 each (FACTS 81); a miss replays the
// round at 1.5 times its lengths once its line is said (FACTS 78); and one
// sound plays at a time: a round stops the stage's sound and the other
// game's, the stage's stops a round, a sound started after a miss keeps
// its replay from ever playing, and leaving the step stops both.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { mulberry32 } from '@/features/lessons/kit/dom'
import type { EarNote } from '@/features/lessons/kit/ear-game'
import { freshSeed } from '@/features/lessons/kit/ear-game'
import type * as RunModule from '@/features/lessons/kit/run'
import type { RunNote } from '@/features/lessons/kit/run'
import type { RecordedRun } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { dealChords, dealThirds } from './game-rounds'
import { roundNotes } from './games'
import { el, mountSteps, settle, soundOn } from './page-dom.test-fixtures'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

const last = (): RecordedRun => {
  const r = runs.at(-1)
  if (r === undefined) throw new Error('nothing played')
  return r
}
const fixed = (r: RecordedRun): [string, number, string][] =>
  r.notes.map((n) => [n.t.toFixed(9), n.midi, n.dur.toFixed(9)])

/** The page on Step 1, its games dealing from a known fresh seed; the first round of thirds it deals. */
function thirdsGame() {
  vi.spyOn(Math, 'random').mockReturnValue(0.25)
  const round = dealThirds(mulberry32(freshSeed()))[0]
  const deck = mountSteps()
  return { deck, round, card: (s: string) => el(`#thirdsGame ${s}`) }
}

/** The thirds game's first round played to its end and answered wrong. */
async function missFirst(game: ReturnType<typeof thirdsGame>): Promise<void> {
  game.card('[data-eg-play]').click()
  last().end(true)
  await settle()
  const wrong = game.round.answer === 'major' ? 'minor' : 'major'
  game.card(`[data-eg-answer="${wrong}"]`).click()
}

beforeEach(() => {
  resetRuns()
  soundOn()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
})

describe("Lesson 10's game on thirds", () => {
  it('deals its eight rounds from the kit’s fresh seed, and plays each as its two notes in turn, in the soft tone, at the run’s level', () => {
    // Arrange
    vi.spyOn(Math, 'random').mockReturnValue(0.25)
    const rounds = dealThirds(mulberry32(freshSeed()))
    mountSteps()
    const card = (s: string): HTMLElement => el(`#thirdsGame ${s}`)

    // Act: each round played and answered right
    const played = rounds.map((round) => {
      card('[data-eg-play]').click()
      const heard = [last().notes, last().o.kind, last().o.audible]
      card(`[data-eg-answer="${round.answer}"]`).click()
      return heard
    })

    // Assert
    expect(played).toEqual(
      rounds.map((r) => [
        r.events.map((e) => ({ t: e.at, midi: e.midi, dur: e.dur })),
        'soft',
        true,
      ]),
    )
    expect(card('[data-eg-round]').textContent).toBe('8 of 8')
  })

  it('replays a missed round at 1.5 times its lengths, once its line is said', async () => {
    // Arrange
    const game = thirdsGame()
    await missFirst(game)
    const line = game.card('[data-eg-feedback]').textContent

    // Act
    vi.advanceTimersByTime(700)

    // Assert: 0.6 s and 0.8 s, 0.15 s apart, at 1.5 times (FACTS 78)
    const [root, top] = game.round.events.map((e) => e.midi)
    expect(line).toBe(
      `Here it is again, slower. ${game.round.answer === 'major' ? 'A major third: 4 semitones up.' : 'A minor third: 3 semitones up.'}`,
    )
    expect(runs).toHaveLength(2)
    expect(fixed(last())).toEqual([
      ['0.000000000', root, '0.900000000'],
      ['1.125000000', top, '1.200000000'],
    ])
  })

  it('stops a round that is sounding when the stage plays its third', async () => {
    // Arrange
    const game = thirdsGame()
    game.card('[data-eg-play]').click()
    const round = last()

    // Act
    el('#toyChord [data-chord-play="third"]').click()
    await settle()

    // Assert
    expect(round.stopped).toBe(true)
    expect(game.card('[data-eg-play]').classList.contains('is-on')).toBe(false)
    expect(last().stopped).toBe(false)
  })

  it('stops the stage’s third when a round plays', () => {
    // Arrange
    const game = thirdsGame()
    el('#toyChord [data-chord-play="third"]').click()
    const third = last()

    // Act
    game.card('[data-eg-play]').click()

    // Assert
    expect(third.stopped).toBe(true)
    expect(last().stopped).toBe(false)
  })

  it('never plays a miss’s replay once another sound has started after the answer', async () => {
    // Arrange: a missed round, 300 ms before its replay is due
    const game = thirdsGame()
    await missFirst(game)
    vi.advanceTimersByTime(300)

    // Act
    el('#toyChord .chord-hit-gap').click()
    vi.advanceTimersByTime(3000)

    // Assert: the round, then the gap's two notes, and no replay
    expect(runs).toHaveLength(2)
    expect(last().notes.map((n) => n.midi)).toEqual([60, 64, 60, 64])
  })

  it('stops a round, and a miss’s replay still to come, when the viewer leaves Step 1', async () => {
    // Arrange
    const game = thirdsGame()
    await missFirst(game)

    // Act
    game.deck.show(2)
    vi.advanceTimersByTime(3000)

    // Assert
    expect(runs).toHaveLength(1)
    expect(game.card('[data-eg-play]').classList.contains('is-on')).toBe(false)
  })
})

/** A chords round's notes as the page plays them: its scale's five at the run's level, then its triad's three at 0.075 each. */
const chordRunNotes = (events: readonly EarNote[]): RunNote[] =>
  events.map((e, i) =>
    i < 5
      ? { t: e.at, midi: e.midi, dur: e.dur }
      : { t: e.at, midi: e.midi, dur: e.dur, gain: 0.075 },
  )

describe("Lesson 10's game on chords", () => {
  it('deals its ten rounds from the kit’s fresh seed, each its scale’s five notes at the run’s level, then its triad together at 0.075 each', () => {
    // Arrange: both games deal from the same mocked seed
    vi.spyOn(Math, 'random').mockReturnValue(0.25)
    const rounds = dealChords(mulberry32(freshSeed()))
    mountSteps().show(3)
    const card = (s: string): HTMLElement => el(`#chordsGame ${s}`)

    // Act: each round played and answered right
    const played = rounds.map((round) => {
      card('[data-eg-play]').click()
      const heard = [last().notes, last().o.kind]
      card(`[data-eg-answer="${round.answer}"]`).click()
      return heard
    })

    // Assert: FACTS 78 and 81
    expect(played).toEqual(rounds.map((r) => [chordRunNotes(r.events), 'soft']))
    expect(new Set(rounds.map((r) => r.events[5].at))).toEqual(new Set([1.85]))
    expect(card('[data-eg-round]').textContent).toBe('10 of 10')
  })

  it('replays a missed chords round at 1.5 times its lengths, its triad still at 0.075 each', async () => {
    // Arrange
    vi.spyOn(Math, 'random').mockReturnValue(0.25)
    const round = dealChords(mulberry32(freshSeed()))[0]
    mountSteps().show(3)
    el('#chordsGame [data-eg-play]').click()
    last().end(true)
    await settle()
    const wrong = round.answer === 'major' ? 'minor' : 'major'

    // Act
    el(`#chordsGame [data-eg-answer="${wrong}"]`).click()
    vi.advanceTimersByTime(700)

    // Assert: 0.32 s a note, 0.25 s of silence and 1.2 s of triad, at 1.5 times
    expect(runs).toHaveLength(2)
    expect(
      last().notes.map((n) => [
        n.t.toFixed(9),
        n.dur.toFixed(9),
        n.gain ?? 'run',
      ]),
    ).toEqual([
      ...[0, 0.48, 0.96, 1.44, 1.92].map((t) => [
        t.toFixed(9),
        '0.480000000',
        'run',
      ]),
      ...[0, 1, 2].map(() => ['2.775000000', '1.800000000', 0.075]),
    ])
  })

  it('stops the game on thirds sounding when a chords round plays: one sound at a time', () => {
    // Arrange: a round of thirds sounding
    mountSteps()
    el('#thirdsGame [data-eg-play]').click()
    const thirds = last()

    // Act
    el('#chordsGame [data-eg-play]').click()

    // Assert
    expect(thirds.stopped).toBe(true)
    expect(last().stopped).toBe(false)
  })

  it('stops a chords round when the viewer leaves Step 3', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(3)
    el('#chordsGame [data-eg-play]').click()

    // Act
    deck.show(4)

    // Assert
    expect(last().stopped).toBe(true)
    expect(el('#chordsGame [data-eg-play]').classList.contains('is-on')).toBe(
      false,
    )
  })
})

describe("Lesson 10's games' notes", () => {
  it('sounds the notes of a round that start together as a chord’s voices, 0.075 each, and a note alone at the run’s level', () => {
    // Act
    const notes = roundNotes([
      { midi: 60, at: 0, dur: 0.6 },
      { midi: 60, at: 0.75, dur: 1.2 },
      { midi: 64, at: 0.75, dur: 1.2 },
    ])

    // Assert: FACTS 81
    expect(notes).toEqual([
      { t: 0, midi: 60, dur: 0.6 },
      { t: 0.75, midi: 60, dur: 1.2, gain: 0.075 },
      { t: 0.75, midi: 64, dur: 1.2, gain: 0.075 },
    ])
  })
})
