import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseRoomNames } from './room-names-source.mjs'

const wrap = (body) =>
  `export const ROOM_NAMES: Record<NamedRoomId, string> = {\n${body}\n}\n`

describe('the room names the probe measures', () => {
  it('reads every one of the shipped module', () => {
    const source = readFileSync(
      new URL('../../../src/features/rooms/room-names.ts', import.meta.url),
      'utf8',
    )
    const names = parseRoomNames(source)
    const keys = /ROOM_NAMES[^=]*=\s*\{([^}]*)\}/u
      .exec(source)[1]
      .split('\n')
      .filter((line) => line.includes(':'))
    expect(Object.keys(names)).toHaveLength(keys.length)
    expect(names.sing).toBeTruthy()
  })

  it('reads a name prettier put in double quotes', () => {
    expect(
      parseRoomNames(wrap(`  sing: 'Studio',\n  jam: "Maff's Loft",`)),
    ).toEqual({ sing: 'Studio', jam: "Maff's Loft" })
  })

  it('reads a name with a trailing comment', () => {
    expect(parseRoomNames(wrap(`  sing: 'Studio', // the stage`))).toEqual({
      sing: 'Studio',
    })
  })

  it('fails closed on a key it cannot read', () => {
    expect(() =>
      parseRoomNames(wrap(`  sing: 'Studio',\n  jam: \`Loft\`,`)),
    ).toThrow(/could not read jam/u)
  })
})
