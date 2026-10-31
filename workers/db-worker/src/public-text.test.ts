import { describe, expect, it } from 'vitest'
import { publicTextError, publicTextProblems } from './public-text'
import { parseReportBody, REPORT_NOTE_MAX } from './report-rules'
import { validateWrite } from './validation'

const lyrics = (...words: string[]): string =>
  JSON.stringify(words.map((lyricText, id) => ({ id, lyricText })))

describe('publicTextProblems', () => {
  it('passes the names and titles a singer writes every day', () => {
    expect(
      publicTextProblems('userProfiles', {
        displayName: 'Ada Lovelace',
        bio: 'Alto.\nSings in a choir.',
        avatarUrl: 'https://lh3.googleusercontent.com/a/photo',
      }),
    ).toEqual([])
    expect(
      publicTextProblems('sharedMelodies', {
        melodyName: 'Moby Dick',
        tags: ['my-melody', 'practice'],
        itemsJson: lyrics('what', 'the', 'fuck'),
      }),
    ).toEqual([])
  })

  it('checks only the columns a write carries', () => {
    expect(publicTextProblems('userProfiles', { currentStreak: 3 })).toEqual([])
    expect(
      publicTextProblems('sessionRecords', { melodyName: 'Shit' }),
    ).toEqual([])
  })

  it('names each column that fails, and why', () => {
    expect(
      publicTextProblems('userProfiles', {
        displayName: 'a'.repeat(41),
        bio: 'Hello\nshit',
        avatarUrl: 'http://example.com/a.png',
      }),
    ).toEqual([
      { field: 'displayName', problem: 'too-long' },
      { field: 'bio', problem: 'words' },
      { field: 'avatarUrl', problem: 'not-https' },
    ])
    expect(
      publicTextProblems('sharedMelodies', {
        melodyName: 42,
        tags: Array.from({ length: 21 }, () => 'tag'),
        itemsJson: lyrics('nig', 'ger'),
      }),
    ).toEqual([
      { field: 'melodyName', problem: 'not-text' },
      { field: 'tags', problem: 'too-many' },
      { field: 'itemsJson', problem: 'slur' },
    ])
  })

  it('reads lyrics sent as an array as well as JSON text', () => {
    const notes = [{ lyricText: 'you' }, { lyricText: 'n1gger' }]
    expect(publicTextProblems('sharedMelodies', { itemsJson: notes })).toEqual([
      { field: 'itemsJson', problem: 'slur' },
    ])
  })

  it('reads an avatar address for its shape, never for words', () => {
    expect(
      publicTextProblems('userProfiles', {
        avatarUrl: 'https://lh3.googleusercontent.com/a/ACg8ocShitPorn',
      }),
    ).toEqual([])
  })

  it('reads stored tags as the JSON text a row holds', () => {
    expect(
      publicTextProblems('sharedMelodies', { tags: '["practice","f.u.c.k"]' }),
    ).toEqual([{ field: 'tags', problem: 'words' }])
  })
})

describe('validateWrite and the names others read', () => {
  it('answers with the first problem, worded', () => {
    expect(publicTextError('sharedSessions', { sessionName: 'Fuckface' })).toBe(
      'sessionName uses a word that is not allowed',
    )
    expect(validateWrite('userProfiles', { displayName: 'B1tch' })).toBe(
      'displayName uses a word that is not allowed',
    )
    expect(validateWrite('userProfiles', { displayName: '' })).toBeNull()
  })
})

describe('parseReportBody', () => {
  const report = { targetKind: 'melody', targetId: 'm-1', reason: 'spam' }

  it('takes a report with or without a note', () => {
    expect(parseReportBody(report)).toEqual({ ...report, note: null })
    expect(parseReportBody({ ...report, note: '  Spam link  ' })).toEqual({
      ...report,
      note: 'Spam link',
    })
  })

  it('refuses what the worker does not take', () => {
    expect(parseReportBody(null)).toHaveProperty('error')
    expect(
      parseReportBody({ ...report, targetKind: 'comment' }),
    ).toHaveProperty('error')
    expect(parseReportBody({ ...report, targetId: '' })).toHaveProperty('error')
    expect(parseReportBody({ ...report, reason: 'bored' })).toHaveProperty(
      'error',
    )
    expect(parseReportBody({ ...report, note: 7 })).toHaveProperty('error')
    expect(
      parseReportBody({ ...report, note: 'x'.repeat(REPORT_NOTE_MAX + 1) }),
    ).toHaveProperty('error')
  })
})
