// ============================================================
// Lesson ways tests — each lesson page's trail, as the build writes it from the page's own structured data
// ============================================================
//
// These run against the repository's own lesson documents, so a lesson page
// that is added or renamed changes no test. The page as a browser meets it,
// built and served, is src/e2e/learn-ways.spec.ts's.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { lessonDocument, lessonPages } from './draft-lessons'
import { fillLessonWays, trailSteps } from './lesson-ways'

const ROOT = resolve(__dirname, '..')

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
    const built = read(fillLessonWays(source))

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
  },
)

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
