// ============================================================
// Lesson ways tests — each lesson page's trail and the lessons either side, as the build writes them
// ============================================================
//
// These run against the repository's own lesson documents, so a lesson page
// that is added or renamed changes no test. The page as a browser meets it,
// built and served, is src/e2e/learn-ways.spec.ts's; how the site worker and
// the page's script take out a link to a lesson that is not live is
// src/lesson-gate.test.ts's and kit/page-state.test.ts's.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { lessonDocument, lessonPages, lessonPath } from './draft-lessons'
import { hubLessons } from './learn-hub'
import { fillLessonWays, lessonWays, trailSteps } from './lesson-ways'

const ROOT = resolve(__dirname, '..')
const PAGES = lessonPages(ROOT)

const repoFile = (path: string): string =>
  readFileSync(resolve(ROOT, path), 'utf8')

const read = (html: string): Document =>
  new DOMParser().parseFromString(html, 'text/html')

const words = (el: Element | null): string =>
  (el?.textContent ?? '').replace(/\s+/g, ' ').trim()

/** The BreadcrumbList a document carries, as its structured data has it. */
function breadcrumbList(doc: Document): { name: string; item?: string }[] {
  for (const node of Array.from(
    doc.querySelectorAll('script[type="application/ld+json"]'),
  )) {
    const data = JSON.parse(node.textContent ?? '{}') as {
      '@type'?: string
      itemListElement?: { position: number; name: string; item?: string }[]
    }
    if (data['@type'] === 'BreadcrumbList')
      return [...(data.itemListElement ?? [])].sort(
        (a, b) => a.position - b.position,
      )
  }
  return []
}

/** A document with a BreadcrumbList of these items and a <main>. */
const documentWith = (items: unknown[]): string =>
  `<head><script type="application/ld+json">${JSON.stringify({
    '@type': 'BreadcrumbList',
    itemListElement: items,
  })}</script></head><body><header class="mast"></header><main id="top"></main></body>`

describe.each(lessonPages(ROOT))(
  'lesson page %i, as the build writes it',
  (n) => {
    const source = repoFile(lessonDocument(n))
    const built = read(fillLessonWays(source, lessonWays(ROOT, n)))

    it('shows the trail its BreadcrumbList names: the same steps, in order, each address a link and the lesson the current page', () => {
      // Arrange
      const list = breadcrumbList(built)

      // Act
      const trail = built.querySelector('nav[aria-label="Breadcrumb"]')
      const steps = Array.from(trail?.querySelectorAll('li') ?? [], (li) => {
        const a = li.querySelector('a')
        return {
          name: words(li),
          href: a?.getAttribute('href') ?? null,
          current: li.querySelector('[aria-current="page"]') !== null,
        }
      })

      // Assert
      expect(list).toHaveLength(3)
      expect(steps).toEqual(
        list.map((item, i) => ({
          name: item.name,
          href:
            item.item === undefined
              ? null
              : item.item.replace('https://mercurypitch.com', ''),
          current: i === list.length - 1,
        })),
      )
      expect(steps.map((s) => s.href)).toEqual(['/', '/learn/', null])
    })

    it('puts the trail after the masthead and outside the lesson, so "Skip to the lesson" passes it', () => {
      // Act
      const trail = built.querySelector('nav.trail')

      // Assert
      expect(trail?.previousElementSibling?.id).toBe('mast')
      expect(trail?.nextElementSibling?.matches('main#top')).toBe(true)
      expect(built.querySelectorAll('nav.trail')).toHaveLength(1)
    })

    it('links the lessons either side that have a page, first in its foot, each by its number and its name as the hub names it', () => {
      // Arrange
      const names = new Map(hubLessons(ROOT).map((L) => [L.n, L.name]))
      const way = (m: number, rel: string, frame: string) =>
        PAGES.includes(m)
          ? [
              {
                rel,
                href: lessonPath(m),
                words: `${frame}Lesson ${m} ${names.get(m)}`,
              },
            ]
          : []

      // Act
      const nav = built.querySelector('footer.foot > nav.foot-ways')
      const links = Array.from(nav?.querySelectorAll('a') ?? [], (a) => ({
        rel: a.getAttribute('rel'),
        href: a.getAttribute('href'),
        words: words(a),
      }))

      // Assert
      expect(nav?.parentElement?.firstElementChild).toBe(nav)
      expect(nav?.getAttribute('aria-label')).toBe('Season 1 lessons')
      expect(links).toEqual([
        ...way(n - 1, 'prev', ''),
        ...way(n + 1, 'next', 'Next lesson '),
      ])
      expect(links.length).toBeGreaterThan(0)
    })

    it('links the next lesson from its foot alone: inside the lesson, the Wrap draws its next-lesson card', () => {
      // Act
      const next = Array.from(
        built.querySelectorAll(`a[href="${lessonPath(n + 1)}"]`),
      )

      // Assert
      expect(
        next.map((a) => a.closest('footer.foot > nav.foot-ways') !== null),
      ).toEqual(PAGES.includes(n + 1) ? [true] : [])
      expect(built.querySelector('main [data-next-card]')).not.toBeNull()
    })
  },
)

