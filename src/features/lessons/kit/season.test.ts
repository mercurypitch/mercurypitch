// ============================================================
// Season map tests — what a lesson builds on, opens and lights
// ============================================================

import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as Season from './season'
import { ancestors, EDGES, lessonPath, LESSONS, PREREQ, unlocks, } from './season'

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

    // Assert: 8 needs 1 directly
    expect(opened).toEqual([2, 3, 8])
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
    expect(lit).toEqual({ '1-2': 'out', '1-3': 'out', '1-8': 'out' })
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

  it('gives Lesson 7 its page, its sixteen minutes and its range test link, after Lesson 3', () => {
    // Act
    const L = LESSONS[7]

    // Assert: Lesson 7's WEB-SPEC, Tests 11
    expect([L.page, L.minutes, L.film]).toEqual(['/learn/07', 16, undefined])
    expect(L.pr.link?.href).toBe('/vocal-range-test?lesson=07')
    expect(EDGES).toContainEqual([3, 7])
  })

  it('gives each lesson its copy from lesson-copy.ts beside its own default hook', () => {
    // Act
    const L = LESSONS[7]

    // Assert: the hook proposed in CURIOSITY-MOMENTS § 2, the current wording kept
    expect(L.hook).toBe(
      'Why is your comfortable middle worth more than your highest note?',
    )
    expect(L.hookAlts?.map((v) => v.text)).toEqual([
      'How many notes can your voice reach, and why is the comfortable middle worth more than the extremes?',
    ])
    expect(L.tease).toBe('Books often give a voice type two octaves.')
    expect(LESSONS[1].tease).toBeUndefined()
  })
})

describe('a draft lesson (drafts.ts)', () => {
  /** The season as a build with drafts shown ("1") or held back ("0") reads it. */
  async function seasonBuilt(drafts: '1' | '0'): Promise<typeof Season> {
    vi.stubEnv('VITE_DRAFT_LESSONS', drafts)
    vi.resetModules()
    return import('./season')
  }

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("keeps its page and its reading time in every build: whether it is live is publish.ts's", async () => {
    for (const drafts of ['1', '0'] as const) {
      // Act
      const season = await seasonBuilt(drafts)

      // Assert: Lessons 3, 4 and 5 are drafts, each with its page and no film
      const [L3, L4, L5] = [3, 4, 5].map((n) => season.LESSONS[n])
      expect([L3.page, L3.minutes, L3.film], drafts).toEqual([
        '/learn/03',
        16,
        undefined,
      ])
      expect([L4.page, L4.minutes, L4.film], drafts).toEqual([
        '/learn/04',
        14,
        undefined,
      ])
      expect([L5.page, L5.minutes, L5.film], drafts).toEqual([
        '/learn/05',
        18,
        undefined,
      ])
      expect(L4.pr.link?.href, drafts).toBe('/pitch-training?lesson=04')
      expect(L5.pr.link?.href, drafts).toBe('/mirror?lesson=05')
    }
  })

  it("keeps Lesson 8's page, its reading time and its Learn panel link in every build", async () => {
    for (const drafts of ['1', '0'] as const) {
      // Act
      const season = await seasonBuilt(drafts)

      // Assert: a draft, as Lesson 3 is, with no film
      const L8 = season.LESSONS[8]
      expect([L8.page, L8.minutes, L8.film], drafts).toEqual([
        '/learn/08',
        16,
        undefined,
      ])
      expect(L8.pr.link?.href, drafts).toBe(
        '/drum-night?drawer=learn&lesson=08',
      )
    }
  })

  it("keeps Lesson 9's page, its reading time and its practice link in every build", async () => {
    for (const drafts of ['1', '0'] as const) {
      // Act
      const season = await seasonBuilt(drafts)

      // Assert: a draft, as Lesson 3 is, with no film
      const L9 = season.LESSONS[9]
      expect([L9.page, L9.minutes, L9.film], drafts).toEqual([
        '/learn/09',
        16,
        undefined,
      ])
      expect(L9.pr.link?.href, drafts).toBe('/pitch-training?lesson=09')
    }
  })

  it("keeps Lesson 10's page, its reading time and its ear drill's link in every build", async () => {
    for (const drafts of ['1', '0'] as const) {
      // Act
      const season = await seasonBuilt(drafts)

      // Assert: a draft, as Lesson 3 is, with no film; Ear Lab's Stack needs no voice
      const L10 = season.LESSONS[10]
      expect([L10.page, L10.minutes, L10.film], drafts).toEqual([
        '/learn/10',
        17,
        undefined,
      ])
      expect(L10.pr.link?.href, drafts).toBe('/ear-lab?lesson=10')
      expect(L10.pr.link?.note, drafts).toBe('then tap Stack')
      expect(L10.pr.link?.note, drafts).not.toMatch(
        /needs|slug|deep link|launch|durationSec|placeholder|for now|first visit/i,
      )
    }
  })

  it('gives every lesson page in the repository its page in the season, whichever way a build reads drafts', async () => {
    // Arrange: every learn/NN.html, as the build takes them (tools/draft-lessons.ts)
    const pages = readdirSync(resolve(__dirname, '../../../../learn'))
      .map((name) => /^(\d{2})\.html$/.exec(name)?.[1])
      .filter((nn): nn is string => nn !== undefined)

    for (const drafts of ['1', '0'] as const) {
      // Act
      const season = await seasonBuilt(drafts)

      // Assert
      expect(pages.length, drafts).toBeGreaterThanOrEqual(5)
      for (const nn of pages)
        expect(season.LESSONS[Number(nn)]?.page, `${drafts}: ${nn}`).toBe(
          `/learn/${nn}`,
        )
    }
  })

  it('opens on its hook, its alternatives kept for the admin console', async () => {
    // Act
    const season = await seasonBuilt('0')

    // Assert
    const L = season.LESSONS[3]
    expect(L.hook).toBe(
      "Asked, most students said they couldn't copy a tune. What happened when researchers tested it?",
    )
    expect(L.hookAlts?.map((v) => v.id)).toEqual(['figures', 'tested'])
    expect(season.LESSONS[5].pr.needs).toBe(
      'Long Note with a fixed 10 or 15 s length (durationSec)',
    )
  })
})

describe('PREREQ', () => {
  it('keeps Lessons 3 and 8 on Lesson 1 alone, leaving the lessons their recalls ask off the map', () => {
    // Arrange: Lesson 3's recall asks Lesson 2's questions and Lesson 8's
    // asks Lesson 6's. The owner keeps a recall off the map (25 October
    // 2026): only the admin console's warning reads them (RECALLS, in
    // admin/lessons/lesson-admin.ts).

    // Act
    const before = [PREREQ[3], PREREQ[8]]

    // Assert
    expect(before).toEqual([[1], [1]])
  })
})
