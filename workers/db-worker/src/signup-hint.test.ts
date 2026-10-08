import { describe, expect, it } from 'vitest'
import { VOICE_LEGENDS } from '../../../src/lib/mirror/legend-catalog'
import { noteName, packVoiceprintHint, parseSignupSource, parseVoiceprintHint, readAccountVoiceprint, unpackVoiceprintHint, } from './signup-hint'

const SINATRA = {
  twin: 'Frank Sinatra',
  lowMidi: 40,
  highMidi: 67,
  accuracy: 80,
  steadiness: 85,
}

describe('parseVoiceprintHint', () => {
  it('believes a catalogue twin with a range a voice can have', () => {
    expect(parseVoiceprintHint(SINATRA)).toEqual({
      legendId: 'frank-sinatra',
      twin: 'Frank Sinatra',
      voiceType: 'Baritone',
      lowMidi: 40,
      highMidi: 67,
      accuracy: 80,
      steadiness: 85,
    })
  })

  it('finds every legend in the catalogue by its own name', () => {
    for (const legend of VOICE_LEGENDS) {
      const hint = parseVoiceprintHint({ ...SINATRA, twin: legend.name })
      expect(hint?.legendId).toBe(legend.id)
      expect(hint?.voiceType).toBe(legend.band)
    }
  })

  it('rounds the scores and lets either be missing', () => {
    expect(
      parseVoiceprintHint({ ...SINATRA, accuracy: 79.6, steadiness: null }),
    ).toMatchObject({ accuracy: 80, steadiness: null })
    expect(
      parseVoiceprintHint({
        twin: 'Frank Sinatra',
        lowMidi: 40,
        highMidi: 67,
      }),
    ).toMatchObject({ accuracy: null, steadiness: null })
  })

  it('keeps nothing the caller sent beyond the five fields', () => {
    const hint = parseVoiceprintHint({
      ...SINATRA,
      voiceType: '<script>',
      legendId: '../../etc/passwd',
    })
    expect(hint?.voiceType).toBe('Baritone')
    expect(hint?.legendId).toBe('frank-sinatra')
  })

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['a string', 'Frank Sinatra'],
    ['an array', ['Frank Sinatra', 40, 67]],
    ['a name off the catalogue', { ...SINATRA, twin: 'Nobody Famous' }],
    ['a name in other casing', { ...SINATRA, twin: 'frank sinatra' }],
    ['a twin that is not a string', { ...SINATRA, twin: 7 }],
    ['a low note under the floor', { ...SINATRA, lowMidi: 23 }],
    ['a high note over the ceiling', { ...SINATRA, highMidi: 97 }],
    ['a fractional note', { ...SINATRA, lowMidi: 40.5 }],
    ['a note given as text', { ...SINATRA, highMidi: '67' }],
    ['a range of one note', { ...SINATRA, highMidi: 40 }],
    ['a range upside down', { ...SINATRA, lowMidi: 67, highMidi: 40 }],
    [
      'a range wider than four octaves',
      { ...SINATRA, lowMidi: 30, highMidi: 79 },
    ],
    ['an accuracy over 100', { ...SINATRA, accuracy: 101 }],
    ['a negative steadiness', { ...SINATRA, steadiness: -1 }],
    ['a score that is not a number', { ...SINATRA, accuracy: '80' }],
    ['a score that is not finite', { ...SINATRA, accuracy: Number.NaN }],
  ])('means no hint for %s', (_label, raw) => {
    expect(parseVoiceprintHint(raw)).toBeNull()
  })

  it('accepts the widest range it allows, four octaves', () => {
    expect(
      parseVoiceprintHint({ ...SINATRA, lowMidi: 30, highMidi: 78 }),
    ).not.toBeNull()
  })
})

describe('parseSignupSource', () => {
  it('knows Karaoke Night and nothing else', () => {
    expect(parseSignupSource('karaoke')).toBe('karaoke')
    for (const raw of ['Karaoke', 'guitar-night', '', true, null, undefined]) {
      expect(parseSignupSource(raw)).toBeNull()
    }
  })
})

describe('the packed hint in the Google state', () => {
  it('comes back as the hint that went in', () => {
    const hint = parseVoiceprintHint(SINATRA)
    if (hint === null) throw new Error('sample hint did not parse')
    const packed = packVoiceprintHint(hint)
    expect(packed).toEqual(['Frank Sinatra', 40, 67, 80, 85])
    expect(unpackVoiceprintHint(JSON.parse(JSON.stringify(packed)))).toEqual(
      hint,
    )
  })

  it('is checked again on the way out', () => {
    expect(unpackVoiceprintHint(['Nobody Famous', 40, 67, null, null])).toBe(
      null,
    )
    expect(unpackVoiceprintHint(['Frank Sinatra', 40, 99, null, null])).toBe(
      null,
    )
  })

  it.each([
    ['nothing', undefined],
    ['an object', SINATRA],
    ['too short', ['Frank Sinatra', 40, 67]],
    ['too long', ['Frank Sinatra', 40, 67, 80, 85, 1]],
  ])('means no hint for %s', (_label, raw) => {
    expect(unpackVoiceprintHint(raw)).toBeNull()
  })
})

describe('noteName', () => {
  it('names notes the way the app does', () => {
    expect(noteName(40)).toBe('E2')
    expect(noteName(67)).toBe('G4')
    expect(noteName(60)).toBe('C4')
  })
})

describe('readAccountVoiceprint', () => {
  /** One canned row, and a record of what was asked for it. */
  function fakeDb(row: { twin: string; summary: string } | null) {
    const asked: { sql: string; values: unknown[] }[] = []
    const db = {
      prepare(sql: string) {
        return {
          bind(...values: unknown[]) {
            asked.push({ sql, values })
            return { first: async () => row }
          },
        }
      },
    }
    return { db: db as unknown as D1Database, asked }
  }

  const summary = JSON.stringify({
    lowMidi: 40,
    highMidi: 67,
    semitones: 27,
    accuracy: 80.4,
    steadiness: 85,
  })

  it('reads the newest take with a twin on the account', async () => {
    const { db, asked } = fakeDb({ twin: 'Frank Sinatra', summary })
    await expect(readAccountVoiceprint(db, 'user-1')).resolves.toMatchObject({
      legendId: 'frank-sinatra',
      lowMidi: 40,
      highMidi: 67,
      accuracy: 80,
    })
    expect(asked).toHaveLength(1)
    expect(asked[0].values).toEqual(['user-1'])
    expect(asked[0].sql).toContain('twin IS NOT NULL')
    expect(asked[0].sql).toContain('ORDER BY takenAt DESC')
  })

  it('finds nothing on an account without one', async () => {
    await expect(
      readAccountVoiceprint(fakeDb(null).db, 'user-1'),
    ).resolves.toBeNull()
  })

  it('treats a row that fails the checks as no voiceprint', async () => {
    const broken = [
      { twin: 'Frank Sinatra', summary: 'not json' },
      { twin: 'Frank Sinatra', summary: 'null' },
      { twin: 'Frank Sinatra', summary: JSON.stringify({ lowMidi: null }) },
      { twin: 'A Retired Legend', summary },
    ]
    for (const row of broken) {
      await expect(
        readAccountVoiceprint(fakeDb(row).db, 'user-1'),
      ).resolves.toBeNull()
    }
  })
})
