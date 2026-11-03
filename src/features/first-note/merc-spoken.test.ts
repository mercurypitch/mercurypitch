import { describe, expect, it } from 'vitest'
import { FIRST_LINES } from './merc-lines'
import { FIRST_SPOKEN } from './merc-spoken'

describe("Merc's recorded lines in First note", () => {
  it("are the lines said at rest, the opening, the Warm-up's cue and the result, each with a recording of its words", () => {
    const atRest = [
      ...FIRST_LINES.intro,
      ...FIRST_LINES.introLine,
      ...FIRST_LINES.routine,
      ...FIRST_LINES.resultAll,
      ...FIRST_LINES.resultMost,
      ...FIRST_LINES.resultSome,
      ...FIRST_LINES.resultNone,
      ...FIRST_LINES.newBest,
      ...FIRST_LINES.silentRun,
    ]
    expect(Object.keys(FIRST_SPOKEN).sort()).toEqual(
      atRest.map((line) => line.id).sort(),
    )
    for (const line of atRest) {
      const file = FIRST_SPOKEN[line.id]
      if (new RegExp(`merc-says-${line.id}\\.mp3$`).test(file)) continue
      // A line with no take of its own shares one with a line of the same
      // words: the Warm-up's cue is the first opening line, said as it is.
      const twin = atRest.find(
        (other) => other.id !== line.id && FIRST_SPOKEN[other.id] === file,
      )
      expect(twin?.text, line.id).toBe(line.text)
    }
    expect(FIRST_SPOKEN['routine-stop']).toBe(FIRST_SPOKEN['intro-stop'])
  })

  it('says no line of the run itself aloud', () => {
    const atRest = new Set(Object.keys(FIRST_SPOKEN))
    const said = Object.entries(FIRST_LINES)
      .filter(
        ([moment]) =>
          ![
            'intro',
            'introLine',
            'routine',
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
