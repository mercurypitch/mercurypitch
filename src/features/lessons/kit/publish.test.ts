// ============================================================
// Lesson publishing tests — which lessons are live for the state a page was served with
// ============================================================

import { describe, expect, it } from 'vitest'
import { DRAFT_LESSONS } from './drafts'
import type { PageState } from './publish'
import { defaultPageState, isLive, isPublished, lessonOfHref, pageStateJson, parsePageState, readingHolds, readingLesson, seasonFor, } from './publish'
import type { Lesson } from './season'
import { LESSONS } from './season'
import { withNoPage } from './season.test-fixtures'
import { LESSONS_2 } from './season-2'

const served = (lessons: PageState['lessons'], drafts = false): PageState => ({
  ...defaultPageState(drafts),
  lessons,
})

// Lesson 5 waits on a sign-off (drafts.ts); Lessons 1 to 4 are released.
describe('isPublished', () => {
  it('publishes a released lesson and holds a draft back where drafts are', () => {
    // Act + Assert
    expect(DRAFT_LESSONS[5]).toBeDefined()
    expect(isPublished(2, defaultPageState(false))).toBe(true)
    expect(isPublished(5, defaultPageState(false))).toBe(false)
    expect(isPublished(5, defaultPageState(true))).toBe(true)
  })

  it("takes the console's override over either default", () => {
    // Act + Assert
    expect(isPublished(3, served({ 3: { published: true } }))).toBe(true)
    expect(isPublished(3, served({ 3: { published: false } }, true))).toBe(
      false,
    )
    expect(isPublished(2, served({ 2: { published: false } }, true))).toBe(
      false,
    )
  })

  it('reads an override that sets only the hook as no word on publishing', () => {
    expect(isPublished(5, served({ 5: { hook: 'steady' } }))).toBe(false)
    expect(isPublished(2, served({ 2: { hook: 'figures' } }))).toBe(true)
  })
})

describe('isLive', () => {
  it('needs a page as well: a lesson not written yet is coming later whatever the console says', () =>
    // Arrange: a lesson with no page, published by the console
    withNoPage(({ n }) => {
      const state = served({ [n]: { published: true } })

      // Act + Assert
      expect(isLive(n, LESSONS, state)).toBe(false)
      expect(isLive(2, LESSONS, state)).toBe(true)
      expect(isLive(99, LESSONS, state)).toBe(false)
    }))
})

