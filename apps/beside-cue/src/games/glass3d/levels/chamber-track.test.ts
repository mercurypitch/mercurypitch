import { beforeEach, describe, expect, it } from 'vitest'
import type { TrackState } from './chamber-track'
import { currentRoom, EMPTY_TRACK, isCleared, isFinished, isOpen, progressLabel, reachedIndex, readTrack, recordClear, restartTrack, roomAfter, roomIndex, walkGrade, writeTrack, } from './chamber-track'
import { CHAMBERS } from './chambers'

const FIRST = CHAMBERS[0]!.id
const SECOND = CHAMBERS[1]!.id
const LAST = CHAMBERS[CHAMBERS.length - 1]!.id

// jsdom here exposes a `localStorage` with no Storage methods, so the
// remembering has to be supplied. The module survives its absence on its
// own -- every read is wrapped -- which is the last test in this file.
const entries = new Map<string, string>()
beforeEach(() => {
  entries.clear()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => void entries.set(key, value),
      removeItem: (key: string) => void entries.delete(key),
    },
  })
})

describe('walking the path', () => {
  it('starts at the first room, with nothing behind it', () => {
    expect(reachedIndex(EMPTY_TRACK)).toBe(0)
    expect(currentRoom(EMPTY_TRACK).id).toBe(FIRST)
    expect(isFinished(EMPTY_TRACK)).toBe(false)
  })

  it('opens the next room when this one is finished', () => {
    expect(isOpen(EMPTY_TRACK, SECOND)).toBe(false)
    const after = recordClear(EMPTY_TRACK, FIRST, 80)
    expect(isOpen(after, SECOND)).toBe(true)
    expect(currentRoom(after).id).toBe(SECOND)
  })

  // The rule from score.ts, and the one this module must not reopen:
  // passing is a band, not a finish line.
  it('opens it on finishing, not on finishing WELL', () => {
    const scraped = recordClear(EMPTY_TRACK, FIRST, 3)
    expect(isOpen(scraped, SECOND)).toBe(true)
    expect(currentRoom(scraped).id).toBe(SECOND)
  })

  it('keeps a cleared room open behind you', () => {
    const after = recordClear(EMPTY_TRACK, FIRST, 80)
    expect(isOpen(after, FIRST)).toBe(true)
  })

  it('never opens a room two ahead', () => {
    const after = recordClear(EMPTY_TRACK, FIRST, 80)
    expect(isOpen(after, LAST)).toBe(CHAMBERS.length <= 2)
  })

  it('knows when the whole path is walked, and stays at the end', () => {
    let state: TrackState = EMPTY_TRACK
    for (const room of CHAMBERS) state = recordClear(state, room.id, 70)
    expect(isFinished(state)).toBe(true)
    expect(currentRoom(state).id).toBe(LAST)
  })

  // A save that reached room three without room two -- an edit, a
  // reordering, a version carried across -- is at room two, because that
  // is the first thing they have not been taught.
  it('sends a player back to the first room they have not finished', () => {
    const odd = recordClear(EMPTY_TRACK, LAST, 90)
    expect(currentRoom(odd).id).toBe(FIRST)
    expect(reachedIndex(odd)).toBe(0)
  })

  it('names the room after this one, and nothing after the last', () => {
    expect(roomAfter(FIRST)?.id).toBe(SECOND)
    expect(roomAfter(LAST)).toBeNull()
    expect(roomAfter('not-a-room')).toBeNull()
  })

  it('counts the walk for the card', () => {
    expect(progressLabel(EMPTY_TRACK)).toBe(`0 of ${CHAMBERS.length}`)
    const after = recordClear(EMPTY_TRACK, FIRST, 50)
    expect(progressLabel(after)).toBe(`1 of ${CHAMBERS.length}`)
  })
})

describe('the record kept beside it', () => {
  it('remembers the best run, not the last', () => {
    let state = recordClear(EMPTY_TRACK, FIRST, 88)
    state = recordClear(state, FIRST, 40)
    expect(state.best[FIRST]).toBe(88)
  })

  it('does not make the path longer by finishing a room twice', () => {
    let state = recordClear(EMPTY_TRACK, FIRST, 60)
    state = recordClear(state, FIRST, 65)
    expect(state.cleared).toEqual([FIRST])
    expect(reachedIndex(state)).toBe(1)
  })

  it('grades the whole walk as the mean of the bests', () => {
    expect(walkGrade(EMPTY_TRACK)).toBeNull()
    let state = recordClear(EMPTY_TRACK, FIRST, 80)
    state = recordClear(state, SECOND, 60)
    expect(walkGrade(state)).toBe(70)
  })

  it('keeps a grade inside the range a grade can be', () => {
    const state = recordClear(EMPTY_TRACK, FIRST, 9999)
    expect(state.best[FIRST]).toBe(100)
    expect(recordClear(EMPTY_TRACK, FIRST, -5).best[FIRST]).toBe(0)
  })

  it('ignores a room that is not on the path', () => {
    expect(recordClear(EMPTY_TRACK, 'chamber-99', 90)).toBe(EMPTY_TRACK)
  })

  // Starting again is about the walk, not about unlearning it.
  it('keeps the grades when the path is restarted', () => {
    const state = recordClear(EMPTY_TRACK, FIRST, 88)
    const again = restartTrack(state)
    expect(again.cleared).toEqual([])
    expect(again.best[FIRST]).toBe(88)
  })
})

describe('a stored track that has outlived the level list', () => {
  const store = (value: unknown): void => {
    window.localStorage.setItem(
      'beside-cue:games:chamber-track',
      JSON.stringify(value),
    )
  }

  it('survives a round trip', () => {
    const state = recordClear(EMPTY_TRACK, FIRST, 77)
    writeTrack(state)
    expect(readTrack()).toEqual(state)
  })

  it('drops a room that is not there any more', () => {
    store({ cleared: [FIRST, 'chamber-gone'], best: { 'chamber-gone': 90 } })
    const state = readTrack()
    expect(state.cleared).toEqual([FIRST])
    expect(state.best).toEqual({})
  })

  it('never reports the same room twice', () => {
    store({ cleared: [FIRST, FIRST], best: {} })
    expect(readTrack().cleared).toEqual([FIRST])
  })

  it('treats nonsense as an unwalked path rather than throwing', () => {
    store('a string')
    expect(readTrack()).toEqual(EMPTY_TRACK)
    window.localStorage.setItem('beside-cue:games:chamber-track', '{ not json')
    expect(readTrack()).toEqual(EMPTY_TRACK)
    store({ cleared: 'nope', best: { [FIRST]: 'high' } })
    expect(readTrack()).toEqual(EMPTY_TRACK)
  })

  it('is an unwalked path when storage is denied', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error('denied')
        },
        setItem: () => {
          throw new Error('denied')
        },
      },
    })
    expect(readTrack()).toEqual(EMPTY_TRACK)
    expect(() => {
      writeTrack(EMPTY_TRACK)
    }).not.toThrow()
  })
})

describe('the path itself', () => {
  it('places every room exactly once', () => {
    for (const [i, room] of CHAMBERS.entries()) {
      expect(roomIndex(room.id)).toBe(i)
    }
    expect(roomIndex('nowhere')).toBe(-1)
  })

  it('has nothing cleared in an empty track', () => {
    for (const room of CHAMBERS) {
      expect(isCleared(EMPTY_TRACK, room.id)).toBe(false)
    }
  })
})
