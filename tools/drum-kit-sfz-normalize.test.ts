// ============================================================
// Drum kit SFZ normalizer tests — inheritance, safety, and exact zone semantics
// ============================================================

import { describe, expect, it } from 'vitest'
import { parseAndNormalizeDrumKitSfz } from './drum-kit-sfz-normalize'

describe('parseAndNormalizeDrumKitSfz', () => {
  it('retains inherited velocity, sequence, choke, probability, and edit semantics', () => {
    const source = `
      <global> lovel=5 hivel=120 volume=-3
      <group> lokey=36 hikey=37 group=9 off_by=8 tune=5
      <region>
        sample="Samples/Kick One.wav"
        seq_position=2 seq_length=3 lorand=0.25 hirand=0.75
        offset=48 end=4096
    `

    const [zone] = parseAndNormalizeDrumKitSfz(source)

    expect(zone).toEqual({
      sourceLine: 4,
      samplePath: 'Samples/Kick One.wav',
      gmKeys: [36, 37],
      velocityMin: 5,
      velocityMax: 120,
      roundRobin: 2,
      sequencePosition: 2,
      sequenceLength: 3,
      chokeGroup: '8',
      chokes: ['9'],
      lorand: 0.25,
      hirand: 0.75,
      volumeDb: -3,
      tuneCents: 5,
      offsetFrames: 48,
      endFrame: 4096,
    })
  })

  it('lets a region key override inherited ranges and accepts named MIDI keys', () => {
    const zones = parseAndNormalizeDrumKitSfz(`
      <group> lokey=35 hikey=40
      <region> sample=Snare.wav key=D2
      <region> sample=Hat.wav key=F#2
    `)

    expect(zones.map((zone) => zone.gmKeys)).toEqual([[38], [42]])
    expect(zones.map((zone) => zone.samplePath)).toEqual([
      'Snare.wav',
      'Hat.wav',
    ])
  })

  it('resets group inheritance when a new group starts', () => {
    const zones = parseAndNormalizeDrumKitSfz(`
      <global> lovel=2
      <group> key=36 volume=-4
      <region> sample=Kick.wav
      <group> key=38
      <region> sample=Snare.wav
    `)

    expect(zones[0]).toMatchObject({ gmKeys: [36], volumeDb: -4 })
    expect(zones[1]).toMatchObject({
      gmKeys: [38],
      velocityMin: 2,
      volumeDb: 0,
    })
  })

  it('maps SFZ off_by direction into the runtime choke contract', () => {
    const zones = parseAndNormalizeDrumKitSfz(`
      <region> sample=Open.wav key=46 off_by=2
      <region> sample=Closed.wav key=42 group=2
    `)

    expect(zones[0]).toMatchObject({ chokeGroup: '2', chokes: [] })
    expect(zones[1]).toMatchObject({ chokeGroup: null, chokes: ['2'] })
  })

  it.each([
    '../outside.wav',
    'Samples/../../outside.wav',
    '..\\outside.wav',
    '/absolute/kick.wav',
    'C:\\Samples\\kick.wav',
    'https://example.test/kick.wav',
  ])('rejects unsafe sample path %s', (path) => {
    expect(() =>
      parseAndNormalizeDrumKitSfz(`<region> sample="${path}" key=36`),
    ).toThrow(/sample path/)
  })

  it.each([
    ['missing sample', '<region> key=36', 'region without sample'],
    ['missing key', '<region> sample=kick.wav', 'lokey/key'],
    [
      'reversed keys',
      '<region> sample=kick.wav lokey=40 hikey=36',
      'key range',
    ],
    [
      'reversed velocity',
      '<region> sample=kick.wav key=36 lovel=100 hivel=20',
      'velocity range',
    ],
    [
      'incomplete sequence',
      '<region> sample=kick.wav key=36 seq_position=2',
      'incomplete sequence',
    ],
    [
      'sequence overflow',
      '<region> sample=kick.wav key=36 seq_position=3 seq_length=2',
      'seq_position',
    ],
    [
      'random overlap',
      '<region> sample=kick.wav key=36 lorand=.8 hirand=.2',
      'random range',
    ],
    [
      'end before offset',
      '<region> sample=kick.wav key=36 offset=100 end=99',
      'end before offset',
    ],
  ])('rejects %s rather than guessing', (_label, source, message) => {
    expect(() => parseAndNormalizeDrumKitSfz(source)).toThrow(message)
  })

  it('retains default probability bounds explicitly', () => {
    const [zone] = parseAndNormalizeDrumKitSfz(
      '<region> sample=kick.wav key=36',
    )

    expect(zone).toMatchObject({
      lorand: 0,
      hirand: 1,
      sequencePosition: 1,
      sequenceLength: 1,
    })
  })
})
