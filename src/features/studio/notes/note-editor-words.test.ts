// Studio note editor words tests — the roll says how many notes its clip plays, from which to which or on how many drums, over which of the song's bars; it says so for an empty clip and a one-bar clip; and the status line says the count and the bars in short.
import { describe, expect, it } from 'vitest'
import type { StudioNote } from '@/lib/studio/model/types'
import { studioBarAt, studioNoteStatusWords, studioRollWords, studioWindowBars, } from './note-editor-words'

/** The song's bar 1 two beats before the sequence's tick 0, 960 ticks a beat. */
const METER = { beatTicks: 960, originTick: -1920, beatsPerBar: 4 }
/** Ticks 1920 to 13440: song bars 2 to 4. */
const WINDOW = { startTick: 1920, endTick: 13_440 }

const note = (pitch: number, startTick: number): StudioNote => ({
  id: startTick + pitch,
  pitch,
  startTick,
  lengthTicks: 240,
  velocity: 0.8,
})

describe('the bars', () => {
  it('counts a tick’s bar from the song’s bar 1', () => {
    expect(studioBarAt(METER, -1920)).toBe(1)
    expect(studioBarAt(METER, 1919)).toBe(1)
    expect(studioBarAt(METER, 1920)).toBe(2)
  })

  it('spans the window from its first tick to its last', () => {
    expect(studioWindowBars(METER, WINDOW)).toEqual({ first: 2, last: 4 })
  })
})

describe('studioRollWords', () => {
  it('says how many notes the clip plays, from which to which, over which bars', () => {
    const words = studioRollWords({
      notes: [note(48, 2000), note(79, 3000), note(61, 5000), note(90, 100)],
      window: WINDOW,
      meter: METER,
      sound: 'piano',
    })

    expect(words).toBe('3 notes from C3 to G5, bars 2 to 4')
  })

  it('says how many drums a kit’s hits are on', () => {
    const words = studioRollWords({
      notes: [note(36, 2000), note(38, 2500), note(36, 3000)],
      window: WINDOW,
      meter: METER,
      sound: 'drums',
    })

    expect(words).toBe('3 hits on 2 drums, bars 2 to 4')
  })

  it('says when the clip plays no note, and names a single bar', () => {
    const words = studioRollWords({
      notes: [],
      window: { startTick: 1920, endTick: 5760 },
      meter: METER,
      sound: 'piano',
    })

    expect(words).toBe('No notes, bar 2')
  })
})

describe('studioNoteStatusWords', () => {
  it('says the count and the bars in short', () => {
    expect(
      studioNoteStatusWords({
        notes: [note(60, 2000)],
        window: WINDOW,
        meter: METER,
        sound: 'piano',
      }),
    ).toBe('1 note · Bars 2–4')
  })
})
