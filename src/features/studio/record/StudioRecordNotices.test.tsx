// Studio record notices tests — the armed card says what records of an input with more than one channel, one input or a pair mixed, or that the lane is ready; which input it records from when that is not the one asked for; and an input or pair the input does not have, with the default that records instead.
import { describe, expect, it } from 'vitest'
import type { StudioArmedInput, StudioArmedRecords, } from './studio-lane-input-state'
import { armedWords } from './StudioRecordNotices'

const nothing: StudioArmedInput = {
  laneMissing: null,
  defaultInstead: null,
  records: null,
}

const words = (input: Partial<StudioArmedInput>) =>
  armedWords({ armedInput: () => ({ ...nothing, ...input }) }, 'Guitar')

const records = (patch: Partial<StudioArmedRecords>): StudioArmedRecords => ({
  name: 'Scarlett 2i2 USB',
  channels: 2,
  pick: { channel: 0, pair: true },
  missing: null,
  ...patch,
})

describe('the armed card', () => {
  it('says the lane is ready, with nothing to choose on a one-channel input', () => {
    expect(words({})).toBe('Armed on Guitar. Press Record to start.')
    expect(
      words({
        records: records({ channels: 1, pick: { channel: 0, pair: false } }),
      }),
    ).toBe('Armed on Guitar. Press Record to start.')
  })

  it('says what records of a wider input: one input, or a pair mixed', () => {
    expect(
      words({ records: records({ pick: { channel: 1, pair: false } }) }),
    ).toBe(
      'Armed on Guitar with Input 2 of Scarlett 2i2 USB. Press Record to start.',
    )
    expect(words({ records: records({}) })).toBe(
      'Armed on Guitar with Inputs 1 + 2 of Scarlett 2i2 USB, mixed. Press Record to start.',
    )
    expect(words({ records: records({ name: '' }) })).toBe(
      'Armed on Guitar with Inputs 1 + 2, mixed. Press Record to start.',
    )
  })

  it("says the default records when the Studio's input was gone, as it always has", () => {
    expect(words({ defaultInstead: 'Desk mic' })).toBe(
      'Armed on Guitar with the default input: Desk mic is not connected.',
    )
  })

  it("says the Studio's input records when the lane's own is not connected", () => {
    expect(words({ laneMissing: 'Scarlett 2i2 USB' })).toBe(
      "Armed on Guitar with the Studio's input: Scarlett 2i2 USB is not connected.",
    )
  })

  it("names both when the lane's input and the Studio's are gone", () => {
    expect(
      words({ laneMissing: 'Scarlett 2i2 USB', defaultInstead: 'Desk mic' }),
    ).toBe(
      'Armed on Guitar with the default input: Scarlett 2i2 USB and Desk mic are not connected.',
    )
  })

  it('says which input or pair the input does not have, and the default that records instead', () => {
    expect(
      words({
        records: records({
          channels: 1,
          pick: { channel: 0, pair: false },
          missing: { channel: 2, pair: false },
        }),
      }),
    ).toBe(
      'Armed on Guitar. Scarlett 2i2 USB has no Input 3, so Input 1 records.',
    )
    expect(
      words({ records: records({ missing: { channel: 2, pair: true } }) }),
    ).toBe(
      'Armed on Guitar. Scarlett 2i2 USB has no Inputs 3 + 4, so Inputs 1 + 2 record, mixed.',
    )
  })

  it('says all of the input records where the browser does not say which inputs it has', () => {
    expect(
      words({
        records: records({
          channels: null,
          pick: null,
          missing: { channel: 1, pair: false },
        }),
      }),
    ).toBe(
      'Armed on Guitar. The browser does not say which inputs Scarlett 2i2 USB has, so all of it records.',
    )
  })

  it('names the port a MIDI lane opened, whatever a microphone arm before it said', () => {
    // Arrange, Act
    const said = armedWords(
      {
        armedInput: () => ({ ...nothing, records: records({}) }),
        midiArmed: () => ({
          port: 'Keystation 49',
          sound: 'piano',
          words: 'Plays the piano.',
        }),
      },
      'Keys',
    )

    // Assert
    expect(said).toBe(
      'Armed on Keys with Keystation 49. Press Record to start.',
    )
  })
})
