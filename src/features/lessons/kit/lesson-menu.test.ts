// ============================================================
// Lesson menu tests — every lesson's row, and where the viewer is on this page
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type * as Menu from './lesson-menu'
import type { DeckNow, MenuModel, MenuRow } from './lesson-menu'
import { menuModel } from './lesson-menu'
import type * as Season from './season'
import { LESSONS } from './season'

/** This page's deck: six steps, the third showing, singing after the last. */
const DECK: DeckNow = {
  now: 3,
  titles: ['One', 'Two', 'Three', 'Four', 'Five', 'Six'],
  after: { label: 'Sing it', href: '#sing' },
}

const rows = (m: MenuModel): MenuRow[] => m.arcs.flatMap((a) => a.rows)

const row = (m: MenuModel, n: number): MenuRow | undefined =>
  rows(m).find((r) => r.n === n)

describe('menuModel', () => {
  it('gives each lesson its state, its right-hand text and where its row goes', () => {
    // Arrange: on Lesson 2's page, Lesson 1 done, Lesson 4 left at step 3
    const kept = { 4: { step: 3, of: 5 } }

    // Act
    const m = menuModel(LESSONS, [1], kept, 2, DECK)

    // Assert
    expect(
      [1, 2, 3, 4, 5, 9].map((n) => {
        const r = row(m, n)
        return [n, r?.state, r?.meta, r?.href]
      }),
    ).toEqual([
      [1, 'done', 'Done · 10 min', '/learn/01'],
      [2, 'here', 'Step 3 of 6', '#top'],
      [3, 'next', 'Up next', '/learn/03'],
      [4, 'progress', 'Step 3 of 5', '/learn/04#step-3'],
      [5, 'ready', 'Ready · 17 min', '/learn/05'],
      [9, 'later', 'Coming later', null],
    ])
  })

  it('says each row as a sentence, so a lesson coming later is never a dead link', () => {
    // Act
    const m = menuModel(LESSONS, [1], {}, 2, DECK)

    // Assert
    expect([1, 2, 3, 9].map((n) => row(m, n)?.label)).toEqual([
      'Lesson 1, What is a note?, done, 10 minutes',
      'Lesson 2, Twelve notes, step 3 of 6',
      'Lesson 3, Match a note, up next',
      'Lesson 9, Landing a leap, coming later',
    ])
    expect(
      rows(m)
        .filter((r) => r.state === 'later')
        .map((r) => r.href),
    ).toEqual(Array(9).fill(null))
  })

  it('recommends as up next the first lesson ready whose prerequisites are all done', () => {
    // Act: on Lesson 1's page, before and after Lesson 1 is done
    const [before, after] = [[], [1]].map((done) =>
      rows(menuModel(LESSONS, done, {}, 1, DECK))
        .filter((r) => r.state === 'next')
        .map((r) => r.n),
    )

    // Assert: Lessons 2 and 3 both build on Lesson 1
    expect(before).toEqual([])
    expect(after).toEqual([2])
  })

  it("opens this page's lesson to its steps: reached, showing or ahead, then what follows the last", () => {
    // Arrange: the viewer once reached step 5, and is back at step 3
    const kept = { 2: { step: 5, of: 6 } }

    // Act
    const m = menuModel(LESSONS, [], kept, 2, DECK)

    // Assert
    expect(row(m, 2)?.steps.map((s) => [s.n, s.state, s.href])).toEqual([
      [1, 'seen', '#step-1'],
      [2, 'seen', '#step-2'],
      [3, 'now', '#step-3'],
      [4, 'seen', '#step-4'],
      [5, 'seen', '#step-5'],
      [6, 'ahead', '#step-6'],
      [null, 'after', '#sing'],
    ])
    expect(rows(m).filter((r) => r.steps.length > 0)).toHaveLength(1)
  })

  it('tells the viewer where they are on this page, and continues there', () => {
    // Act
    const { here } = menuModel(LESSONS, [], {}, 2, DECK)

    // Assert
    expect(here).toEqual({
      title: 'You are here: step 3 of 6',
      line: 'Lesson 2 · Three',
      label: 'Continue at step 3 of 6: Three',
      href: '#step-3',
      fill: 0.5,
    })
  })

  it('keeps a lesson done on its own page at the step showing, every step seen and its ring full', () => {
    // Act
    const L2 = row(menuModel(LESSONS, [2], {}, 2, DECK), 2)

    // Assert
    expect([L2?.state, L2?.meta, L2?.fill]).toEqual([
      'here',
      'Done · step 3 of 6',
      1,
    ])
    expect(L2?.steps.map((s) => s.state)).toEqual([
      'seen',
      'seen',
      'now',
      'seen',
      'seen',
      'seen',
      'after',
    ])
  })

  it("counts the season's lessons done, the trailer left out, one bar a lesson", () => {
    // Arrange: on Lesson 2's page, Lessons 1 and 4 done, Lesson 5 begun
    const kept = { 5: { step: 2, of: 5 } }

    // Act
    const m = menuModel(LESSONS, [1, 4], kept, 2, DECK)

    // Assert
    expect(m.count).toBe('2 of 14 done')
    expect(m.season).toBe('Season 1 · 14 lessons')
    expect(m.bars.map((b) => b.kind)).toEqual([
      'done',
      'here',
      'ready',
      'done',
      'progress',
      ...Array(9).fill('later'),
    ])
    expect(m.bars[4].fill).toBeCloseTo(0.4)
  })

  it('splits the season into its two arcs', () => {
    // Act
    const { arcs } = menuModel(LESSONS, [], {}, 2, DECK)

    // Assert
    expect(arcs.map((a) => [a.name, a.span, a.rows.map((r) => r.n)])).toEqual([
      ['Hear it', 'Lessons 1 to 7', [1, 2, 3, 4, 5, 6, 7]],
      ['Shape it', 'Lessons 8 to 14', [8, 9, 10, 11, 12, 13, 14]],
    ])
  })
})

describe('a hidden draft (drafts.ts)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('is coming later and not a link, even with a step the viewer reached while it was shown', async () => {
    // Arrange: a build that hides drafts, and a step kept from a dev visit
    vi.stubEnv('VITE_DRAFT_LESSONS', '0')
    vi.resetModules()
    const season: typeof Season = await import('./season')
    const menu: typeof Menu = await import('./lesson-menu')

    // Act
    const m = menu.menuModel(
      season.LESSONS,
      [1],
      { 3: { step: 3, of: 6 } },
      1,
      DECK,
    )

    // Assert
    const L3 = row(m, 3)
    expect([L3?.state, L3?.meta, L3?.href, L3?.fill]).toEqual([
      'later',
      'Coming later',
      null,
      0,
    ])
    expect(rows(m).map((r) => r.href)).not.toContain('/learn/03#step-3')
  })
})
