// ============================================================
// Season map tests — what a lesson builds on, opens and lights
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as Season from './season'
import { ancestors, EDGES, lessonPath, LESSONS, unlocks } from './season'

/** Lesson n's lit edges as { 'a-b': role }, leaving out the edges off its path. */
function litEdges(n: number): Record<string, string> {
  const { roles } = lessonPath(n)
  const lit: Record<string, string> = {}
  EDGES.forEach(([a, b], i) => {
    const role = roles[i]
    if (role !== null) lit[`${a}-${b}`] = role
  })
  return lit
}

describe('unlocks', () => {
  it('lists the lessons that name n as a direct prerequisite, in lesson order', () => {
    // Act
    const opened = unlocks(3)

    // Assert
    expect(opened).toEqual([5, 7, 9])
  })

  it('leaves out a lesson reached only through another', () => {
    // Arrange: 5 needs both 2 and 3, and each of those needs 1

    // Act
    const opened = unlocks(1)

    // Assert
    expect(opened).toEqual([2, 3])
  })

  it('opens nothing from the trailer or the finale', () => {
    // Act
    const fromTrailer = unlocks(0)
    const fromFinale = unlocks(14)

    // Assert
    expect(fromTrailer).toEqual([])
    expect(fromFinale).toEqual([])
  })
})

describe('ancestors', () => {
  it('is empty where the season starts', () => {
    // Act
    const trailer = ancestors(0)
    const first = ancestors(1)

    // Assert
    expect([...trailer]).toEqual([])
    expect([...first]).toEqual([])
  })

  it('counts a lesson reached two ways once', () => {
    // Arrange: 5 builds on 2 and 3, and both build on 1

    // Act
    const before = ancestors(5)

    // Assert
    expect([...before].sort((a, b) => a - b)).toEqual([1, 2, 3])
  })

  it('reaches back through every lesson in between', () => {
    // Act
    const before = ancestors(13)

    // Assert
    expect([...before].sort((a, b) => a - b)).toEqual([1, 3, 7, 11])
  })

  it('gathers the whole path into the finale and nothing beside it', () => {
    // Act
    const before = ancestors(14)

    // Assert: 7, 11 and 13 are a branch of their own, and 0 is no prerequisite
    expect([...before].sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 8, 9, 10, 12,
    ])
  })
})

describe('lessonPath', () => {
  it("lights the selected lesson's own links in and out, and its path in further back", () => {
    // Act
    const lit = litEdges(9)

    // Assert
    expect(lit).toEqual({
      '3-9': 'in',
      '6-9': 'in',
      '9-14': 'out',
      '1-2': 'path',
      '1-3': 'path',
      '2-4': 'path',
      '4-6': 'path',
    })
  })

  it('leaves a branch unlit even where it leaves the path', () => {
    // Arrange: 2 and 3 are on 9's path in; 5 and 7 are not

    // Act
    const lit = litEdges(9)

    // Assert
    expect(lit['2-5']).toBeUndefined()
    expect(lit['3-5']).toBeUndefined()
    expect(lit['3-7']).toBeUndefined()
  })

  it('lights only the way out of the first lesson', () => {
    // Act
    const lit = litEdges(1)

    // Assert
    expect(lit).toEqual({ '1-2': 'out', '1-3': 'out' })
  })

  it('lights every edge into the finale, and none for the trailer', () => {
    // Act
    const finale = litEdges(14)
    const trailer = litEdges(0)

    // Assert
    expect(Object.values(finale).filter((r) => r === 'in')).toHaveLength(4)
    expect(Object.values(finale).filter((r) => r === 'out')).toHaveLength(0)
    expect(trailer).toEqual({})
  })

  it('gives one role per edge and names the ancestors for the anc class', () => {
    // Act
    const path = lessonPath(14)

    // Assert
    expect(path.roles).toHaveLength(EDGES.length)
    expect([...path.ancestors]).toEqual([...ancestors(14)])
  })
})

