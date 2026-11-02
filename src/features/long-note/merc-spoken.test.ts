import { describe, expect, it } from 'vitest'
import { MERC_LINES } from './merc-lines'
import { LONG_NOTE_SPOKEN } from './merc-spoken'

describe("Merc's recorded lines in Long note", () => {
  const opening = [
    ...MERC_LINES.intro,
    ...MERC_LINES.routine,
    ...MERC_LINES.introAny,
  ]

  it('are the opening lines, each with a recording of its words', () => {
    expect(Object.keys(LONG_NOTE_SPOKEN).sort()).toEqual(
      opening.map((line) => line.id).sort(),
    )
    for (const line of opening) {
      // A line shares a take only with a line of the same words.
      const twin = opening.find(
        (other) =>
          other.id !== line.id &&
          LONG_NOTE_SPOKEN[other.id] === LONG_NOTE_SPOKEN[line.id],
      )
      if (twin !== undefined) expect(twin.text, line.id).toBe(line.text)
    }
    expect(LONG_NOTE_SPOKEN['routine-breathe']).toBe(
      LONG_NOTE_SPOKEN['intro-breathe'],
    )
  })

  it('names no note in a line it says: the stage shows the note', () => {
    for (const line of opening) expect(line.text, line.id).not.toContain('{')
  })
})
