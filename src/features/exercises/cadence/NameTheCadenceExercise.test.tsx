// ============================================================
// Name the Cadence, through the shell: the brief, a run, the result
// ============================================================

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioEngine } from '@/lib/audio-engine'
import { clearExerciseHistory, exerciseHistory, flushExerciseHistoryWrites, } from '@/stores/exercise-history-store'
import { EXERCISE_CADENCE } from '../types'
import type { CadenceRound } from './cadence-rounds'
import { CADENCE_NAME, chordsOf, planCadences } from './cadence-rounds'
import NameTheCadenceExercise from './NameTheCadenceExercise'
import { AFTER_REPLAY_MS, CHORD_MS, GAP_MS, playbackMs, RIGHT_MS, } from './use-cadence-controller'

// jsdom has no WebGL, so Merc is his still here whatever the gate says; the
// stub only spares the log the probe's "not implemented" notice.
vi.mock('@/lib/merc/gpu-gate', () => ({
  canRunLiveMerc: () => false,
  waitForLiveMerc: () => () => undefined,
}))

/** A repeatable stand-in for Math.random (mulberry32). */
function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The level a fresh profile starts on, which asks for three cadences. */
const LEVEL = 5

/** A seed whose run, at the starting level, opens the way a test needs. */
function seedWhere(wanted: (rounds: CadenceRound[]) => boolean): number {
  for (let seed = 1; seed < 500; seed++) {
    if (wanted(planCadences({ difficulty: LEVEL, random: seeded(seed) }))) {
      return seed
    }
  }
  throw new Error('no seed gives the run this test needs')
}

/** The drill, with the run it will draw once Start is pressed. */
function open(seed: number) {
  vi.spyOn(Math, 'random').mockImplementation(seeded(seed))
  const rounds = planCadences({ difficulty: LEVEL, random: seeded(seed) })
  const playChord = vi.fn(() => Promise.resolve())
  const stopTone = vi.fn()
  const audioEngine = { playChord, stopTone } as unknown as AudioEngine
  const view = render(() => (
    <NameTheCadenceExercise audioEngine={audioEngine} onBack={() => {}} />
  ))
  const say = () =>
    view.container.querySelector('.exercise-active-phase')?.textContent
  const numerals = () =>
    Array.from(
      view.getByTestId('cadence-chords').querySelectorAll('[data-role]'),
    ).map((tile) => tile.firstElementChild?.textContent)
  const start = () =>
    fireEvent.click(view.getByRole('button', { name: 'Start' }))
  const name = (label: string) =>
    fireEvent.click(view.getByRole('button', { name: label }))
  /** Let the round that is up play to the start of its last chord. */
  const toEnding = () => vi.advanceTimersByTime(2 * (CHORD_MS + GAP_MS))
  return { ...view, rounds, playChord, say, numerals, start, name, toEnding }
}

describe('Name the Cadence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    clearExerciseHistory()
  })

  afterEach(async () => {
    cleanup()
    vi.restoreAllMocks()
    // A finished run's save is in flight on the faked clock: run it out
    // before the clock is handed back, or the flush below never settles.
    await vi.runAllTimersAsync()
    vi.useRealTimers()
    await flushExerciseHistoryWrites()
    clearExerciseHistory()
    localStorage.clear()
  })

  it('opens on its brief, with a Start that carries no microphone', () => {
    const drill = open(1)
    expect(drill.container.querySelector('.idle-hint')?.textContent).toBe(
      '8 cadences · Perfect, Imperfect and Plagal',
    )
    const start = drill.getByRole('button', { name: 'Start' })
    expect(start.querySelector('svg')).toBeNull()
  })

  it('plays the round and asks only once the ending has sounded', () => {
    const drill = open(1)
    drill.start()

    expect(drill.say()).toBe('Listen.')
    expect(drill.playChord).toHaveBeenCalledTimes(1)
    // The key's own chord is named; the ending's two are not.
    expect(drill.numerals()).toEqual(['I', '?', '?'])
    const perfect = drill.getByRole('button', { name: 'Perfect' })
    expect(perfect.getAttribute('aria-disabled')).toBe('true')

    drill.toEnding()
    expect(drill.say()).toBe('How does it end?')
    expect(drill.playChord).toHaveBeenCalledTimes(3)
    expect(perfect.getAttribute('aria-disabled')).toBe('false')
    // Three names at this level, the interrupted cadence not yet among them.
    const names = Array.from(
      drill
        .getByRole('group', { name: 'Name the cadence' })
        .querySelectorAll('button'),
    ).map((b) => b.textContent)
    expect(names).toEqual(['Perfect', 'Imperfect', 'Plagal'])
  })

  it('says yes to the right name, shows the chords and moves on', () => {
    const drill = open(seedWhere((rounds) => rounds[0].type === 'perfect'))
    drill.start()
    drill.toEnding()
    drill.name('Perfect')

    expect(drill.say()).toBe('Yes, perfect: V to I, it comes home.')
    expect(drill.numerals()).toEqual(['I', 'V', 'I'])

    vi.advanceTimersByTime(RIGHT_MS)
    expect(drill.say()).toBe('Listen.')
    expect(drill.numerals()).toEqual(['I', '?', '?'])
  })

  it('after a miss, names the cadence, says its chords and plays it again', () => {
    const drill = open(seedWhere((rounds) => rounds[0].type === 'plagal'))
    const round = drill.rounds[0]
    drill.start()
    drill.toEnding()
    const struck = drill.playChord.mock.calls.length
    drill.name('Perfect')

    expect(drill.say()).toBe(
      `That was plagal: ${chordsOf(round)}, home by the softer road.`,
    )
    expect(drill.numerals()).toEqual(['I', 'IV', 'I'])
    expect(drill.getByRole('button', { name: 'Plagal' }).className).toMatch(
      /answerRight/,
    )
    expect(drill.getByRole('button', { name: 'Perfect' }).className).toMatch(
      /answerWrong/,
    )
    // The cadence is struck again from its first chord, under its name.
    expect(drill.playChord).toHaveBeenCalledTimes(struck + 1)

    vi.advanceTimersByTime(playbackMs(round) + AFTER_REPLAY_MS)
    expect(drill.say()).toBe('Listen.')
  })

  it('plays the round again on Hear it again', () => {
    const drill = open(1)
    drill.start()
    drill.toEnding()
    const struck = drill.playChord.mock.calls.length
    fireEvent.click(drill.getByRole('button', { name: 'Hear it again' }))
    expect(drill.playChord).toHaveBeenCalledTimes(struck + 1)
  })

  it('ends after eight cadences with the count named right, and files the run', () => {
    const drill = open(3)
    drill.start()
    for (const round of drill.rounds) {
      drill.toEnding()
      drill.name(CADENCE_NAME[round.type])
      vi.advanceTimersByTime(RIGHT_MS)
    }

    const card = drill.container.querySelector('.exercise-result-card')
    expect(card?.textContent).toContain('100%')
    expect(card?.textContent).toContain('Named right: 8 of 8')
    const filed = exerciseHistory().filter(
      (entry) => entry.type === EXERCISE_CADENCE,
    )
    expect(filed).toHaveLength(1)
    expect(filed[0].score).toBe(100)
  })
})
