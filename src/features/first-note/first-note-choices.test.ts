// ============================================================
// First note's choices: the songs, and the words, kept on the device
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import { FIRST_NOTE_SOURCE_KEY, FIRST_NOTE_WORDS_KEY, firstNoteShowsWords, firstNoteSource, resetFirstNoteChoicesForTests, setFirstNoteShowsWords, setFirstNoteSource, sourceHasOwnSongs, } from './first-note-choices'

afterEach(() => {
  resetFirstNoteChoicesForTests()
})

describe("First note's choices", () => {
  it('start with the examples, and the words off: the ear first', () => {
    expect(firstNoteSource()).toBe('examples')
    expect(sourceHasOwnSongs()).toBe(false)
    expect(firstNoteShowsWords()).toBe(false)
  })

  it('are kept on this device, out of the settings sync', () => {
    setFirstNoteSource('mix')
    setFirstNoteShowsWords(true)
    expect(localStorage.getItem(FIRST_NOTE_SOURCE_KEY)).toBe('mix')
    expect(localStorage.getItem(FIRST_NOTE_WORDS_KEY)).toBe('true')
    // The `mp_` prefix is what keeps a key out of the settings sync.
    expect(FIRST_NOTE_SOURCE_KEY.startsWith('mp_')).toBe(true)
    expect(FIRST_NOTE_WORDS_KEY.startsWith('mp_')).toBe(true)
    expect(sourceHasOwnSongs()).toBe(true)
  })

  it('come back as they were left, at the next launch', () => {
    localStorage.setItem(FIRST_NOTE_SOURCE_KEY, 'yours')
    localStorage.setItem(FIRST_NOTE_WORDS_KEY, 'true')
    expect(firstNoteSource()).toBe('yours')
    expect(firstNoteShowsWords()).toBe(true)
  })

  it('ignore a value they did not write', () => {
    localStorage.setItem(FIRST_NOTE_SOURCE_KEY, 'everything')
    localStorage.setItem(FIRST_NOTE_WORDS_KEY, '"yes"')
    expect(firstNoteSource()).toBe('examples')
    expect(firstNoteShowsWords()).toBe(false)
  })
})