describe('seasonFor', () => {
  it('draws a lesson held back exactly as a lesson not written yet: no page, no reading time', () => {
    // Act
    const season = seasonFor(LESSONS, served({ 2: { published: false } }))

    // Assert: Lesson 2 by the console, Lesson 5 by its draft line
    const [L2, L5] = [season[2], season[5]]
    expect([L2.page, L2.minutes, L5.page, L5.minutes]).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ])
    expect(L2.title).toBe('Twelve notes')
    expect(L5.pr).toBe(LESSONS[5].pr)
    expect(season[1]).toBe(LESSONS[1])
  })

  it('draws Lesson 8 held back with neither its page nor its reading time', () => {
    // Act
    const season = seasonFor(LESSONS, served({ 8: { published: false } }))

    // Assert
    expect([season[8].page, season[8].minutes]).toEqual([undefined, undefined])
    expect([LESSONS[8].page, LESSONS[8].minutes]).toEqual(['/learn/08', 16])
  })

  it('draws Lesson 9 held back with neither its page nor its reading time', () => {
    // Act
    const season = seasonFor(LESSONS, served({ 9: { published: false } }))

    // Assert
    expect([season[9].page, season[9].minutes]).toEqual([undefined, undefined])
    expect([LESSONS[9].page, LESSONS[9].minutes]).toEqual(['/learn/09', 16])
  })

  it('keeps Lesson 9, a draft, its page and its reading time where drafts are shown', () => {
    // Act
    const season = seasonFor(LESSONS, defaultPageState(true))

    // Assert
    expect(DRAFT_LESSONS[9]).toBeDefined()
    expect([season[9].page, season[9].minutes]).toEqual(['/learn/09', 16])
  })

  it('draws Lesson 10 held back, by its draft line or by the console, with neither its page nor its reading time', () => {
    // Act: a draft where drafts are held back, and one the console holds back
    const seasons = [
      seasonFor(LESSONS, defaultPageState(false)),
      seasonFor(LESSONS, served({ 10: { published: false } }, true)),
    ]

    // Assert
    for (const season of seasons)
      expect([season[10].page, season[10].minutes]).toEqual([
        undefined,
        undefined,
      ])
    expect([LESSONS[10].page, LESSONS[10].minutes]).toEqual(['/learn/10', 17])
  })

  it('keeps Lesson 10, a draft, its page and its reading time where drafts are shown', () => {
    // Act
    const season = seasonFor(LESSONS, defaultPageState(true))

    // Assert
    expect(DRAFT_LESSONS[10]).toBeDefined()
    expect([season[10].page, season[10].minutes]).toEqual(['/learn/10', 17])
  })

  it('draws Lesson 11 held back, by its draft line or by the console, with neither its page nor its reading time', () => {
    // Act: a draft where drafts are held back, and one the console holds back
    const seasons = [
      seasonFor(LESSONS, defaultPageState(false)),
      seasonFor(LESSONS, served({ 11: { published: false } }, true)),
    ]

    // Assert: Lesson 11's WEB-SPEC, Tests 12
    for (const season of seasons)
      expect([season[11].page, season[11].minutes]).toEqual([
        undefined,
        undefined,
      ])
    expect([LESSONS[11].page, LESSONS[11].minutes]).toEqual(['/learn/11', 16])
  })

  it('keeps Lesson 11, a draft, its page and its reading time where drafts are shown', () => {
    // Act
    const season = seasonFor(LESSONS, defaultPageState(true))

    // Assert
    expect(DRAFT_LESSONS[11]).toBe(
      "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",
    )
    expect([season[11].page, season[11].minutes]).toEqual(['/learn/11', 16])
  })

  it('draws Lesson 12 held back, by its draft line or by the console, with neither its page nor its reading time', () => {
    // Act: a draft where drafts are held back, and one the console holds back
    const seasons = [
      seasonFor(LESSONS, defaultPageState(false)),
      seasonFor(LESSONS, served({ 12: { published: false } }, true)),
    ]

    // Assert: Lesson 12's WEB-SPEC, Tests 12
    for (const season of seasons)
      expect([season[12].page, season[12].minutes]).toEqual([
        undefined,
        undefined,
      ])
    expect([LESSONS[12].page, LESSONS[12].minutes]).toEqual(['/learn/12', 15])
  })

  it('keeps Lesson 12, a draft, its page and its reading time where drafts are shown', () => {
    // Act
    const season = seasonFor(LESSONS, defaultPageState(true))

    // Assert
    expect(DRAFT_LESSONS[12]).toBe(
      "Lesson 10's page at /learn/10, and the vocal coach's look at the sung checkpoint",
    )
    expect([season[12].page, season[12].minutes]).toEqual(['/learn/12', 15])
  })

  it('draws Lesson 13 held back, by its draft line or by the console, with neither its page nor its reading time', () => {
    // Act: a draft where drafts are held back, and one the console holds back
    const seasons = [
      seasonFor(LESSONS, defaultPageState(false)),
      seasonFor(LESSONS, served({ 13: { published: false } }, true)),
    ]

    // Assert: Lesson 13's WEB-SPEC, Tests 13
    for (const season of seasons)
      expect([season[13].page, season[13].minutes]).toEqual([
        undefined,
        undefined,
      ])
    expect([LESSONS[13].page, LESSONS[13].minutes]).toEqual(['/learn/13', 16])
  })

  it('keeps Lesson 13, a draft, its page and its reading time where drafts are shown', () => {
    // Act
    const season = seasonFor(LESSONS, defaultPageState(true))

    // Assert
    expect(DRAFT_LESSONS[13]).toBe(
      "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",
    )
    expect([season[13].page, season[13].minutes]).toEqual(['/learn/13', 16])
  })

  it('draws Lesson 14 held back, by its draft line or by the console, with neither its page nor its reading time', () => {
    // Act: a draft where drafts are held back, and one the console holds back
    const seasons = [
      seasonFor(LESSONS, defaultPageState(false)),
      seasonFor(LESSONS, served({ 14: { published: false } }, true)),
    ]

    // Assert
    for (const season of seasons)
      expect([season[14].page, season[14].minutes]).toEqual([
        undefined,
        undefined,
      ])
    expect([LESSONS[14].page, LESSONS[14].minutes]).toEqual(['/learn/14', 18])
  })

  it('keeps Lesson 14, a draft, its page and its reading time where drafts are shown', () => {
    // Act
    const season = seasonFor(LESSONS, defaultPageState(true))

    // Assert
    expect(DRAFT_LESSONS[14]).toBe(
      "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",
    )
    expect([season[14].page, season[14].minutes]).toEqual(['/learn/14', 18])
  })

  it("draws Lesson 15, Season 2's first, held back by its draft line or by the console, with neither its page nor its reading time", () => {
    // Act: a draft where drafts are held back, and one the console holds back
    const seasons = [
      seasonFor(LESSONS_2, defaultPageState(false)),
      seasonFor(LESSONS_2, served({ 15: { published: false } }, true)),
    ]
    const at = (season: Lesson[]) => season.find((L) => L.n === 15)

    // Assert: Lesson 15's WEB-SPEC, What the kit and the app still need, item 2
    for (const season of seasons)
      expect([at(season)?.page, at(season)?.minutes]).toEqual([
        undefined,
        undefined,
      ])
    expect(isLive(15, LESSONS_2, defaultPageState(false))).toBe(false)
  })

  it('keeps Lesson 15, a draft, its page and its reading time where drafts are shown', () => {
    // Act
    const season = seasonFor(LESSONS_2, defaultPageState(true))
    const L15 = season.find((L) => L.n === 15)

    // Assert
    expect(DRAFT_LESSONS[15]).toBe(
      "the vocal coach's look at Sing it (MASTER-PLAN § 12 item 8)",
    )
    expect([L15?.page, L15?.minutes]).toEqual(['/learn/15', 15])
    expect(isLive(15, LESSONS_2, defaultPageState(true))).toBe(true)
  })

  it('holds Lesson 16 back by its draft line or by the console, and keeps its page and reading time where drafts are shown', () => {
    // Act
    const held = [
      seasonFor(LESSONS_2, defaultPageState(false)),
      seasonFor(LESSONS_2, served({ 16: { published: false } }, true)),
    ]
    const shown = seasonFor(LESSONS_2, defaultPageState(true))
    const at = (season: Lesson[]) => season.find((L) => L.n === 16)

    // Assert: Lesson 16's WEB-SPEC, What the kit and the app still need, item 2
    for (const season of held)
      expect([at(season)?.page, at(season)?.minutes]).toEqual([
        undefined,
        undefined,
      ])
    expect([at(shown)?.page, at(shown)?.minutes]).toEqual(['/learn/16', 15])
    expect(isLive(16, LESSONS_2, defaultPageState(false))).toBe(false)
    expect(isLive(16, LESSONS_2, defaultPageState(true))).toBe(true)
  })

  it('holds Lesson 17 back by its draft line or by the console, and keeps its page and reading time where drafts are shown', () => {
    // Act
    const held = [
      seasonFor(LESSONS_2, defaultPageState(false)),
      seasonFor(LESSONS_2, served({ 17: { published: false } }, true)),
    ]
    const shown = seasonFor(LESSONS_2, defaultPageState(true))
    const at = (season: Lesson[]) => season.find((L) => L.n === 17)

    // Assert: Lesson 17's WEB-SPEC, What the kit and the app still need, item 2
    for (const season of held)
      expect([at(season)?.page, at(season)?.minutes]).toEqual([
        undefined,
        undefined,
      ])
    expect([at(shown)?.page, at(shown)?.minutes]).toEqual(['/learn/17', 16])
    expect(isLive(17, LESSONS_2, defaultPageState(false))).toBe(false)
    expect(isLive(17, LESSONS_2, defaultPageState(true))).toBe(true)
  })

  it('holds Lesson 18 back by its draft line or by the console, and keeps its page and reading time where drafts are shown', () => {
    // Act
    const held = [
      seasonFor(LESSONS_2, defaultPageState(false)),
      seasonFor(LESSONS_2, served({ 18: { published: false } }, true)),
    ]
    const shown = seasonFor(LESSONS_2, defaultPageState(true))
    const at = (season: Lesson[]) => season.find((L) => L.n === 18)

    // Assert: Lesson 18's WEB-SPEC, What the kit and the app still need, item 2
    for (const season of held)
      expect([at(season)?.page, at(season)?.minutes]).toEqual([
        undefined,
        undefined,
      ])
    expect([at(shown)?.page, at(shown)?.minutes]).toEqual(['/learn/18', 16])
    expect(isLive(18, LESSONS_2, defaultPageState(false))).toBe(false)
    expect(isLive(18, LESSONS_2, defaultPageState(true))).toBe(true)
  })

  it('holds Lesson 19 back by its draft line or by the console, and keeps its page and reading time where drafts are shown', () => {
    // Act
    const held = [
      seasonFor(LESSONS_2, defaultPageState(false)),
      seasonFor(LESSONS_2, served({ 19: { published: false } }, true)),
    ]
    const shown = seasonFor(LESSONS_2, defaultPageState(true))
    const at = (season: Lesson[]) => season.find((L) => L.n === 19)

    // Assert: Lesson 19's WEB-SPEC, What the kit and the app still need, item 2
    for (const season of held)
      expect([at(season)?.page, at(season)?.minutes]).toEqual([
        undefined,
        undefined,
      ])
    expect([at(shown)?.page, at(shown)?.minutes]).toEqual(['/learn/19', 12])
    expect(isLive(19, LESSONS_2, defaultPageState(false))).toBe(false)
    expect(isLive(19, LESSONS_2, defaultPageState(true))).toBe(true)
  })

  it('holds Lesson 20 back by its draft line or by the console, and keeps its page and reading time where drafts are shown', () => {
    // Act
    const held = [
      seasonFor(LESSONS_2, defaultPageState(false)),
      seasonFor(LESSONS_2, served({ 20: { published: false } }, true)),
    ]
    const shown = seasonFor(LESSONS_2, defaultPageState(true))
    const at = (season: Lesson[]) => season.find((L) => L.n === 20)

    // Assert: Lesson 20's WEB-SPEC, What the kit and the app still need, item 2
    for (const season of held)
      expect([at(season)?.page, at(season)?.minutes]).toEqual([
        undefined,
        undefined,
      ])
    expect([at(shown)?.page, at(shown)?.minutes]).toEqual(['/learn/20', 15])
    expect(isLive(20, LESSONS_2, defaultPageState(false))).toBe(false)
    expect(isLive(20, LESSONS_2, defaultPageState(true))).toBe(true)
  })

  it('holds Lesson 22 back by its draft line or by the console, and keeps its page and reading time where drafts are shown', () => {
    // Act
    const held = [
      seasonFor(LESSONS_2, defaultPageState(false)),
      seasonFor(LESSONS_2, served({ 22: { published: false } }, true)),
    ]
    const shown = seasonFor(LESSONS_2, defaultPageState(true))
    const at = (season: Lesson[]) => season.find((L) => L.n === 22)

    // Assert: Lesson 22's WEB-SPEC, What the kit and the app still need, item 2
    for (const season of held)
      expect([at(season)?.page, at(season)?.minutes]).toEqual([
        undefined,
        undefined,
      ])
    expect([at(shown)?.page, at(shown)?.minutes]).toEqual(['/learn/22', 15])
    expect(isLive(22, LESSONS_2, defaultPageState(false))).toBe(false)
    expect(isLive(22, LESSONS_2, defaultPageState(true))).toBe(true)
  })

  it('holds Lesson 23 back by its draft line or by the console, and keeps its page and reading time where drafts are shown', () => {
    // Act
    const held = [
      seasonFor(LESSONS_2, defaultPageState(false)),
      seasonFor(LESSONS_2, served({ 23: { published: false } }, true)),
    ]
    const shown = seasonFor(LESSONS_2, defaultPageState(true))
    const at = (season: Lesson[]) => season.find((L) => L.n === 23)

    // Assert: Lesson 23's WEB-SPEC, What the kit and the app still need, item 2
    for (const season of held)
      expect([at(season)?.page, at(season)?.minutes]).toEqual([
        undefined,
        undefined,
      ])
    expect([at(shown)?.page, at(shown)?.minutes]).toEqual(['/learn/23', 14])
    expect(isLive(23, LESSONS_2, defaultPageState(false))).toBe(false)
    expect(isLive(23, LESSONS_2, defaultPageState(true))).toBe(true)
  })

  it('holds Lesson 21 back by its draft line or by the console, and keeps its page and reading time where drafts are shown', () => {
    // Act
    const held = [
      seasonFor(LESSONS_2, defaultPageState(false)),
      seasonFor(LESSONS_2, served({ 21: { published: false } }, true)),
    ]
    const shown = seasonFor(LESSONS_2, defaultPageState(true))
    const at = (season: Lesson[]) => season.find((L) => L.n === 21)

    // Assert: Lesson 21's WEB-SPEC, What the kit and the app still need, item 3
    for (const season of held)
      expect([at(season)?.page, at(season)?.minutes]).toEqual([
        undefined,
        undefined,
      ])
    expect([at(shown)?.page, at(shown)?.minutes]).toEqual(['/learn/21', 15])
    expect(isLive(21, LESSONS_2, defaultPageState(false))).toBe(false)
    expect(isLive(21, LESSONS_2, defaultPageState(true))).toBe(true)
  })

  it('holds Lesson 24 back by its draft line or by the console, and keeps its page and reading time where drafts are shown', () => {
    // Act
    const held = [
      seasonFor(LESSONS_2, defaultPageState(false)),
      seasonFor(LESSONS_2, served({ 24: { published: false } }, true)),
    ]
    const shown = seasonFor(LESSONS_2, defaultPageState(true))
    const at = (season: Lesson[]) => season.find((L) => L.n === 24)

    // Assert: Lesson 24's WEB-SPEC, What the kit and the app still need, item 2
    for (const season of held)
      expect([at(season)?.page, at(season)?.minutes]).toEqual([
        undefined,
        undefined,
      ])
    expect([at(shown)?.page, at(shown)?.minutes]).toEqual(['/learn/24', 16])
    expect(isLive(24, LESSONS_2, defaultPageState(false))).toBe(false)
    expect(isLive(24, LESSONS_2, defaultPageState(true))).toBe(true)
  })

  it('holds Lesson 25 back by its draft line or by the console, and keeps its page and reading time where drafts are shown', () => {
    // Act
    const held = [
      seasonFor(LESSONS_2, defaultPageState(false)),
      seasonFor(LESSONS_2, served({ 25: { published: false } }, true)),
    ]
    const shown = seasonFor(LESSONS_2, defaultPageState(true))
    const at = (season: Lesson[]) => season.find((L) => L.n === 25)

    // Assert: Lesson 25's WEB-SPEC, What the kit and the app still need, item 2
    for (const season of held)
      expect([at(season)?.page, at(season)?.minutes]).toEqual([
        undefined,
        undefined,
      ])
    expect([at(shown)?.page, at(shown)?.minutes]).toEqual(['/learn/25', 15])
    expect(isLive(25, LESSONS_2, defaultPageState(false))).toBe(false)
    expect(isLive(25, LESSONS_2, defaultPageState(true))).toBe(true)
  })

  it('holds Lesson 26 back by its draft line or by the console, and keeps its page and reading time where drafts are shown', () => {
    // Act
    const held = [
      seasonFor(LESSONS_2, defaultPageState(false)),
      seasonFor(LESSONS_2, served({ 26: { published: false } }, true)),
    ]
    const shown = seasonFor(LESSONS_2, defaultPageState(true))
    const at = (season: Lesson[]) => season.find((L) => L.n === 26)

    // Assert: Lesson 26's WEB-SPEC, What the kit and the app still need, item 2
    for (const season of held)
      expect([at(season)?.page, at(season)?.minutes]).toEqual([
        undefined,
        undefined,
      ])
    expect([at(shown)?.page, at(shown)?.minutes]).toEqual(['/learn/26', 16])
    expect(isLive(26, LESSONS_2, defaultPageState(false))).toBe(false)
    expect(isLive(26, LESSONS_2, defaultPageState(true))).toBe(true)
  })

  it('holds Lesson 27 back by its draft line or by the console, and keeps its page and reading time where drafts are shown', () => {
    // Act
    const held = [
      seasonFor(LESSONS_2, defaultPageState(false)),
      seasonFor(LESSONS_2, served({ 27: { published: false } }, true)),
    ]
    const shown = seasonFor(LESSONS_2, defaultPageState(true))
    const at = (season: Lesson[]) => season.find((L) => L.n === 27)

    // Assert: Lesson 27's WEB-SPEC, What the kit and the app still need, item 2
    for (const season of held)
      expect([at(season)?.page, at(season)?.minutes]).toEqual([
        undefined,
        undefined,
      ])
    expect([at(shown)?.page, at(shown)?.minutes]).toEqual(['/learn/27', 15])
    expect(isLive(27, LESSONS_2, defaultPageState(false))).toBe(false)
    expect(isLive(27, LESSONS_2, defaultPageState(true))).toBe(true)
  })

  it('holds Lesson 28 back by its draft line or by the console, and keeps its page and reading time where drafts are shown', () => {
    // Act
    const held = [
      seasonFor(LESSONS_2, defaultPageState(false)),
      seasonFor(LESSONS_2, served({ 28: { published: false } }, true)),
    ]
    const shown = seasonFor(LESSONS_2, defaultPageState(true))
    const at = (season: Lesson[]) => season.find((L) => L.n === 28)

    // Assert: Lesson 28's WEB-SPEC, What the kit and the app still need, item 2
    for (const season of held)
      expect([at(season)?.page, at(season)?.minutes]).toEqual([
        undefined,
        undefined,
      ])
    expect([at(shown)?.page, at(shown)?.minutes]).toEqual(['/learn/28', 19])
    expect(isLive(28, LESSONS_2, defaultPageState(false))).toBe(false)
    expect(isLive(28, LESSONS_2, defaultPageState(true))).toBe(true)
  })

  it('keeps every page where everything is published, the same objects as the season', () => {
    // Act
    const season = seasonFor(LESSONS, defaultPageState(true))

    // Assert
    expect(season).toEqual(LESSONS)
    season.forEach((L, i) => expect(L, `${i}`).toBe(LESSONS[i]))
  })

  it('gives each lesson the hook its override picks, and its default for an id it lacks', () => {
    // Act
    const season = seasonFor(
      LESSONS,
      served({ 3: { published: true, hook: 'figures' }, 7: { hook: 'gone' } }),
    )

    // Assert
    expect(season[3].hook).toBe(LESSONS[3].hookAlts?.[0]?.text)
    expect(season[3].page).toBe('/learn/03')
    expect(season[7].hook).toBe(LESSONS[7].hook)
  })

  it('gives each lesson the tease its override picks, and its default for an id it lacks', () => {
    // Arrange: no lesson has a second tease yet, so one is made up here
    const L: Lesson = {
      ...LESSONS[2],
      teaseAlts: [{ id: 'keys', text: 'Five more keys.' }],
    }

    // Act
    const [picked] = seasonFor([L], served({ 2: { tease: 'keys' } }))
    const [unknown] = seasonFor([L], served({ 2: { tease: 'gone' } }))

    // Assert
    expect(picked.tease).toBe('Five more keys.')
    expect(unknown.tease).toBe(LESSONS[2].tease)
    expect(unknown).toBe(L)
  })
})

