// Percussion notation tests keep every reader on one non-pitched GM map.

import { describe, expect, it } from 'vitest'
import { GM_PERCUSSION_MAX, GM_PERCUSSION_MIN } from './percussion'
import { percussionNotationForGmKey } from './percussion-notation'

describe('percussionNotationForGmKey', () => {
  it('projects kit voices onto stable native staff and notehead roles', () => {
    expect(percussionNotationForGmKey(36)).toEqual(
      expect.objectContaining({
        label: 'Bass Drum 1',
        shortLabel: 'K',
        family: 'kick',
        seatAnchor: 'kick',
        staffStep: -4,
        notehead: 'normal',
        stemDirection: 'up',
      }),
    )
    expect(percussionNotationForGmKey(37)).toEqual(
      expect.objectContaining({
        family: 'snare',
        staffStep: 0,
        notehead: 'cross',
      }),
    )
    expect(percussionNotationForGmKey(42)).toEqual(
      expect.objectContaining({
        shortLabel: 'HH',
        family: 'hi-hat',
        staffStep: 5,
        notehead: 'cross',
      }),
    )
    expect(percussionNotationForGmKey(49)).toEqual(
      expect.objectContaining({
        shortLabel: 'CR',
        family: 'cymbal',
        seatAnchor: 'crash',
        staffStep: 6,
        notehead: 'cross',
      }),
    )
  })

  it('keeps tom height and physical seat direction distinct', () => {
    expect(percussionNotationForGmKey(41)).toEqual(
      expect.objectContaining({ seatAnchor: 'tom-right', staffStep: -2 }),
    )
    expect(percussionNotationForGmKey(45)).toEqual(
      expect.objectContaining({ seatAnchor: 'tom-centre', staffStep: 1 }),
    )
    expect(percussionNotationForGmKey(50)).toEqual(
      expect.objectContaining({ seatAnchor: 'tom-left', staffStep: 3 }),
    )
  })

  it('uses an explicit auxiliary voice instead of guessing a kit pitch', () => {
    expect(percussionNotationForGmKey(54)).toEqual(
      expect.objectContaining({
        label: 'Tambourine',
        shortLabel: 'P54',
        family: 'auxiliary',
        seatAnchor: 'auxiliary',
        notehead: 'diamond',
      }),
    )
  })

  it('provides bounded, internally consistent notation for every GM key', () => {
    for (
      let gmKey = GM_PERCUSSION_MIN;
      gmKey <= GM_PERCUSSION_MAX;
      gmKey += 1
    ) {
      const voice = percussionNotationForGmKey(gmKey)
      expect(voice.gmKey).toBe(gmKey)
      expect(voice.id).toBe(`gm-${gmKey}`)
      expect(voice.label).not.toMatch(/^Percussion /)
      expect(voice.staffStep).toBeGreaterThanOrEqual(-4)
      expect(voice.staffStep).toBeLessThanOrEqual(6)
      expect(voice.stemDirection).toBe(voice.staffStep >= 0 ? 'down' : 'up')
    }
  })
})
