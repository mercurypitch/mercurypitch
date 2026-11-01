import { describe, expect, it } from 'vitest'
import { HOME_LINES } from './merc-lines'
import { HOME_SPOKEN } from './merc-spoken'

describe("Merc's recorded lines in Home note", () => {
  it('are the opening lines, each its own recording named for it', () => {
    const opening = [...HOME_LINES.intro, ...HOME_LINES.introMatch].map(
      (line) => line.id,
    )
    expect(Object.keys(HOME_SPOKEN).sort()).toEqual(opening.sort())
    for (const [id, file] of Object.entries(HOME_SPOKEN)) {
      expect(file, id).toMatch(new RegExp(`merc-says-${id}\\.mp3$`))
    }
  })
})
