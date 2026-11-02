import { describe, expect, it } from 'vitest'
import { LIP_LINES } from './merc-lines'
import { LIP_SPOKEN } from './merc-spoken'

describe("Merc's recorded lines in Lip roll", () => {
  const opening = [
    ...LIP_LINES.intro,
    ...LIP_LINES.routine,
    ...LIP_LINES.introAny,
  ]

  it('are the opening lines, each with a recording of its own', () => {
    expect(Object.keys(LIP_SPOKEN).sort()).toEqual(
      opening.map((line) => line.id).sort(),
    )
    expect(new Set(Object.values(LIP_SPOKEN)).size).toBe(opening.length)
  })

  it('names no note in a line it says: the bay names the tops', () => {
    for (const line of opening) expect(line.text, line.id).not.toContain('{')
  })
})
