import { describe, expect, it } from 'vitest'
import type { HomeNoteEvent, HomeNoteState, RoundOutcome, } from './home-note-machine'
import { homeNoteReducer, INITIAL_HOME_NOTE_STATE, isRunPhase, liveRound, } from './home-note-machine'
import type { HomeRound } from './home-note-round'

const ROUNDS: HomeRound[] = [
  { index: 0, home: 60 },
  { index: 1, home: 62 },
]

function run(...events: HomeNoteEvent[]): HomeNoteState {
  return events.reduce(homeNoteReducer, INITIAL_HOME_NOTE_STATE)
}

function outcome(round: HomeRound, landed: boolean): RoundOutcome {
  return {
    round,
    landed,
    cents: landed ? 8 : null,
    seconds: landed ? 1.4 : null,
    voiced: true,
    heardAgain: false,
  }
}

describe("Home note's room states", () => {
  it('starts a run, numbering it, and plays the first intro', () => {
    const started = run({ type: 'start', rounds: ROUNDS })
    expect(started.phase).toBe('starting')
    expect(started.run).toBe(1)
    const band = homeNoteReducer(started, { type: 'intro', index: 0 })
    expect(band.phase).toBe('band')
    expect(liveRound(band)).toEqual(ROUNDS[0])
  })

  it("opens the singer's turn only after the intro", () => {
    expect(run({ type: 'turn' }).phase).toBe('intro')
    const turn = run(
      { type: 'start', rounds: ROUNDS },
      { type: 'intro', index: 0 },
      { type: 'turn' },
    )
    expect(turn.phase).toBe('sing')
  })

  it('lands or misses a round, and goes on to the next key', () => {
    const landed = run(
      { type: 'start', rounds: ROUNDS },
      { type: 'intro', index: 0 },
      { type: 'turn' },
      { type: 'outcome', outcome: outcome(ROUNDS[0], true) },
    )
    expect(landed.phase).toBe('landed')
    const next = homeNoteReducer(landed, { type: 'intro', index: 1 })
    expect(next.phase).toBe('band')
    expect(next.current).toBe(1)
    const missed = run(
      { type: 'start', rounds: ROUNDS },
      { type: 'intro', index: 0 },
      { type: 'turn' },
      { type: 'outcome', outcome: outcome(ROUNDS[0], false) },
    )
    expect(missed.phase).toBe('missed')
    expect(missed.outcomes).toHaveLength(1)
  })

  it('takes an outcome only in the turn: never twice for one round', () => {
    const landed = run(
      { type: 'start', rounds: ROUNDS },
      { type: 'intro', index: 0 },
      { type: 'turn' },
      { type: 'outcome', outcome: outcome(ROUNDS[0], true) },
    )
    const again = homeNoteReducer(landed, {
      type: 'outcome',
      outcome: outcome(ROUNDS[0], false),
    })
    expect(again).toBe(landed)
  })

  it('plays the intro again from the turn, counting it', () => {
    const replayed = run(
      { type: 'start', rounds: ROUNDS },
      { type: 'intro', index: 0 },
      { type: 'turn' },
      { type: 'hearAgain' },
    )
    expect(replayed.phase).toBe('band')
    expect(replayed.replays).toBe(1)
    // A new round starts its count again.
    const next = run(
      { type: 'start', rounds: ROUNDS },
      { type: 'intro', index: 0 },
      { type: 'turn' },
      { type: 'hearAgain' },
      { type: 'turn' },
      { type: 'outcome', outcome: outcome(ROUNDS[0], true) },
      { type: 'intro', index: 1 },
    )
    expect(next.replays).toBe(0)
  })

  it('finishes only from a resolve, and never past the last round', () => {
    expect(
      run({ type: 'start', rounds: ROUNDS }, { type: 'finish' }).phase,
    ).toBe('starting')
    const last = run(
      { type: 'start', rounds: ROUNDS },
      { type: 'intro', index: 1 },
      { type: 'turn' },
      { type: 'outcome', outcome: outcome(ROUNDS[1], true) },
    )
    expect(homeNoteReducer(last, { type: 'intro', index: 2 })).toBe(last)
    expect(homeNoteReducer(last, { type: 'finish' }).phase).toBe('result')
  })

  it('blocks only the start the mic answered for', () => {
    const first = run({ type: 'start', rounds: ROUNDS })
    const second = homeNoteReducer(homeNoteReducer(first, { type: 'stop' }), {
      type: 'start',
      rounds: ROUNDS,
    })
    expect(second.run).toBe(2)
    // The first start's late refusal is dropped.
    expect(
      homeNoteReducer(second, { type: 'blocked', run: 1, block: 'denied' }),
    ).toBe(second)
    const blocked = homeNoteReducer(second, {
      type: 'blocked',
      run: 2,
      block: 'denied',
    })
    expect(blocked.phase).toBe('blocked')
    expect(blocked.block).toBe('denied')
  })

  it('drops a stopped run whole, keeping only its start count', () => {
    const stopped = run(
      { type: 'start', rounds: ROUNDS },
      { type: 'intro', index: 0 },
      { type: 'turn' },
      { type: 'outcome', outcome: outcome(ROUNDS[0], true) },
      { type: 'stop' },
    )
    expect(stopped.phase).toBe('intro')
    expect(stopped.outcomes).toEqual([])
    expect(stopped.run).toBe(1)
    expect(isRunPhase(stopped.phase)).toBe(false)
  })
})