describe("a page's state", () => {
  it('reads as the API answers it, with what the tag says of drafts', () => {
    // Act
    const state = parsePageState(
      {
        version: 1,
        updatedAt: null,
        lessons: { 3: { published: true, x: 1 } },
        drafts: true,
      },
      false,
    )

    // Assert
    expect(state).toEqual({
      version: 1,
      updatedAt: null,
      lessons: { 3: { published: true } },
      drafts: true,
    })
  })

  it("takes the reader's default for drafts from a tag that does not say, and refuses another version", () => {
    expect(parsePageState({ version: 1, lessons: {} }, true)?.drafts).toBe(true)
    expect(
      parsePageState({ version: 1, lessons: {}, drafts: 'yes' }, false)?.drafts,
    ).toBe(false)
    expect(parsePageState({ version: 2, lessons: {} }, true)).toBeNull()
    expect(parsePageState('state', true)).toBeNull()
  })

  it('is written with every < escaped, so no value can close its script, and reads back the same', () => {
    // Arrange
    const state: PageState = {
      ...served({ 3: { published: true } }),
      updatedAt: '</script><b>',
    }

    // Act
    const text = pageStateJson(state)

    // Assert
    expect(text).not.toContain('<')
    expect(parsePageState(JSON.parse(text), false)).toEqual(state)
  })
})

