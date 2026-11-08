// Studio MIDI choices tests — the picker's MIDI rows are each port listed and then the lane's own, "(not connected)" once MIDI is allowed and it is not listed; the lane's row is found by id, then name; and MIDI's state reads in words beside the picker, with a press offered until it is allowed.
import { describe, expect, it } from 'vitest'
import { chosenMidiChoice, studioMidiAccessWords, studioMidiAskable, studioMidiChoices, } from './studio-midi-choices'

const keys = { id: 'keys', name: 'Keystation 49', manufacturer: null }
const kept = { kind: 'midi' as const, portId: 'old-id', label: 'MPD218' }

describe('studioMidiChoices', () => {
  it("lists each port, then the lane's own when it is not listed", () => {
    // Arrange, Act
    const allowed = studioMidiChoices([keys], kept, true)
    const beforeAsking = studioMidiChoices([], kept, false)

    // Assert
    expect(allowed.map((row) => [row.value, row.label])).toEqual([
      ['midi:keys', 'Keystation 49'],
      ['midi:old-id', 'MPD218 (not connected)'],
    ])
    expect(beforeAsking.map((row) => row.label)).toEqual(['MPD218'])
  })

  it("finds the lane's row by its port's id, then by its name", () => {
    // Arrange
    const renamed = { id: 'new-id', name: 'MPD218', manufacturer: null }
    const rows = studioMidiChoices([keys, renamed], kept, true)

    // Act, Assert
    expect(chosenMidiChoice(rows, kept)?.portId).toBe('new-id')
    expect(chosenMidiChoice(rows, null)).toBeNull()
  })
})

describe("MIDI's state beside a picker", () => {
  it('reads in words, and offers the press until MIDI is allowed', () => {
    // Arrange, Act, Assert
    expect(studioMidiAccessWords('idle', 0)).toBeNull()
    expect(studioMidiAccessWords('granted', 0)).toBe(
      'No MIDI keyboard or pad is connected.',
    )
    expect(studioMidiAccessWords('granted', 2)).toBeNull()
    expect(studioMidiAccessWords('denied', 0)).toMatch(/site settings/)
    expect(studioMidiAccessWords('failed', 0)).toMatch(/couldn't open MIDI/)
    expect(studioMidiAccessWords('unsupported', 0)).toMatch(
      /can't use MIDI keyboards or pads/,
    )
    expect(
      (['idle', 'denied', 'failed'] as const).every(studioMidiAskable),
    ).toBe(true)
    expect(
      (['requesting', 'granted', 'unsupported'] as const).some(
        studioMidiAskable,
      ),
    ).toBe(false)
  })
})
