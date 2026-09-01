// ============================================================
// Drum kit SFZ parser tests — bounded syntax and loud semantic rejection
// ============================================================

import { describe, expect, it } from 'vitest'
import { parseDrumKitSfz } from './drum-kit-sfz-parser'

describe('parseDrumKitSfz', () => {
  it('keeps ordered sections, duplicate overrides, and sample paths with spaces', () => {
    const source = `
      // inherited bounds
      <global> lovel=1 hivel=127
      <group> group=9 volume=-2
      <region> sample="Samples/Kick One.wav" key=36 volume=-1
      <region> sample=Samples/Kick Two.wav key=36
    `

    const sections = parseDrumKitSfz(source)

    expect(sections.map((section) => section.kind)).toEqual([
      'global',
      'group',
      'region',
      'region',
    ])
    expect(sections[2].opcodes.map(({ name, value }) => [name, value])).toEqual(
      [
        ['sample', '"Samples/Kick One.wav"'],
        ['key', '36'],
        ['volume', '-1'],
      ],
    )
    expect(sections[3].opcodes[0]).toMatchObject({
      name: 'sample',
      value: 'Samples/Kick Two.wav',
    })
  })

  it('preserves comment markers inside quotes and strips both comment forms', () => {
    const source = `
      /* source note */
      <region> sample="Samples/A // B.wav" key=36 // trailing note
    `

    const sections = parseDrumKitSfz(source)

    expect(sections[0].opcodes[0].value).toBe('"Samples/A // B.wav"')
    expect(sections[0].opcodes).toHaveLength(2)
  })

  it('rejects unsupported musical opcodes at their exact source line', () => {
    const source = `
      <region>
      sample=kick.wav key=36
      off_mode=fast
    `

    expect(() => parseDrumKitSfz(source)).toThrow(
      'Unsupported SFZ opcode "off_mode" at line 4',
    )
  })

  it('rejects unsupported sections instead of treating them as metadata', () => {
    expect(() => parseDrumKitSfz('<control> default_path=Samples/')).toThrow(
      'Unsupported SFZ section <control> at line 1',
    )
  })

  it('rejects malformed and unbounded inputs before normalization', () => {
    expect(() => parseDrumKitSfz('sample=kick.wav')).toThrow(
      'SFZ source has no sections',
    )
    expect(() => parseDrumKitSfz('<region> sample=')).toThrow(
      'Empty SFZ opcode "sample"',
    )
    expect(() => parseDrumKitSfz('<region> /* never closes')).toThrow(
      'Unterminated SFZ block comment',
    )
    expect(() => parseDrumKitSfz(`\0<region> sample=kick.wav`)).toThrow(
      'NUL byte',
    )
  })
})
