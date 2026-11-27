// ============================================================
// The queued Legends are right before anyone posts them
// ============================================================
//
// The worker stores whatever it is sent: no range check, no tag check, no
// date order (handleWeeklyCreate in the db worker). "G44" was once a valid
// note there. So the queue in scripts/legend-queue.mjs is checked here, and
// the seeder refuses to post while legendQueueProblems() finds anything.
//
// The note lines are pinned on purpose. They are transcriptions of each
// piece's published engraving (the `source` on every row says which), so a
// change to one should be a deliberate edit to this test as well.

import { describe, expect, it } from 'vitest'
import { DIFFICULTIES, FEAT_TYPES, } from '@/features/challenges/challenge-taxonomy'
import { COMFORT_HIGH, COMFORT_LOW, legendQueueProblems, LEGENDS, legendSlug, noteLabel, } from '../../scripts/legend-queue.mjs'

type Legend = (typeof LEGENDS)[number]

const line = (row: Legend): string => row.notes.map(noteLabel).join(' ')

describe('the Legend queue', () => {
  it('has nothing the seeder would refuse', () => {
    expect(legendQueueProblems(LEGENDS)).toEqual([])
  })

  it('continues from the Legend live on prod, which ends 21 Dec 2026', () => {
    expect(LEGENDS[0].startsAt).toBe('2026-12-21T00:00:00.000Z')
  })

  it('uses only tags the authoring page can show and save back', () => {
    for (const row of LEGENDS) {
      expect(FEAT_TYPES).toContain(row.featType)
      expect(DIFFICULTIES).toContain(row.difficulty)
    }
  })

  it('gives every row its own slug, none of them reading as an Encore', () => {
    const slugs = LEGENDS.map(legendSlug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) expect(slug).not.toContain('-encore-')
  })

  it('names its source, credits and public-domain reason on every row', () => {
    for (const row of LEGENDS) {
      expect(row.source.score).not.toBe('')
      expect(row.source.credits).not.toBe('')
      expect(row.source.publicDomain).not.toBe('')
      expect(row.source.lyric).not.toBe('')
    }
  })

  it('sings the lines the engravings give', () => {
    expect(LEGENDS.map((row) => [row.title, line(row)])).toEqual([
      ['Hold the Night', 'G4 A4 G4 E4 E4 G4 A4 G4 E4 E4'],
      ['Old Acquaintance', 'C4 F4 F4 F4 A4 G4 F4 G4'],
      ['The Rebel Bird', 'D4 C#4 C4 C4 C4 B3 A#3 A3 A3'],
      ['The Pipes Are Calling', 'C#4 D4 E4 F#4 E4 F#4 B4 A4 F#4 E4 D4 B3'],
    ])
  })
})

describe('what the queue check catches', () => {
  const base = LEGENDS[0]

  it('a note outside G3-C5', () => {
    const problems = legendQueueProblems([
      { ...base, notes: [COMFORT_LOW - 1, 60, COMFORT_HIGH + 1] },
    ])
    expect(problems).toHaveLength(2)
    expect(problems[0]).toContain('F#3')
    expect(problems[1]).toContain('C#5')
  })

  it('a window that does not start where the last one ended', () => {
    const [first, second] = LEGENDS
    const problems = legendQueueProblems([
      first,
      {
        ...second,
        startsAt: '2027-01-25T00:00:00.000Z',
        endsAt: '2027-02-22T00:00:00.000Z',
      },
    ])
    expect(problems.join('\n')).toContain('not where the last one ended')
  })

  it('a window that is not four weeks from a Monday', () => {
    const problems = legendQueueProblems([
      {
        ...base,
        startsAt: '2026-12-22T00:00:00.000Z',
        endsAt: '2027-01-18T00:00:00.000Z',
      },
    ])
    expect(problems.join('\n')).toContain('Monday')
    expect(problems.join('\n')).toContain('28 days')
  })

  it('an em dash in new copy', () => {
    const problems = legendQueueProblems([
      { ...base, description: 'Hold it — long' },
    ])
    expect(problems.join('\n')).toContain('em dash')
  })

  it('a Hear it link that is not a YouTube video', () => {
    const problems = legendQueueProblems([
      { ...base, hearItUrl: 'https://example.com/song' },
    ])
    expect(problems.join('\n')).toContain('hearItUrl')
  })
})