describe('the lessons either side', () => {
  it('are none before the first lesson page or after the last', () => {
    // Act
    const first = lessonWays(ROOT, PAGES[0])
    const last = lessonWays(ROOT, PAGES[PAGES.length - 1])

    // Assert
    expect(first.prev).toBeUndefined()
    expect(first.next?.href).toBe(lessonPath(PAGES[1]))
    expect(last.next).toBeUndefined()
    expect(last.prev?.href).toBe(lessonPath(PAGES[PAGES.length - 2]))
  })

  it('write nothing in the foot of a lesson with neither, and their names as text', () => {
    // Arrange
    const html = documentWith([
      { position: 1, name: 'Home', item: 'https://mercurypitch.com/' },
      { position: 2, name: 'The lesson' },
    ]).replace('</body>', '<footer class="foot"></footer></body>')

    // Act
    const alone = read(fillLessonWays(html))
    const named = read(
      fillLessonWays(html, {
        next: { n: 2, name: '<b>Notes</b> & keys', href: '/learn/02' },
      }),
    )

    // Assert
    expect(alone.querySelector('.foot-ways')).toBeNull()
    const next = named.querySelector('.foot-ways a[rel="next"]')
    expect(words(next)).toBe('Next lesson Lesson 2 <b>Notes</b> & keys')
    expect(next?.querySelector(':scope > span > span b')).toBeNull()
  })

  it('refuse a document whose foot they cannot find', () => {
    // Arrange
    const html = documentWith([
      { position: 1, name: 'Home', item: 'https://mercurypitch.com/' },
      { position: 2, name: 'The lesson' },
    ])
    const ways = { prev: { n: 1, name: 'One', href: '/learn/01' } }

    // Act and Assert
    expect(() => fillLessonWays(html, ways)).toThrow(/exactly once/)
  })
})

describe("a lesson's trail", () => {
  it('reads its steps in position order, whatever order the list is written in', () => {
    // Arrange
    const html = documentWith([
      { position: 3, name: 'The lesson' },
      { position: 1, name: 'Home', item: 'https://mercurypitch.com/' },
      { position: 2, name: 'Hub', item: 'https://mercurypitch.com/learn/' },
    ])

    // Act
    const steps = trailSteps(html)

    // Assert
    expect(steps).toEqual([
      { name: 'Home', href: '/' },
      { name: 'Hub', href: '/learn/' },
      { name: 'The lesson' },
    ])
  })

  it('writes its names as text, never as markup', () => {
    // Arrange
    const html = documentWith([
      { position: 1, name: 'Home', item: 'https://mercurypitch.com/' },
      { position: 2, name: '<b>Notes</b> & "keys"' },
    ])

    // Act
    const built = read(fillLessonWays(html))

    // Assert
    const current = built.querySelector('nav.trail [aria-current="page"]')
    expect(current?.textContent).toBe('<b>Notes</b> & "keys"')
    expect(current?.querySelector('b')).toBeNull()
  })

  it('refuses a document with no BreadcrumbList, a step off this site, or a lesson that links itself', () => {
    // Arrange
    const none = '<main id="top"></main>'
    const offSite = documentWith([
      { position: 1, name: 'Home', item: 'https://example.com/' },
      { position: 2, name: 'The lesson' },
    ])
    const linkedEnd = documentWith([
      { position: 1, name: 'Home', item: 'https://mercurypitch.com/' },
      {
        position: 2,
        name: 'The lesson',
        item: 'https://mercurypitch.com/learn/01',
      },
    ])

    // Act and Assert
    expect(() => fillLessonWays(none)).toThrow(/BreadcrumbList/)
    expect(() => fillLessonWays(offSite)).toThrow(/not on/)
    expect(() => fillLessonWays(linkedEnd)).toThrow(/lead from the home page/)
  })

  it('refuses a document whose lesson it cannot find, or finds twice', () => {
    // Arrange
    const list = [
      { position: 1, name: 'Home', item: 'https://mercurypitch.com/' },
      { position: 2, name: 'The lesson' },
    ]
    const noMain = documentWith(list).replace('<main id="top"></main>', '')
    const twoMains = documentWith(list).replace(
      '</body>',
      '<main id="top"></main></body>',
    )

    // Act and Assert
    expect(() => fillLessonWays(noMain)).toThrow(/exactly once/)
    expect(() => fillLessonWays(twoMains)).toThrow(/exactly once/)
  })
})