describe('lessonOfHref', () => {
  it('reads a lesson from every address a page links one by', () => {
    expect(
      [
        '/learn/03',
        '/learn/03.html',
        '/learn/03/',
        '/learn/03#step-2',
        '/learn/03?x=1',
      ].map(lessonOfHref),
    ).toEqual([3, 3, 3, 3, 3])
  })

  it('reads none from any other address', () => {
    expect(
      [
        '/learn/3',
        '/learn/',
        '/learn/lesson-01-og.jpg',
        'https://mercurypitch.com/learn/03',
        '#explorer',
        '/mirror?lesson=03',
      ].map(lessonOfHref),
    ).toEqual([null, null, null, null, null, null])
  })
})

describe("a page's readings of another lesson's state", () => {
  it('reads its lesson from one or two digits only', () => {
    expect(['5', '05', '12', '123', 'x', '', null].map(readingLesson)).toEqual([
      5,
      5,
      12,
      null,
      null,
      null,
      null,
    ])
  })

  it('holds "live" while the lesson is live and "planned" otherwise', () => {
    // Arrange: Lesson 5 held back, Lesson 2 live
    const state = defaultPageState(false)

    // Act + Assert
    expect(readingHolds('live', 2, LESSONS, state)).toBe(true)
    expect(readingHolds('planned', 2, LESSONS, state)).toBe(false)
    expect(readingHolds('live', 5, LESSONS, state)).toBe(false)
    expect(readingHolds('planned', 5, LESSONS, state)).toBe(true)
  })
})
