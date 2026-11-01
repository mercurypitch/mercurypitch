import { describe, expect, it } from 'vitest'
import { LEAP_LINES } from './merc-lines'
import { LEAP_SPOKEN } from './merc-spoken'

describe("Merc's recorded lines in Leap", () => {
  it('are the lines said at rest, the opening and the result, each named for its line', () => {
    const atRest = [
      ...LEAP_LINES.intro,
      ...LEAP_LINES.introMatch,
      ...LEAP_LINES.resultAll,
      ...LEAP_LINES.resultMost,
      ...LEAP_LINES.resultSome,
      ...LEAP_LINES.resultNone,
      ...LEAP_LINES.newBest,
      ...LEAP_LINES.silentRun,
    ].map((line) => line.id)
    expect(Object.keys(LEAP_SPOKEN).sort()).toEqual(atRest.sort())
    for (const [id, file] of Object.entries(LEAP_SPOKEN)) {
      expect(file, id).toMatch(new RegExp(`merc-says-${id}\\.mp3$`))
    }
  })

  it('says no line of the run itself aloud', () => {
    const atRest = new Set(Object.keys(LEAP_SPOKEN))
    const said = Object.entries(LEAP_LINES)
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
