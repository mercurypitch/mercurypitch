// ============================================================
// A phone does not download a speech model to open a song
// ============================================================
//
// The bug this rule exists for is invisible from inside the page: iOS kills
// the content process and the tab comes back as a fresh load of the same URL,
// with no error to catch. The only reason it was findable at all is that the
// karaoke stage never died — and the stage is the one surface that already
// skipped the eager model download. So the matrix below is the evidence, and
// the phone rows are the fix.

import { describe, expect, it } from 'vitest'
import { shouldPreloadWhisper } from './eager-whisper'

describe('who downloads Whisper before being asked', () => {
  it('the desktop studio mixer does — an instant Transcribe is worth it there', () => {
    expect(
      shouldPreloadWhisper({ preset: 'studio', deviceClass: 'desktop' }),
    ).toBe(true)
    // `preset` is optional on StemMixer and the studio is its default, so an
    // absent preset has to read as the studio and not as "unknown, skip it".
    expect(
      shouldPreloadWhisper({ preset: undefined, deviceClass: 'desktop' }),
    ).toBe(true)
  })

  it('a phone does not, whichever surface it is on', () => {
    expect(
      shouldPreloadWhisper({ preset: 'studio', deviceClass: 'mobile' }),
    ).toBe(false)
    expect(
      shouldPreloadWhisper({ preset: undefined, deviceClass: 'mobile' }),
    ).toBe(false)
  })

  it('the karaoke stage does not, on any device', () => {
    for (const klass of ['desktop', 'mobile', 'tv'] as const) {
      expect(
        shouldPreloadWhisper({ preset: 'performance', deviceClass: klass }),
        `the performance preset should not preload on ${klass}`,
      ).toBe(false)
    }
  })

  it('a television still does — it is not the device that was dying', () => {
    // Narrow on purpose: the fix is for the memory ceiling iOS enforces, and
    // quietly changing a TV's behaviour would be a second, untested change.
    expect(shouldPreloadWhisper({ preset: 'studio', deviceClass: 'tv' })).toBe(
      true,
    )
  })
})
