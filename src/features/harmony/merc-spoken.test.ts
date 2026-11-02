import { describe, expect, it } from 'vitest'
import { HARMONY_LINES_TABLE } from './merc-lines'
import { HARMONY_SPOKEN } from './merc-spoken'

/** The moments Merc speaks at rest: his opening lines and the result's. */
const AT_REST = [
  'intro',
  'introBoth',
  'introTogether',
  'introBothTogether',
  'resultAll',
  'resultMost',
  'resultSome',
  'resultNone',
  'newBest',
  'silentRun',
] as const

describe("Merc's recorded lines in Harmony", () => {
  it('are the lines said at rest, the opening and the result, each named for its line', () => {
    const atRest = AT_REST.flatMap((moment) =>
      HARMONY_LINES_TABLE[moment].map((line) => line.id),
    )
    expect(Object.keys(HARMONY_SPOKEN).sort()).toEqual(atRest.sort())
    for (const [id, file] of Object.entries(HARMONY_SPOKEN)) {
      expect(file, id).toMatch(new RegExp(`merc-says-${id}\\.mp3$`))
    }
  })

  it('says no line of the run itself aloud: his calls and pairs name notes', () => {
    const atRest = new Set(Object.keys(HARMONY_SPOKEN))
    const said = Object.entries(HARMONY_LINES_TABLE)
      .filter(([moment]) => !(AT_REST as readonly string[]).includes(moment))
      .flatMap(([, lines]) => lines.map((line) => line.id))
      .filter((id) => atRest.has(id))
    expect(said).toEqual([])
  })
})
