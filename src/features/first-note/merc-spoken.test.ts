import { describe, expect, it } from 'vitest'
import { FIRST_LINES } from './merc-lines'
import { FIRST_SPOKEN } from './merc-spoken'

describe("Merc's recorded lines in First note", () => {
  it('are the opening lines, each its own recording named for it', () => {
    const opening = [...FIRST_LINES.intro, ...FIRST_LINES.introLine].map(
      (line) => line.id,
    )
    expect(Object.keys(FIRST_SPOKEN).sort()).toEqual(opening.sort())
    for (const [id, file] of Object.entries(FIRST_SPOKEN)) {
      expect(file, id).toMatch(new RegExp(`merc-says-${id}\\.mp3$`))
    }
  })
})
