// ============================================================
// Lesson publishing tests — which lessons are live for the state a page was served with
// ============================================================

import { describe, expect, it } from 'vitest'
import { DRAFT_LESSONS } from './drafts'
import type { PageState } from './publish'
import { defaultPageState, isLive, isPublished, lessonOfHref, pageStateJson, parsePageState, readingHolds, readingLesson, seasonFor, } from './publish'
import type { Lesson } from './season'
import { LESSONS } from './season'

const served = (lessons: PageState['lessons'], drafts = false): PageState => ({
  ...defaultPageState(drafts),
  lessons,
})

// Lesson 3 waits on a sign-off (drafts.ts); Lessons 1 and 2 are released.
describe('isPublished', () => {
  it('publishes a released lesson and holds a draft back where drafts are', () => {
    // Act + Assert
    expect(DRAFT_LESSONS[3]).toBeDefined()
    expect(isPublished(2, defaultPageState(false))).toBe(true)
    expect(isPublished(3, defaultPageState(false))).toBe(false)
    expect(isPublished(3, defaultPageState(true))).toBe(true)
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
    expect(isPublished(3, served({ 3: { hook: 'figures' } }))).toBe(false)
    expect(isPublished(2, served({ 2: { hook: 'figures' } }))).toBe(true)
  })
})

describe('isLive', () => {
  it('needs a page as well: a lesson not written yet is coming later whatever the console says', () => {
    // Arrange: Lesson 9 has no page
    const state = served({ 9: { published: true } })

    // Act + Assert
    expect(LESSONS[9].page).toBeUndefined()
    expect(isLive(9, LESSONS, state)).toBe(false)
    expect(isLive(2, LESSONS, state)).toBe(true)
    expect(isLive(99, LESSONS, state)).toBe(false)
  })
})

describe('seasonFor', () => {
  it('draws a lesson held back exactly as a lesson not written yet: no page, no reading time', () => {
    // Act
    const season = seasonFor(LESSONS, served({ 2: { published: false } }))

    // Assert
    const [L2, L3] = [season[2], season[3]]
    expect([L2.page, L2.minutes, L3.page, L3.minutes]).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ])
    expect(L2.title).toBe('Twelve notes')
    expect(L3.pr).toBe(LESSONS[3].pr)
    expect(season[1]).toBe(LESSONS[1])
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
      teaseAlts: [{ id: 'keys', text: 'Five more keys.', note: 'test' }],
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
    // Arrange: Lesson 3 held back, Lesson 2 live
    const state = defaultPageState(false)

    // Act + Assert
    expect(readingHolds('live', 2, LESSONS, state)).toBe(true)
    expect(readingHolds('planned', 2, LESSONS, state)).toBe(false)
    expect(readingHolds('live', 3, LESSONS, state)).toBe(false)
    expect(readingHolds('planned', 3, LESSONS, state)).toBe(true)
  })
})
