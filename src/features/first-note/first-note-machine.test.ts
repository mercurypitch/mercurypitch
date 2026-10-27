import { describe, expect, it } from 'vitest'
import type { EntryHeard, FirstNoteEvent, FirstNoteState, RoundOutcome, } from './first-note-machine'
import { firstNoteReducer, INITIAL_FIRST_NOTE_STATE, isRunPhase, liveRound, } from './first-note-machine'
import type { FirstNoteRound } from './first-note-songs'
import { FIRST_NOTE_SONGS, planRun } from './first-note-songs'

const ROUNDS: readonly FirstNoteRound[] = planRun(FIRST_NOTE_SONGS, () => 0.5)

function play(...events: FirstNoteEvent[]): FirstNoteState {
  return events.reduce(firstNoteReducer, INITIAL_FIRST_NOTE_STATE)
}

const ON: EntryHeard = { cents: 12, onNote: true }
const LOW: EntryHeard = { cents: -180, onNote: false }

function outcome(index: number, landed: boolean): RoundOutcome {
  return {
    round: ROUNDS[index],
    entry: landed ? ON : null,
    landed,
    seconds: landed ? 1.1 : null,
    voiced: landed,
    heardAgain: false,
  }
}

describe("First note's states", () => {
  it('runs a round: lead-in, turn, entry, landing', () => {
    const state = play(
      { type: 'start', rounds: ROUNDS },
      { type: 'intro', index: 0 },
      { type: 'turn' },
      { type: 'entry', entry: ON },
      { type: 'outcome', outcome: outcome(0, true) },
    )
    expect(state.phase).toBe('landed')
    expect(state.entry).toEqual(ON)
    expect(state.outcomes).toHaveLength(1)
  })

  it('hears the entry once a round: the first try is the one that counts', () => {
    const state = play(
      { type: 'start', rounds: ROUNDS },
      { type: 'intro', index: 0 },
      { type: 'turn' },
      { type: 'entry', entry: LOW },
      { type: 'entry', entry: ON },
    )
    expect(state.entry).toEqual(LOW)
  })

  it('hears no entry outside the turn', () => {
    const state = play(
      { type: 'start', rounds: ROUNDS },
      { type: 'intro', index: 0 },
      { type: 'entry', entry: ON },
    )
    expect(state.phase).toBe('band')
    expect(state.entry).toBeNull()
  })

  it('keeps the entry over "Hear the band again", and counts the replay', () => {
    const state = play(
      { type: 'start', rounds: ROUNDS },
      { type: 'intro', index: 0 },
      { type: 'turn' },
      { type: 'entry', entry: LOW },
      { type: 'hearAgain' },
    )
    expect(state.phase).toBe('band')
    expect(state.replays).toBe(1)
    expect(state.entry).toEqual(LOW)
  })

  it('starts each round with no entry', () => {
    const state = play(
      { type: 'start', rounds: ROUNDS },
      { type: 'intro', index: 0 },
      { type: 'turn' },
      { type: 'entry', entry: ON },
      { type: 'outcome', outcome: outcome(0, true) },
      { type: 'intro', index: 1 },
    )
    expect(state.current).toBe(1)
    expect(state.entry).toBeNull()
    expect(liveRound(state)).toBe(ROUNDS[1])
  })

  it('takes one outcome per turn, and finishes only after one', () => {
    const missed = play(
      { type: 'start', rounds: ROUNDS },
      { type: 'intro', index: 0 },
      { type: 'turn' },
      { type: 'outcome', outcome: outcome(0, false) },
      { type: 'outcome', outcome: outcome(0, true) },
    )
    expect(missed.phase).toBe('missed')
    expect(missed.outcomes).toHaveLength(1)
    expect(firstNoteReducer(missed, { type: 'finish' }).phase).toBe('result')
  })

  it('drops a stopped run back to rest, keeping nothing', () => {
    const state = play(
      { type: 'start', rounds: ROUNDS },
      { type: 'intro', index: 0 },
      { type: 'turn' },
      { type: 'stop' },
    )
    expect(state.phase).toBe('intro')
    expect(state.outcomes).toEqual([])
    expect(isRunPhase(state.phase)).toBe(false)
  })

  it('takes a refused mic only for the start it answers', () => {
    const started = play({ type: 'start', rounds: ROUNDS })
    expect(
      firstNoteReducer(started, {
        type: 'blocked',
        run: started.run - 1,
        block: 'denied',
      }).phase,
    ).toBe('starting')
    expect(
      firstNoteReducer(started, {
        type: 'blocked',
        run: started.run,
        block: 'denied',
      }).phase,
    ).toBe('blocked')
  })
})
