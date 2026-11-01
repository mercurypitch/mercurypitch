// ============================================================
// Learn hub tests — the season's map, read off season.ts and the lesson documents
// ============================================================
//
// These run against the repository's own hub, season and lesson documents,
// so a lesson page that is added, renamed or released changes no test. What
// the site worker does to the filled page is src/lesson-gate.test.ts's, and
// the page as a browser meets it is src/e2e/learn-hub.spec.ts's.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LESSONS, minutesSpan } from '../src/features/lessons/kit/season'
import { lessonDocument, lessonPages, lessonPath, liveByDefault, markLessonStates, } from './draft-lessons'
import type { HubLesson } from './learn-hub'
import { fillHub, HUB_DOCUMENT, hubLessons, seasonMarkup, seriesParts, } from './learn-hub'
import { lessonHeadline } from './lesson-links'

const ROOT = resolve(__dirname, '..')

const repoFile = (path: string): string =>
  readFileSync(resolve(ROOT, path), 'utf8')

const read = (html: string): Document =>
  new DOMParser().parseFromString(html, 'text/html')

const words = (el: Element | null): string =>
  (el?.textContent ?? '').replace(/\s+/g, ' ').trim()

describe('the lessons the hub lists', () => {
  const lessons = hubLessons(ROOT)
  const written = lessonPages(ROOT)

  it('are every Season 1 lesson once, in order, the trailer left out', () => {
    expect(lessons.map((L) => L.n)).toEqual(
      LESSONS.filter((L) => L.n >= 1).map((L) => L.n),
    )
  })

  it("name each lesson as its document's headline does, or as the season does while it has none", () => {
    for (const L of lessons) {
      const season = LESSONS.find((x) => x.n === L.n)
      if (written.includes(L.n)) {
        const headline = lessonHeadline(repoFile(lessonDocument(L.n)))
        expect(L.name, `Lesson ${L.n}`).toBe(headline)
        expect(L.page).toBe(lessonPath(L.n))
      } else {
        expect(L.name, `Lesson ${L.n}`).toBe(season?.title)
        expect(L.page).toBeUndefined()
      }
      expect(L.hook).toBe(season?.hook)
      expect(L.lane).toBe(season?.lane)
    }
  })

  it('carry the reading times the season gives them', () => {
    for (const L of lessons)
      expect(L.minutes, `Lesson ${L.n}`).toBe(
        LESSONS.find((x) => x.n === L.n)?.minutes,
      )
  })

  it('span their reading times from the shortest to the longest, or name the one they share', () => {
    const one: HubLesson = { n: 1, lane: 'theory', name: 'A', hook: 'B?' }
    expect(
      minutesSpan([
        { ...one, minutes: 15 },
        { ...one, minutes: 10 },
        { ...one, minutes: 17 },
      ]),
    ).toBe('10 to 17')
    expect(
      minutesSpan([{ ...one, minutes: 10 }, one, { ...one, minutes: 10 }]),
    ).toBe('10')
    expect(minutesSpan([one])).toBeNull()
    expect(minutesSpan([])).toBeNull()
  })
})

