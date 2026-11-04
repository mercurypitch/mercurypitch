import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCoverLabels, parseRoomNames } from './room-names-source.mjs'

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

describe('the Sing covers the probe measures', () => {
  const entry = (id, label) =>
    `  {\n    id: '${id}',\n    surface: 'sing',\n    label: ${label},\n    edition: 'core',\n  },\n`

  it('reads every one of the shipped catalogue', () => {
    const source = readFileSync(
      new URL(
        '../../../src/lib/backgrounds/background-catalog.ts',
        import.meta.url,
      ),
      'utf8',
    )
    const labels = parseCoverLabels(source, 'sing')
    expect(Object.keys(labels)).toHaveLength(
      source.match(/\bsurface:\s*'sing'/gu).length,
    )
    expect(labels['sing-retro-analog-studio']).toBe('Retro Analog Studio')
    expect(labels['sing-choir-room']).toBe('Choir Room')
  })

  it('reads a label prettier put in double quotes', () => {
    expect(
      parseCoverLabels(
        entry('sing-a', "'Attic'") + entry('sing-b', `"Maff's Room"`),
        'sing',
      ),
    ).toEqual({ 'sing-a': 'Attic', 'sing-b': "Maff's Room" })
  })

  it('fails closed on a label it cannot read', () => {
    expect(() =>
      parseCoverLabels(
        entry('sing-a', "'Attic'") + entry('sing-b', '`Room`'),
        'sing',
      ),
    ).toThrow(/2 entries, could read the label of 1/u)
  })
})
