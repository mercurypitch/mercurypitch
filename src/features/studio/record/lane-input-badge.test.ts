// Studio lane input badge — a lane on the Studio's input and its default shows no chip, a channel or a pair shows as its jacks, and an input of its own by its first word, with the whole of it said in full.
import { describe, expect, it } from 'vitest'
import { FOLLOW_STUDIO_INPUT } from '@/lib/studio/record/lane-inputs'
import { studioInputShortName, studioLaneInputBadge } from './lane-input-badge'

const scarlett = {
  deviceId: 'scarlett',
  label: 'Scarlett 2i2 USB',
  channel: 1,
  pair: false,
}

describe('studioLaneInputBadge', () => {
  it("shows nothing for a lane on the Studio's input and its default, as every lane looked before", () => {
    expect(studioLaneInputBadge(FOLLOW_STUDIO_INPUT, 'Desk mic')).toBeNull()
  })

  it('shows a channel as its jack, and says which input it is on', () => {
    expect(studioLaneInputBadge(scarlett, 'Desk mic')).toEqual({
      short: 'In 2',
      full: 'Scarlett 2i2 USB, Input 2',
    })
    expect(
      studioLaneInputBadge({ ...FOLLOW_STUDIO_INPUT, channel: 0 }, 'Desk mic'),
    ).toEqual({ short: 'In 1', full: "the Studio's input (Desk mic), Input 1" })
  })

  it('shows a pair as both its jacks', () => {
    expect(
      studioLaneInputBadge({ ...scarlett, channel: 2, pair: true }, 'Desk mic'),
    ).toEqual({ short: 'In 3+4', full: 'Scarlett 2i2 USB, Inputs 3 + 4' })
  })

  it('shows an input of its own by its first word, and its whole name in full', () => {
    expect(
      studioLaneInputBadge({ ...scarlett, channel: null }, 'Desk mic'),
    ).toEqual({ short: 'Scarlett', full: 'Scarlett 2i2 USB' })
  })

  it('shows a MIDI lane as MIDI, with its port in full', () => {
    expect(
      studioLaneInputBadge(
        { kind: 'midi', portId: 'port-7', label: 'Keystation 49' },
        'Desk mic',
      ),
    ).toEqual({ short: 'MIDI', full: 'Keystation 49 (MIDI)' })
  })
})

describe('studioInputShortName', () => {
  it('names a Windows microphone by the device in its brackets, not the word every one starts with', () => {
    expect(studioInputShortName('Microphone (Realtek(R) Audio)')).toBe(
      'Realtek',
    )
    expect(studioInputShortName('MacBook Pro Microphone')).toBe('MacBook')
    expect(studioInputShortName('  ')).toBe('')
  })
})
