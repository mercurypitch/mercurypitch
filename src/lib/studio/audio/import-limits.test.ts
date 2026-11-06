// Studio import limits — a refusal for a long file names the limit in words, as the size refusal does, and empty audio is called empty.
import { describe, expect, it } from 'vitest'
import type { PcmAudio } from './import-limits'
import { DEFAULT_STUDIO_IMPORT_LIMITS, importLimits, studioLengthLimitWords, validatePcmDimensions, } from './import-limits'

/** Decoded audio of `length` frames, as far as the check reads it. */
const decoded = (length: number): PcmAudio => ({
  sampleRate: 48_000,
  numberOfChannels: 2,
  length,
  getChannelData: () => new Float32Array(0),
})

describe('validatePcmDimensions', () => {
  it('refuses a file over five minutes by naming the limit', () => {
    // Five and a half minutes, as the audit's file was.
    expect(() =>
      validatePcmDimensions(
        decoded(48_000 * 330),
        DEFAULT_STUDIO_IMPORT_LIMITS,
      ),
    ).toThrow(
      'This audio is over the 5-minute Studio import limit. Choose a shorter file.',
    )
  })

  it('takes a file of exactly the limit, and calls empty audio empty', () => {
    expect(() =>
      validatePcmDimensions(
        decoded(48_000 * 300),
        DEFAULT_STUDIO_IMPORT_LIMITS,
      ),
    ).not.toThrow()
    expect(() =>
      validatePcmDimensions(decoded(0), DEFAULT_STUDIO_IMPORT_LIMITS),
    ).toThrow('This audio is empty. Choose another file.')
  })

  it('names a shorter limit set for the import in seconds where it is not whole minutes', () => {
    const limits = importLimits({ maxFrames: 48_000 * 90 })
    expect(() => validatePcmDimensions(decoded(48_000 * 91), limits)).toThrow(
      'over the 90-second Studio import limit',
    )
    expect(studioLengthLimitWords(48_000 * 120)).toBe('2-minute')
  })
})
