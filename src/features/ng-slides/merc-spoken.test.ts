import { describe, expect, it } from 'vitest'
import { NG_LINES } from './merc-lines'
import { NG_SPOKEN } from './merc-spoken'

describe("Merc's recorded lines in Ng slides", () => {
  const opening = [...NG_LINES.intro, ...NG_LINES.routine, ...NG_LINES.introAny]

  it('are the opening lines, each with a recording of its own', () => {
    expect(Object.keys(NG_SPOKEN).sort()).toEqual(
      opening.map((line) => line.id).sort(),
    )
    expect(new Set(Object.values(NG_SPOKEN)).size).toBe(opening.length)
  })

  it('names no note in a line it says: the bridge names them', () => {
    for (const line of opening) expect(line.text, line.id).not.toContain('{')
  })
})
