// ============================================================
// Lesson 14 lines — every line the song line and its toys say
// ============================================================
//
// WEB-SPEC, Toys 1, 2 and 4: each phrase's words and its spoken summary,
// a note named in Lesson 4's spelling with its sign spoken, never shown;
// the scrub's and the seek bar's moments; the live chart's summaries; and
// every line passing the guided-voice claims check, none of them a score.

import { describe, expect, it } from 'vitest'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { BREATH_LINE, CADENCE_LINE, liveSummary, phraseCaption, phraseEndLine, phraseSummary, scrubText, seekText, SONG_SUMMARY, STILL_ALT, swellSummary, TAKE_SAID, takeSummary, } from './lines'

describe("Lesson 14's lines", () => {
  it("captions each phrase with its words, the score's hyphens joined", () => {
    expect([0, 1, 2, 3, 4, 5].map(phraseCaption)).toEqual([
      'Twinkle, twinkle, little star,',
      'How I wonder what you are!',
      'Up above the world so high,',
      'Like a diamond in the sky.',
      'Twinkle, twinkle, little star,',
      'How I wonder what you are!',
    ])
    expect(phraseEndLine(0)).toBe('Phrase 1 ends on its long note: “star”.')
  })

  it('says a phrase in spoken names, a repeated note once with "twice", the long note last and "held"', () => {
    expect(phraseSummary(0, 50)).toBe(
      'Phrase 1, seven notes: do, D3, twice; so, A3, twice; la, B3, twice; then so, A3, held',
    )
    expect(phraseSummary(2, 50)).toBe(
      'Phrase 3, seven notes: so, A3, twice; fa, G3, twice; mi, F sharp 3, twice; then re, E3, held',
    )
    expect(swellSummary(62)).toContain('So, A4, twice')
    expect(liveSummary(51)).toBe('Do is E flat 3')
  })

  it('names the scrubbed moment of take 2: its syllable, "star" at its loudest at 5.1 s, and the breath from 5.7 s', () => {
    expect([0, 3.1, 5.1, 5.8].map((t) => scrubText(t))).toEqual([
      '0.0 seconds of 6: “Twin-”',
      '3.1 seconds of 6: “lit-”',
      '5.1 seconds of 6: “star”, at its loudest',
      '5.8 seconds of 6: the breath',
    ])
    expect(seekText(2.4, 6.2, 'lit-')).toBe('2.4 seconds of 6.2: “lit-”')
    expect(seekText(0, 6.2, null)).toBe('0.0 seconds of 6.2')
  })

  it("draws a take's summary from the notes its line ran over, and nothing about how it was sung", () => {
    expect(takeSummary(1, 'D3', 'B3')).toBe(
      "Your take 1, drawn as a line over Merc's bands, from about D3 to B3. Gaps in the line are where we heard no voice.",
    )
    expect(takeSummary(2, 'A3', 'A3')).toContain('at about A3')
  })

  it('says only what the claims check passes, in spoken names with no sign, and never a score', () => {
    // Arrange
    const lines = [
      ...[0, 1, 2, 3, 4, 5].flatMap((k) => [
        phraseCaption(k),
        phraseEndLine(k),
        phraseSummary(k, 54),
      ]),
      SONG_SUMMARY,
      STILL_ALT,
      swellSummary(50),
      TAKE_SAID[1],
      TAKE_SAID[2],
      BREATH_LINE[1],
      BREATH_LINE[2],
      CADENCE_LINE[1],
      CADENCE_LINE[2],
      liveSummary(54),
      takeSummary(1, 'F sharp 3', 'C sharp 4'),
      scrubText(5.1),
    ]

    // Assert
    for (const text of lines) {
      expect(
        validateGuidedDynamicClaim({ surface: 'finding', text }).violations,
        text,
      ).toEqual([])
      expect(text).not.toMatch(/[♯♭]|\bscore|\bwell done|\bperfect take/i)
    }
  })
})
