// ============================================================
// Stem mix state tests — audibility across mute, solo, and fader changes
// ============================================================

import { describe, expect, it } from 'vitest'
import { setStemVolume, stemMixHasSolo, stemTrackIsAudible, toggleStemMute, toggleStemSolo, } from './stem-mix-state'

interface Track {
  label: string
  muted: boolean
  soloed: boolean
  volume: number
}

const tracks = (): Track[] => [
  { label: 'Vocal', muted: false, soloed: false, volume: 0.8 },
  { label: 'Drums', muted: false, soloed: false, volume: 0.7 },
  { label: 'Bass', muted: false, soloed: false, volume: 0.6 },
]

const audibleLabels = (mix: readonly Track[]): string[] => {
  const hasSolo = stemMixHasSolo(mix)
  return mix
    .filter((track) => stemTrackIsAudible(track, hasSolo))
    .map((track) => track.label)
}

describe('stem mix state', () => {
  it('keeps the remaining solo isolated when one of two solos is released', () => {
    const withVocal = toggleStemSolo(tracks(), 'Vocal')
    const withVocalAndDrums = toggleStemSolo(withVocal, 'Drums')
    expect(audibleLabels(withVocalAndDrums)).toEqual(['Vocal', 'Drums'])

    const drumsOnly = toggleStemSolo(withVocalAndDrums, 'Vocal')
    expect(audibleLabels(drumsOnly)).toEqual(['Drums'])
    expect(drumsOnly.find((track) => track.label === 'Bass')?.volume).toBe(0.6)
  })

  it('lets mute override solo without changing the stored fader level', () => {
    const soloed = toggleStemSolo(tracks(), 'Vocal')
    const mutedSolo = toggleStemMute(soloed, 'Vocal')

    expect(audibleLabels(mutedSolo)).toEqual([])
    expect(mutedSolo[0]).toMatchObject({
      muted: true,
      soloed: true,
      volume: 0.8,
    })
  })

  it('preserves mute and solo isolation when a fader moves', () => {
    const muted = toggleStemMute(tracks(), 'Vocal')
    const adjustedMuted = setStemVolume(muted, 'Vocal', 0.35)
    expect(adjustedMuted[0]).toMatchObject({ muted: true, volume: 0.35 })
    expect(audibleLabels(adjustedMuted)).toEqual(['Drums', 'Bass'])

    const drumsSolo = toggleStemSolo(tracks(), 'Drums')
    const adjustedBass = setStemVolume(drumsSolo, 'Bass', 0.25)
    expect(adjustedBass[2]).toMatchObject({ soloed: false, volume: 0.25 })
    expect(audibleLabels(adjustedBass)).toEqual(['Drums'])
  })

  it('clamps invalid fader values without touching the other tracks', () => {
    expect(setStemVolume(tracks(), 'Vocal', 2)[0].volume).toBe(1)
    expect(setStemVolume(tracks(), 'Vocal', Number.NaN)[0].volume).toBe(0)
    expect(setStemVolume(tracks(), 'Missing', 0.2)).toEqual(tracks())
  })
})