describe('the season map', () => {
  const lessons = hubLessons(ROOT)
  const map = read(seasonMarkup(lessons))

  it('lists each lesson once, in its own lane', () => {
    const listed = Array.from(map.querySelectorAll('.hub-lesson h4')).map(
      (h) => h.id,
    )
    expect(listed.sort()).toEqual(
      lessons.map((L) => `lesson-${String(L.n).padStart(2, '0')}`).sort(),
    )
    for (const L of lessons)
      expect(
        map
          .querySelector(`#lesson-${String(L.n).padStart(2, '0')}`)
          ?.closest('.hub-lane')
          ?.classList.contains(L.lane),
        `Lesson ${L.n}`,
      ).toBe(true)
  })

  it('writes both readings for a lesson with a document, and only "Coming" for one without', () => {
    for (const L of lessons) {
      const item = map
        .querySelector(`#lesson-${String(L.n).padStart(2, '0')}`)
        ?.closest('li')
      const live = item?.querySelectorAll(`[data-if-live="${L.n}"]`) ?? []
      const planned = item?.querySelector(`[data-if-planned="${L.n}"]`)
      expect(words(planned ?? null), `Lesson ${L.n}`).toBe('Coming')
      if (L.page === undefined) {
        expect(live, `Lesson ${L.n}`).toHaveLength(0)
        expect(item?.querySelector('a'), `Lesson ${L.n}`).toBeNull()
        continue
      }
      const link = item?.querySelector(`a[href="${L.page}"]`)
      const named = `Start lesson: Lesson ${L.n}, ${L.name}`
      expect(words(link ?? null), `Lesson ${L.n}`).toBe(named)
      expect(link?.closest(`[data-if-live="${L.n}"]`)).not.toBeNull()
      // a lesson whose film has a watch page links that too, in the same block
      const film =
        L.watch === undefined ? '' : ` Watch the film: Lesson ${L.n}, ${L.name}`
      expect(Array.from(live).map(words).join(' ')).toBe(
        L.minutes === undefined
          ? `${named}${film}`
          : `${L.minutes} minutes ${named}${film}`,
      )
      if (L.watch !== undefined)
        expect(
          item
            ?.querySelector(`a[href="${L.watch}"]`)
            ?.closest(`[data-if-live="${L.n}"]`),
        ).not.toBeNull()
    }
  })

  it("names each link's lesson in words only a screen reader hears, so no two links read alike", () => {
    const links = Array.from(map.querySelectorAll('a'))
    expect(links.length).toBeGreaterThan(0)
    for (const a of links) {
      const shown = Array.from(a.childNodes)
        .filter((node) => !(node instanceof Element && node.matches('.sr')))
        .map((node) => node.textContent)
        .join('')
      expect(['Start lesson', 'Watch the film']).toContain(shown)
      expect(a.querySelector('.sr')).not.toBeNull()
    }
    const names = links.map(words)
    expect(new Set(names).size).toBe(names.length)
    // the hidden words take the kit's `sr` class, from the base the hub imports
    expect(repoFile('src/features/lessons/kit/lesson-base.css')).toMatch(
      /^\.sr \{\n {2}position: absolute !important;\n {2}width: 1px;/m,
    )
  })

  it("marks each hook with its lesson, for the site worker to ask the console's pick", () => {
    for (const L of lessons)
      expect(
        words(map.querySelector(`.hub-hook[data-lesson="${L.n}"]`)),
        `Lesson ${L.n}`,
      ).toBe(L.hook)
  })

  it("writes its readings in the one form the build's marks, the worker and a page settle", () => {
    expect(() =>
      markLessonStates(seasonMarkup(lessons), liveByDefault(ROOT, false)),
    ).not.toThrow()
  })
})

describe('the filled hub', () => {
  const hub = repoFile(HUB_DOCUMENT)

  it('takes the map, the reading times and the series parts, and leaves no mark', () => {
    // Act
    const html = fillHub(hub, hubLessons(ROOT), [2, 1])
    const doc = read(html)

    // Assert
    expect(html).not.toMatch(/<!-- hub:|"hasPart": \[\]/)
    expect(words(doc.querySelector('.hub-time'))).toBe(
      `Each lesson takes about ${minutesSpan(hubLessons(ROOT).filter((L) => L.n <= 2))} minutes.`,
    )
    expect(doc.querySelectorAll('#season .hub-lesson')).toHaveLength(
      hubLessons(ROOT).length,
    )
    const series = Array.from(
      doc.querySelectorAll('script[type="application/ld+json"]'),
    )
      .map((s) => JSON.parse(s.textContent ?? '') as Record<string, unknown>)
      .find((node) => node['@type'] === 'CreativeWorkSeries')
    expect(series?.hasPart).toEqual([
      { '@id': 'https://mercurypitch.com/learn/01#lesson' },
      { '@id': 'https://mercurypitch.com/learn/02#lesson' },
    ])
  })

  it("spans the reading times of the lessons live by the build's default, and no other", () => {
    const lessons = hubLessons(ROOT)
    const timeIn = (live: readonly number[]): string =>
      words(read(fillHub(hub, lessons, live)).querySelector('.hub-time'))
    const over = (live: readonly number[]): string | null =>
      minutesSpan(lessons.filter((L) => live.includes(L.n)))

    // a production build: the released lessons alone
    const released = liveByDefault(ROOT, false)
    expect(timeIn(released)).toBe(
      `Each lesson takes about ${over(released)} minutes.`,
    )
    // a build that shows drafts: every lesson with a page
    const shown = liveByDefault(ROOT, true)
    expect(timeIn(shown)).toBe(
      `Each lesson takes about ${over(shown)} minutes.`,
    )
    // Lesson 1 alone, or with the longest lesson
    expect(timeIn([1])).toBe(
      `Each lesson takes about ${lessons[0]?.minutes} minutes.`,
    )
    const longest = lessons.reduce((a, b) =>
      (b.minutes ?? 0) > (a.minutes ?? 0) ? b : a,
    )
    const first = lessons[0]?.minutes ?? 0
    expect(timeIn([1, longest.n])).toBe(
      `Each lesson takes about ${Math.min(first, longest.minutes ?? 0)} to ${longest.minutes} minutes.`,
    )
    // no lesson live with a reading time: nothing true to say
    expect(() => fillHub(hub, lessons, [])).toThrow(/reading time/)
  })

  it('refuses a document that lacks a mark, or holds one twice', () => {
    const lessons = hubLessons(ROOT)
    expect(() =>
      fillHub(hub.replace('<!-- hub:season -->', ''), lessons, []),
    ).toThrow(/hub:season/)
    expect(() => fillHub(`${hub}<!-- hub:minutes -->`, lessons, [])).toThrow(
      /hub:minutes/,
    )
  })

  it("names each lesson's node as the lesson's own structured data does, in lesson order", () => {
    for (const n of lessonPages(ROOT)) {
      const article = Array.from(
        read(repoFile(lessonDocument(n))).querySelectorAll(
          'script[type="application/ld+json"]',
        ),
      )
        .map((s) => JSON.parse(s.textContent ?? '') as Record<string, unknown>)
        .find((node) => node['@type'] === 'Article')
      expect(seriesParts([n]), `Lesson ${n}`).toEqual([
        { '@id': article?.['@id'] },
      ])
    }
    expect(seriesParts([3, 1]).map((part) => part['@id'])).toEqual([
      'https://mercurypitch.com/learn/01#lesson',
      'https://mercurypitch.com/learn/03#lesson',
    ])
  })
})

describe('the hub document', () => {
  const doc = read(repoFile(HUB_DOCUMENT))
  const meta = (key: string): string | null =>
    doc
      .querySelector(`meta[name="${key}"], meta[property="${key}"]`)
      ?.getAttribute('content') ?? null
  const HUB = 'https://mercurypitch.com/learn/'

  it('has a self-canonical, indexable head that fits in a result', () => {
    expect(
      doc.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    ).toBe(HUB)
    expect(meta('og:url')).toBe(HUB)
    expect(meta('robots')).toBe('index, follow, max-image-preview:large')
    expect(doc.title).toBe(
      'Free singing and music theory lessons | MercuryPitch',
    )
    expect(doc.title.length).toBeLessThanOrEqual(60)
    const description = meta('description') ?? ''
    expect(description.length).toBeGreaterThanOrEqual(80)
    expect(description.length).toBeLessThanOrEqual(160)
    expect(meta('og:title')).toBe(
      'Find Your Pitch: free singing and music theory lessons',
    )
    // Lesson 1's card, until the hub has its own
    expect(meta('og:image')).toBe(
      'https://mercurypitch.com/learn/lesson-01-og.jpg',
    )
  })

  it("runs no script, and links one stylesheet, which imports the lesson pages' base", () => {
    expect(
      doc.querySelectorAll('script:not([type="application/ld+json"])'),
    ).toHaveLength(0)
    expect(
      Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map((l) =>
        l.getAttribute('href'),
      ),
    ).toEqual(['/src/features/lessons/kit/lesson-hub.css'])
    // never lesson-base.css itself: linked by a second page, it leaves the
    // sheet the lessons share, and every lesson page then loads it after its own
    const sheet = repoFile('src/features/lessons/kit/lesson-hub.css')
    expect(sheet.replace(/\/\*[\s\S]*?\*\//g, '').trim()).toBe(
      "@import './lesson-base.css';",
    )
  })

  it('gives search a trail home, and the series every lesson is part of', () => {
    const [trail, series] = Array.from(
      doc.querySelectorAll('script[type="application/ld+json"]'),
    ).map((s) => JSON.parse(s.textContent ?? '') as Record<string, unknown>)

    expect(trail?.['@type']).toBe('BreadcrumbList')
    expect(
      (trail?.itemListElement as Record<string, unknown>[]).map((step) => [
        step.position,
        step.name,
        step.item,
      ]),
    ).toEqual([
      [1, 'MercuryPitch', 'https://mercurypitch.com/'],
      [2, 'Find Your Pitch', HUB],
    ])
    expect(series).toEqual({
      '@context': 'https://schema.org',
      '@type': 'CreativeWorkSeries',
      '@id': `${HUB}#series`,
      name: 'Find Your Pitch',
      url: HUB,
      description: meta('description'),
      inLanguage: 'en-GB',
      publisher: {
        '@type': 'Organization',
        '@id': 'https://mercurypitch.com/#organization',
        name: 'MercuryPitch',
        url: 'https://mercurypitch.com/',
      },
      hasPart: [],
    })
  })

  it('closes on the legal links, as every lesson page does', () => {
    expect(
      Array.from(doc.querySelectorAll('nav[aria-label="Legal"] a')).map((a) =>
        a.getAttribute('href'),
      ),
    ).toEqual([
      'https://about.mercurypitch.com/privacy/',
      'https://about.mercurypitch.com/terms/',
      'https://about.mercurypitch.com/imprint/',
    ])
  })
})
