// ============================================================
// The Vocal Range Test's entry page asks for a comfortable top
// ============================================================
//
// The descriptions and the lede are what a search result and a shared link
// promise before the test says a word, so they ask what the test asks: a
// glide to the highest comfortable note, never the highest the voice can
// reach (REQ-GVC-072; Find Your Pitch, Lesson 7 FACTS 70).

import { describe, expect, it } from 'vitest'
import { ENTRY_PAGES } from './entry-pages'

const page = ENTRY_PAGES.find((entry) => entry.slug === 'vocal-range-test')

describe('the Vocal Range Test entry page', () => {
  it('asks for the highest comfortable note in its descriptions and lede', () => {
    expect(page?.description).toBe(
      'Glide from your lowest note to your highest comfortable note and get both notes, your span in semitones and a voice-type guide. Free, in your browser.',
    )
    expect(page?.og.description).toBe(
      'Glide from your lowest note to your highest comfortable note and get both notes, your span in semitones and a broad voice-type guide.',
    )
    expect(page?.lede).toBe(
      'Glide from your lowest comfortable note to your highest comfortable note and get both notes, your span in semitones and a broad voice-type guide. It runs in your browser and needs no piano and no teacher. The timed part takes about a minute, and each step waits until you are ready.',
    )
  })
})
