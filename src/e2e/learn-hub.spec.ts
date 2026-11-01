// ============================================================
// The series' hub at /learn/: the season's map, as a browser meets it
// ============================================================
//
// learn/index.html is a plain document with no script; the build fills its
// season map in from season.ts and the lesson documents (tools/learn-hub.ts)
// and marks each lesson's readings for its own default. The e2e bundle
// shows drafts (`build:e2e`), so every lesson with a page is live here, and
// the series' `hasPart` names each of them. What the site worker does to the
// page where it serves it is src/lesson-gate.test.ts's.

import type { Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'
import { LESSONS, minutesSpan } from '../features/lessons/kit/season'
import { hasWatchPage, watchPath } from '../features/lessons/kit/watch-pages'

const LAYOUTS = [
  { name: 'a phone', width: 390, height: 844 },
  { name: 'a desktop', width: 1440, height: 900 },
] as const

/** Every Season 1 lesson, the trailer left out. */
const SEASON = LESSONS.filter((L) => L.n >= 1)

/** The page's structured-data blocks, parsed. */
const blocks = (page: Page): Promise<Record<string, unknown>[]> =>
  page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((scripts) =>
      scripts.map(
        (s) => JSON.parse(s.textContent ?? '') as Record<string, unknown>,
      ),
    )

for (const l of LAYOUTS) {
  test.describe(`on ${l.name} (${l.width} x ${l.height})`, () => {
    test.use({ viewport: { width: l.width, height: l.height } })

    test('shows the series, its two lanes and every lesson once, with no sideways scroll @smoke', async ({
      page,
    }) => {
      // Act
      await page.goto('/learn/')

      // Assert: the page and its lanes
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Find Your Pitch',
      )
      for (const lane of ['Theory', 'Voice'])
        await expect(
          page.getByRole('heading', { level: 3, name: lane, exact: true }),
        ).toBeVisible()
      const width = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth,
        view: window.innerWidth,
      }))
      expect(width.page).toBeLessThanOrEqual(width.view)

      // Every Season 1 lesson, once, by its number
      const numbers = await page
        .locator('#season .hub-lesson .kicker')
        .allTextContents()
      expect(numbers.map((t) => t.trim())).toHaveLength(SEASON.length)
      expect(new Set(numbers.map((t) => t.trim()))).toEqual(
        new Set(SEASON.map((L) => `Lesson ${L.n}`)),
      )
      for (const L of SEASON) {
        const item = page.locator('#season .hub-lesson', {
          has: page.locator('.kicker', {
            hasText: new RegExp(`^Lesson ${L.n}$`),
          }),
        })
        await expect(item, `Lesson ${L.n}`).toHaveCount(1)
        await expect(item.locator('.hub-hook')).toHaveText(L.hook)
        if (L.page === undefined) {
          await expect(item.locator('.hub-go')).toHaveText('Coming')
          await expect(item.getByRole('link')).toHaveCount(0)
        } else {
          // each link's hidden words name its lesson. Chromium reads the
          // `sr` span, absolutely placed and so a block, with a space before it
          await expect(
            item.getByRole('link', {
              name: new RegExp(`^Start lesson ?: Lesson ${L.n}, `),
            }),
          ).toHaveAttribute('href', L.page)
          await expect(item.getByText('Coming', { exact: true })).toBeHidden()
        }
      }
    })
  })
}

test('links lessons that each answer, and says the same in its head and structured data', async ({
  page,
}) => {
  // Act
  const response = await page.goto('/learn/')

  // Assert: the head
  expect(response?.status()).toBe(200)
  const title = await page.title()
  expect(title).toBe('Free singing and music theory lessons | MercuryPitch')
  expect(title.length).toBeLessThanOrEqual(60)
  const description =
    (await page.locator('meta[name="description"]').getAttribute('content')) ??
    ''
  expect(description.length).toBeGreaterThanOrEqual(80)
  expect(description.length).toBeLessThanOrEqual(160)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://mercurypitch.com/learn/',
  )

  // Each lesson link answers in the preview
  const links = await page
    .locator('#season a')
    .evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''))
  // The map draws lane by lane, so its links are compared in lesson order
  // and each live lesson's film where it has a watch page (kit/watch-pages.ts)
  expect([...links].sort()).toEqual(
    SEASON.flatMap((L) =>
      L.page === undefined
        ? []
        : hasWatchPage(L.n)
          ? [L.page, watchPath(L.n)]
          : [L.page],
    ).sort(),
  )
  for (const href of links) {
    const answer = await page.request.get(href)
    expect(answer.status(), href).toBe(200)
  }

  // How long a lesson takes, over the lessons linked and no other
  const linked = SEASON.filter(
    (L) => L.page !== undefined && links.includes(L.page),
  )
  await expect(page.locator('.hub-time')).toHaveText(
    `Each lesson takes about ${minutesSpan(linked)} minutes.`,
  )

  // Both blocks parse, and the series names exactly the lessons linked
  const parsed = await blocks(page)
  expect(parsed.map((node) => node['@type'])).toEqual([
    'BreadcrumbList',
    'CreativeWorkSeries',
  ])
  const series = parsed[1]
  expect(series?.['@id']).toBe('https://mercurypitch.com/learn/#series')
  expect(
    ((series?.hasPart ?? []) as { '@id': string }[]).map((part) => part['@id']),
  ).toEqual(
    [...links]
      .filter((href) => !href.endsWith('/watch'))
      .sort()
      .map((href) => `https://mercurypitch.com${href}#lesson`),
  )
})