describe('LESSONS', () => {
  it('is indexed by lesson number', () => {
    // Act
    const numbers = LESSONS.map((L) => L.n)

    // Assert
    expect(numbers).toEqual(LESSONS.map((_, i) => i))
  })

  it("sends every practise link to this site, marked with the lesson's number", () => {
    // Arrange
    const here = 'https://lesson.test'

    for (const L of LESSONS) {
      if (L.pr.link === undefined) continue

      // Act
      const url = new URL(L.pr.link.href, here)

      // Assert
      expect(url.origin, `lesson ${L.n}`).toBe(here)
      expect(url.searchParams.get('lesson'), `lesson ${L.n}`).toBe(
        String(L.n).padStart(2, '0'),
      )
    }
  })

  it("words every practise note for the learner, never as the team's to-do", () => {
    // Act: the notes a card prints after its practise link
    const notes = LESSONS.flatMap((L) =>
      L.pr.link?.note === undefined ? [] : [[L.n, L.pr.link.note] as const],
    )

    // Assert
    expect(notes.length).toBeGreaterThan(0)
    for (const [n, note] of notes) {
      expect(note, `lesson ${n}`).not.toMatch(
        /needs|slug|deep link|launch|durationSec|placeholder|for now|first visit/i,
      )
    }
  })

  it('gives every live lesson a reading time, and a lesson coming later none', () => {
    for (const L of LESSONS) {
      // Act
      const hasTime = L.minutes !== undefined

      // Assert
      expect(hasTime, `lesson ${L.n}`).toBe(L.page !== undefined)
    }
  })
})

describe('a draft lesson (drafts.ts)', () => {
  /** The season as a build with drafts shown ("1") or hidden ("0") reads it. */
  async function seasonBuilt(drafts: '1' | '0'): Promise<typeof Season> {
    vi.stubEnv('VITE_DRAFT_LESSONS', drafts)
    vi.resetModules()
    return import('./season')
  }

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('is live where the build shows drafts, with its page and its fifteen minutes', async () => {
    // Act
    const season = await seasonBuilt('1')

    // Assert
    const L = season.LESSONS[3]
    expect([L.page, L.minutes, L.film]).toEqual(['/learn/03', 15, undefined])
  })

  it('leaves a live lesson with no film live in either build: Lesson 4', async () => {
    for (const drafts of ['1', '0'] as const) {
      // Act
      const season = await seasonBuilt(drafts)

      // Assert
      const L = season.LESSONS[4]
      expect([L.page, L.minutes, L.film], drafts).toEqual([
        '/learn/04',
        10,
        undefined,
      ])
      expect(L.pr.link?.href, drafts).toBe('/pitch-training?lesson=04')
    }
  })

  it('is coming later, with no page and no reading time, where the build hides drafts', async () => {
    // Act
    const season = await seasonBuilt('0')

    // Assert: exactly what the season map said before the page existed
    const L = season.LESSONS[3]
    expect([L.page, L.minutes]).toEqual([undefined, undefined])
    expect(season.LESSONS[1].page).toBe('/learn/01')
  })

  it('reads Lesson 5 as live, its seventeen minutes and its page, where drafts are shown', async () => {
    // Act
    const season = await seasonBuilt('1')

    // Assert
    const L = season.LESSONS[5]
    expect([L.page, L.minutes, L.film]).toEqual(['/learn/05', 17, undefined])
  })

  it("folds Lesson 5 to a lesson coming later where drafts are hidden, its practise link and the team's notes kept", async () => {
    // Act
    const season = await seasonBuilt('0')

    // Assert: Voice Mirror is live, so the link stays; the page does not
    const L = season.LESSONS[5]
    expect([L.page, L.minutes]).toEqual([undefined, undefined])
    expect(L.pr.link?.href).toBe('/mirror?lesson=05')
    expect(L.pr.needs).toBe(
      'Long Note with a fixed 10 or 15 s length (durationSec)',
    )
  })
})
