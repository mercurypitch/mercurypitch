// ============================================================
// Lesson film tests — a lesson offers Watch only once its film has sources
// ============================================================

import { describe, expect, it } from 'vitest'
import './browser-doubles.test-fixtures'
import { cardActions } from './explorer'
import type { FilmRegistry, FilmSources } from './films'
import { filmSources, filmState } from './films'
import { lessonViews } from './lesson-state'
import type { Lesson } from './season'
import { LESSONS } from './season'

const SOURCES: FilmSources = {
  hd: 'https://films.example.r2.dev/lesson-01-1080p.mp4',
  sd: 'https://films.example.r2.dev/lesson-01-720p.mp4',
}

/** Where lesson `L`'s card on its own page sends Watch, if it offers it at all. */
function watchLinks(L: Lesson): (string | null)[] {
  const season = LESSONS.map((M) => (M.n === L.n ? L : M))
  const viewer = { done: new Set<number>(), steps: {}, current: L.n }
  const box = document.createElement('div')
  box.innerHTML = cardActions(lessonViews(season, viewer)[L.n], L.n)
  return Array.from(box.querySelectorAll('a[href$="#watch"]'), (a) =>
    a.getAttribute('href'),
  )
}

describe('filmState', () => {
  it('reads a film with sources as published, one without as in production, and an unlisted lesson as having none', () => {
    // Arrange
    const films: FilmRegistry = { 1: SOURCES, 2: null }

    // Act
    const states = [1, 2, 3].map((n) => filmState(n, films))

    // Assert
    expect(states).toEqual(['published', 'production', undefined])
  })
})

describe('filmSources', () => {
  it("hands a lesson's page its sources, and null while there are none", () => {
    // Arrange
    const films: FilmRegistry = { 1: SOURCES, 2: null }

    // Act
    const sources = [1, 2, 3].map((n) => filmSources(n, films))

    // Assert
    expect(sources).toEqual([SOURCES, null, null])
  })
})

describe('Watch on a lesson card', () => {
  it('appears the moment the film has sources, and not before', () => {
    // Arrange
    const before = { ...LESSONS[1], film: filmState(1, { 1: null }) }
    const after = { ...LESSONS[1], film: filmState(1, { 1: SOURCES }) }

    // Act
    const offered = [watchLinks(before), watchLinks(after)]

    // Assert
    expect(offered).toEqual([[], ['#watch']])
  })

  it.each(LESSONS.map((L) => [L.n, L] as const))(
    'follows films.ts for Lesson %i: offered only if its sources are set',
    (n, L) => {
      // Act
      const offered = watchLinks(L)

      // Assert
      expect(offered).toEqual(filmSources(n) === null ? [] : ['#watch'])
    },
  )

  it("takes every lesson's film from films.ts, so no entry can claim a film that cannot play", () => {
    // Act
    const films = LESSONS.map((L) => [L.n, L.film])

    // Assert
    expect(films).toEqual(LESSONS.map((L) => [L.n, filmState(L.n)]))
  })
})
