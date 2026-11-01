// ============================================================
// The onboarding's words: notes with the sharp sign, plain spans
// ============================================================

import { describe, expect, it } from 'vitest'
import { heardLine, noteMeaning, rangeLine, rangeMeaning, rangeSubline, spanWords, voiceHeadline, } from './onboarding-copy'

describe('note names on screen', () => {
  it('writes a sharp with the sharp sign, never the hash', () => {
    expect(heardLine('G#3')).toBe("That's a G♯3.")
    expect(heardLine('A3')).toBe("That's an A3.")
    expect(rangeLine('F#2', 'G#4')).toBe("F♯2 to G♯4. That's your range today.")
  })

  it('says what a note name means, by the note sung', () => {
    expect(noteMeaning('A#3')).toBe(
      'A♯3 is the name of the note you sang. Higher notes get higher numbers.',
    )
  })
})

describe('the reveal in words', () => {
  it('heads the card with the voice type, with its article', () => {
    expect(voiceHeadline('Baritone')).toBe("You're a baritone")
    expect(voiceHeadline('Alto')).toBe("You're an alto")
    expect(voiceHeadline('Mezzo-soprano')).toBe("You're a mezzo-soprano")
    expect(voiceHeadline(null)).toBe('Your voice')
  })

  it('says how wide a range is in octaves, never wider than it is', () => {
    expect(spanWords(7)).toBe('under an octave')
    expect(spanWords(12)).toBe('about an octave')
    expect(spanWords(15)).toBe('about an octave')
    expect(spanWords(18)).toBe('about an octave and a half')
    // A tie goes down: 21 semitones is an octave and three quarters.
    expect(spanWords(21)).toBe('about an octave and a half')
    expect(spanWords(24)).toBe('about two octaves')
    expect(spanWords(27)).toBe('about two octaves')
    expect(spanWords(30)).toBe('about two and a half octaves')
    expect(spanWords(36)).toBe('about three octaves')
  })

  it('says what a range just measured means, under its pins', () => {
    expect(rangeMeaning({ lowMidi: 40, highMidi: 67 })).toBe(
      'Your lowest note to your highest: about two octaves.',
    )
  })

  it('puts the range and its span on one line', () => {
    expect(
      rangeSubline({
        lowNote: 'F#2',
        highNote: 'G#4',
        lowMidi: 42,
        highMidi: 68,
      }),
    ).toBe('F♯2 to G♯4 · about two octaves')
  })
})
