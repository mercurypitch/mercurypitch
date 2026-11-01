import { describe, expect, it } from 'vitest'
import { FIRST_LINES } from './merc-lines'
import { FIRST_SPOKEN } from './merc-spoken'

describe("Merc's recorded lines in First note", () => {
  it('are the lines said at rest, the opening and the result, each named for its line', () => {
    const atRest = [
      ...FIRST_LINES.intro,
      ...FIRST_LINES.introLine,
      ...FIRST_LINES.resultAll,
      ...FIRST_LINES.resultMost,
      ...FIRST_LINES.resultSome,
      ...FIRST_LINES.resultNone,
      ...FIRST_LINES.newBest,
      ...FIRST_LINES.silentRun,
    ].map((line) => line.id)
    expect(Object.keys(FIRST_SPOKEN).sort()).toEqual(atRest.sort())
    for (const [id, file] of Object.entries(FIRST_SPOKEN)) {
      expect(file, id).toMatch(new RegExp(`merc-says-${id}\\.mp3$`))
    }
  })

  it('says no line of the run itself aloud', () => {
    const atRest = new Set(Object.keys(FIRST_SPOKEN))
    const said = Object.entries(FIRST_LINES)
      .filter(
        ([moment]) =>
          ![
            'intro',
            'introLine',
            'resultAll',
            'resultMost',
            'resultSome',
            'resultNone',
            'newBest',
            'silentRun',
          ].includes(moment),
      )
      .flatMap(([, lines]) => lines.map((line) => line.id))
      .filter((id) => atRest.has(id))
    expect(said).toEqual([])
  })
})
