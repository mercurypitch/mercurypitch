import { describe, expect, it } from 'vitest'
import { LEAP_LINES } from './merc-lines'
import { LEAP_SPOKEN } from './merc-spoken'

describe("Merc's recorded lines in Leap", () => {
  it('are the opening lines, each its own recording named for it', () => {
    const opening = [...LEAP_LINES.intro, ...LEAP_LINES.introMatch].map(
      (line) => line.id,
    )
    expect(Object.keys(LEAP_SPOKEN).sort()).toEqual(opening.sort())
    for (const [id, file] of Object.entries(LEAP_SPOKEN)) {
      expect(file, id).toMatch(new RegExp(`merc-says-${id}\\.mp3$`))
    }
  })
})
