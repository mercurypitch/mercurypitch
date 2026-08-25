// ============================================================
// Drum pad layout tests — stable authored mix-family classification
// ============================================================

import { describe, expect, it } from 'vitest'
import { drumScoreVoiceForGmKey } from '../session/drum-score'
import { DRUM_KIT_AUTHORED_FAMILIES, drumKitAuthoredFamily, } from './drum-pad-layout'

describe('drumKitAuthoredFamily', () => {
  it('keeps supported kit articulations in five stable mix families', () => {
    expect(DRUM_KIT_AUTHORED_FAMILIES).toEqual([
      'kick',
      'snare',
      'hats',
      'toms',
      'cymbals',
    ])
    expect([35, 36].map(drumKitAuthoredFamily)).toEqual(['kick', 'kick'])
    expect([37, 38, 39, 40].map(drumKitAuthoredFamily)).toEqual([
      'snare',
      'snare',
      'snare',
      'snare',
    ])
    expect([42, 44, 46].map(drumKitAuthoredFamily)).toEqual([
      'hats',
      'hats',
      'hats',
    ])
    expect([41, 43, 45, 47, 48, 50].map(drumKitAuthoredFamily)).toEqual([
      'toms',
      'toms',
      'toms',
      'toms',
      'toms',
      'toms',
    ])
    expect([49, 51, 52, 53, 55, 57, 59].map(drumKitAuthoredFamily)).toEqual([
      'cymbals',
      'cymbals',
      'cymbals',
      'cymbals',
      'cymbals',
      'cymbals',
      'cymbals',
    ])
  })

  it('does not invent a family for unsupported auxiliary percussion', () => {
    expect(drumKitAuthoredFamily(34)).toBeNull()
    expect(drumKitAuthoredFamily(54)).toBeNull()
    expect(drumKitAuthoredFamily(81)).toBeNull()
  })

  it('stays aligned with the score family for every General MIDI key', () => {
    const scoreToMixFamily = {
      auxiliary: null,
      cymbal: 'cymbals',
      'hi-hat': 'hats',
      kick: 'kick',
      snare: 'snare',
      tom: 'toms',
    } as const

    for (let gmKey = 35; gmKey <= 81; gmKey += 1) {
      const scoreFamily = drumScoreVoiceForGmKey(gmKey).family
      expect(drumKitAuthoredFamily(gmKey)).toBe(scoreToMixFamily[scoreFamily])
    }
  })
})
