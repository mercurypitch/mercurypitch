// Studio record notices tests — the armed card says the lane is ready, or which input it records from when that is not the one asked for, and a channel the input does not have.
import { describe, expect, it } from 'vitest'
import { armedWords } from './StudioRecordNotices'
import type { StudioArmedInput } from './useStudioRecorder'

const nothing: StudioArmedInput = {
  laneMissing: null,
  defaultInstead: null,
  channelMissing: null,
}

const words = (input: Partial<StudioArmedInput>) =>
  armedWords({ armedInput: () => ({ ...nothing, ...input }) }, 'Guitar')

describe('the armed card', () => {
  it('says the lane is ready when it records from what it asked for', () => {
    expect(words({})).toBe('Armed on Guitar. Press Record to start.')
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

  it('says all of the input records, mixed, when it has no such channel', () => {
    expect(words({ channelMissing: 2 })).toBe(
      'Armed on Guitar. The input has no Input 3, so all of it records, mixed.',
    )
  })
})
