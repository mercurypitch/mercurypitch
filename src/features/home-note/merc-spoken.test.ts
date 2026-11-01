import { describe, expect, it } from 'vitest'
import { HOME_LINES } from './merc-lines'
import { HOME_SPOKEN } from './merc-spoken'

describe("Merc's recorded lines in Home note", () => {
  it('are the lines said at rest, the opening and the result, each named for its line', () => {
    const atRest = [
      ...HOME_LINES.intro,
      ...HOME_LINES.introMatch,
      ...HOME_LINES.resultAll,
      ...HOME_LINES.resultMost,
      ...HOME_LINES.resultSome,
      ...HOME_LINES.resultNone,
      ...HOME_LINES.newBest,
      ...HOME_LINES.silentRun,
    ].map((line) => line.id)
    expect(Object.keys(HOME_SPOKEN).sort()).toEqual(atRest.sort())
    for (const [id, file] of Object.entries(HOME_SPOKEN)) {
      expect(file, id).toMatch(new RegExp(`merc-says-${id}\\.mp3$`))
    }
  })

  it('says no line of the run itself aloud', () => {
    const atRest = new Set(Object.keys(HOME_SPOKEN))
    const said = Object.entries(HOME_LINES)
      .filter(
        ([moment]) =>
          ![
            'intro',
            'introMatch',
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
