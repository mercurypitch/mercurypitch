import { describe, expect, it } from 'vitest'
import { ECHO_LINES } from './merc-lines'
import { ECHO_SPOKEN } from './merc-spoken'

describe("Merc's recorded lines in Echo", () => {
  it('are the opening lines, each with a recording of its words', () => {
    const opening = [
      ...ECHO_LINES.intro,
      ...ECHO_LINES.routine,
      ...ECHO_LINES.introAny,
    ]
    expect(Object.keys(ECHO_SPOKEN).sort()).toEqual(
      opening.map((line) => line.id).sort(),
    )
    for (const line of opening) {
      // A line shares a take only with a line of the same words.
      const twin = opening.find(
        (other) =>
          other.id !== line.id &&
          ECHO_SPOKEN[other.id] === ECHO_SPOKEN[line.id],
      )
      if (twin !== undefined) expect(twin.text, line.id).toBe(line.text)
    }
    expect(ECHO_SPOKEN['routine-first']).toBe(ECHO_SPOKEN['intro-first'])
  })
})
