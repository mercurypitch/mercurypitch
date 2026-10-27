// ============================================================
// A lesson page's ways out, in the markup it is served with
// ============================================================
//
// Every lesson page shows a trail back through the series' hub to the home
// page, written at build time from the page's own BreadcrumbList, and links
// the lessons either side from its foot (tools/lesson-ways.ts). A crawler
// that runs no script follows both, so they are checked here on the page as
// built and served: the trail's names, links and current page against the
// structured data the same page carries, and the foot's lessons beside the
// Wrap's next-lesson card, which the page's script draws. The e2e build
// shows drafts, so every lesson page is live here.

import type { Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'
import { lessonPages, lessonPath } from '../../tools/draft-lessons'

const LESSONS = lessonPages(process.cwd())

interface Step {
  readonly name: string
  readonly href: string | null
  readonly current: boolean
}

/** The trail the page's BreadcrumbList names, as its visible trail should show it. */
function named(page: Page): Promise<Step[]> {
  return page.evaluate(() => {
    for (const node of Array.from(
      document.querySelectorAll('script[type="application/ld+json"]'),
    )) {
      const data = JSON.parse(node.textContent ?? '{}') as {
        '@type'?: string
        itemListElement?: { position: number; name: string; item?: string }[]
      }
      if (data['@type'] !== 'BreadcrumbList') continue
      const items = [...(data.itemListElement ?? [])].sort(
        (a, b) => a.position - b.position,
      )
      return items.map((item, i) => ({
        name: item.name,
        href: item.item === undefined ? null : new URL(item.item).pathname,
        current: i === items.length - 1,
      }))
    }
    return []
  })
}

/** The trail the page shows. */
function shown(page: Page): Promise<Step[]> {
  return page
    .getByRole('navigation', { name: 'Breadcrumb' })
    .locator('li')
    .evaluateAll((items) =>
      items.map((li) => ({
        name: (li.textContent ?? '').replace(/\s+/g, ' ').trim(),
        href: li.querySelector('a')?.getAttribute('href') ?? null,
        current: li.querySelector('[aria-current="page"]') !== null,
      })),
    )
}

for (const n of LESSONS) {
  test(`${lessonPath(n)} shows the trail its BreadcrumbList names, the hub a link and the lesson the current page`, async ({
    page,
  }) => {
    // Act
    await page.goto(lessonPath(n))

    // Assert
    const trail = page.getByRole('navigation', { name: 'Breadcrumb' })
    await expect(trail).toBeVisible()
    await expect(
      trail.getByRole('link', { name: 'Find Your Pitch' }),
    ).toHaveAttribute('href', '/learn/')
    const want = await named(page)
    expect(want).toHaveLength(3)
    expect(await shown(page)).toEqual(want)
  })
}

/** The links in a page's foot to the lessons either side, each its rel and address. */
function footWays(page: Page) {
  return page
    .getByRole('contentinfo')
    .getByRole('navigation', { name: 'Season 1 lessons' })
    .getByRole('link')
}

const beside = (n: number) => [
  ...(LESSONS.includes(n - 1)
    ? [{ rel: 'prev', href: lessonPath(n - 1) }]
    : []),
  ...(LESSONS.includes(n + 1)
    ? [{ rel: 'next', href: lessonPath(n + 1) }]
    : []),
]

for (const n of LESSONS) {
  test(`${lessonPath(n)} links the lessons either side that have a page from its foot`, async ({
    page,
  }) => {
    // Act
    await page.goto(lessonPath(n))

    // Assert
    const links = footWays(page)
    await expect(links).toHaveCount(beside(n).length)
    expect(
      await links.evaluateAll((as) =>
        as.map((a) => ({
          rel: a.getAttribute('rel'),
          href: a.getAttribute('href'),
        })),
      ),
    ).toEqual(beside(n))
  })
}

for (const n of LESSONS.filter((m) => LESSONS.includes(m + 1))) {
  test(`${lessonPath(n)}'s Wrap shows the next lesson once, in its card, with the foot's link below it`, async ({
    page,
  }) => {
    // Act
    await page.goto(lessonPath(n))

    // Assert
    const next = lessonPath(n + 1)
    await expect(
      page.locator(`#wrap a[data-next-card="${n + 1}"]`),
    ).toHaveAttribute('href', next)
    await expect(page.locator(`#wrap a[href="${next}"]`)).toHaveCount(1)
    await expect(
      footWays(page).and(page.locator(`[href="${next}"]`)),
    ).toHaveText(new RegExp(`^Next lesson\\s*Lesson ${n + 1}\\b`))
  })
}

test.describe('on the narrowest phone, 320 x 568', () => {
  test.use({ viewport: { width: 320, height: 568 }, hasTouch: true })

  test("the trail keeps to one line, Lesson 6's long name ending in an ellipsis, and nothing scrolls sideways @smoke", async ({
    page,
  }) => {
    // Act
    await page.goto('/learn/06')
    // The first step's toy slides 18 px in from the side as it enters
    // (lesson-stage.css), and under 342 px its figure spans the window, so
    // until the slide ends the page is up to 18 px wider than the window.
    // Nobody can scroll to that, since the page clips sideways, but a slow
    // runner measured it. The page is measured with the toy at rest.
    await page
      .locator('#stepsStage .toy.is-active')
      .evaluate((toy) =>
        Promise.all(toy.getAnimations().map((a) => a.finished)),
      )

    // Assert
    const trail = page.getByRole('navigation', { name: 'Breadcrumb' })
    const line = await trail.locator('ol').evaluate((ol) => {
      const current = ol.querySelector<HTMLElement>('[aria-current="page"]')
      const links = Array.from(ol.querySelectorAll('a'), (a) =>
        a.getBoundingClientRect(),
      )
      return {
        height: ol.getBoundingClientRect().height,
        cut: current !== null && current.scrollWidth > current.clientWidth,
        targets: links.every((r) => r.height >= 24),
        sideways:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      }
    })
    expect(line).toEqual({ height: 24, cut: true, targets: true, sideways: 0 })
  })
})
