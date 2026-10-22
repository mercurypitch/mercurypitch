// ============================================================
// A lesson page follows the state the site worker served it with
// ============================================================
//
// On mercurypitch.com the site worker writes the admin console's lesson
// state into every lesson page it serves (`#lesson-state`,
// src/lesson-gate.ts), and the page lists and links the season by it
// (kit/page-state.ts). The e2e server is no worker, so each test here writes
// the tag itself, as the worker does, before the page's scripts run: the
// page is fetched as built and handed over with the tag before `</head>`.
// The e2e bundle shows drafts by default, so a tag that says otherwise is
// the only way a page here holds one back.
//
// What the worker itself does to the markup it serves (the h1's hook, the
// head's copies of it, the 404 for a lesson held back) is
// src/lesson-gate.test.ts's.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { LESSON_COPY } from '../features/lessons/kit/lesson-copy'

interface Served {
  readonly lessons: Record<
    string,
    { published?: boolean; hook?: string; tease?: string }
  >
  /** The environment's default for a draft: false as on mercurypitch.com. */
  readonly drafts: boolean
}

/** Serves `path` with `state` in its head, as the site worker would. */
async function serveWith(
  page: Page,
  path: string,
  state: Served,
): Promise<void> {
  const tag = `<script type="application/json" id="lesson-state">${JSON.stringify(
    {
      version: 1,
      updatedAt: '2026-10-20T09:30:00.000Z',
      ...state,
    },
  ).replace(/</g, '\\u003c')}</script>`
  await page.route(`**${path}`, async (route) => {
    const response = await route.fetch()
    const html = await response.text()
    expect(html).toContain('</head>')
    // The body goes back decoded and longer, so neither header holds.
    const headers = { ...response.headers() }
    delete headers['content-length']
    delete headers['content-encoding']
    await route.fulfill({
      status: response.status(),
      headers,
      body: html.replace('</head>', `${tag}</head>`),
    })
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(path)
}

/** The card at the foot of this page's Wrap. */
const nextCard = (page: Page): Locator => page.locator('#wrap a.next-card')

/** Lesson `n`'s row in the masthead's lesson menu, opened. */
async function menuRow(page: Page, n: number): Promise<Locator> {
  await page.getByRole('button', { name: / All \d+ lessons$/ }).click()
  const row = page.locator('#lessonMenu .lm-row', {
    has: page.locator('.sr', { hasText: new RegExp(`^Lesson ${n}, `) }),
  })
  await expect(row).toHaveCount(1)
  return row
}

/** Lesson `n`'s card on the season map, opened from its node. */
async function mapCard(page: Page, n: number): Promise<Locator> {
  await page.locator(`#graph .node[aria-label^="Lesson ${n}:"]`).click()
  const card = page.locator('#exCardHost .ex-card')
  await expect(card).toBeVisible()
  return card
}

test('a draft the console publishes is linked where drafts are held back @smoke', async ({
  page,
}) => {
  // Arrange: mercurypitch.com's default, and Lesson 3 published; Lesson 5 not
  await serveWith(page, '/learn/02', {
    drafts: false,
    lessons: { 3: { published: true } },
  })

  // Assert: the Wrap's card, the map's card and the lesson menu all link it
  await expect(nextCard(page)).toHaveAttribute('href', '/learn/03')
  await expect(nextCard(page).locator('.chip')).toHaveText('Start lesson')
  const card = await mapCard(page, 3)
  await expect(card.locator('a.btn')).toHaveAttribute('href', '/learn/03')
  const three = await menuRow(page, 3)
  await expect(three).toHaveAttribute('href', '/learn/03')
  const five = page.locator('#lessonMenu .lm-row', {
    has: page.locator('.sr', { hasText: /^Lesson 5, / }),
  })
  await expect(five).toHaveClass(/\blater\b/)
  await expect(five).not.toHaveAttribute('href', /./)
})

test('a released lesson the console holds back is linked from nowhere on the page', async ({
  page,
}) => {
  // Arrange: Lesson 4's page, whose prerequisite chip links Lesson 2
  await serveWith(page, '/learn/04', {
    drafts: true,
    lessons: { 2: { published: false } },
  })

  // Assert: the chip stays, as a plain chip, and nothing links Lesson 2
  const chip = page.locator('ul.meta .chip', { hasText: 'After Lesson 2' })
  await expect(chip).toHaveCount(1)
  await expect(chip).not.toHaveAttribute('href', /./)
  await expect(page.locator('a[href^="/learn/02"]')).toHaveCount(0)
  const card = await mapCard(page, 2)
  await expect(card.locator('.chip')).toHaveText('Coming later')
  await expect(card.locator('a.btn')).toHaveCount(0)
  const two = await menuRow(page, 2)
  await expect(two).toHaveClass(/\blater\b/)
  await expect(page.locator('#lessonMenu a[href^="/learn/02"]')).toHaveCount(0)
})

test('Lesson 7, a draft, is held back where drafts are, and linked once the console publishes it', async ({
  page,
}) => {
  // Arrange: mercurypitch.com's default, and nothing published
  await serveWith(page, '/learn/04', { drafts: false, lessons: {} })

  // Assert: the map's card and the lesson menu say coming later, and link nothing
  const later = await mapCard(page, 7)
  await expect(later.locator('.chip')).toHaveText('Coming later')
  await expect(later.locator('a.btn')).toHaveCount(0)
  const held = await menuRow(page, 7)
  await expect(held).toHaveClass(/\blater\b/)
  await expect(page.locator('a[href^="/learn/07"]')).toHaveCount(0)

  // Act: the console publishes it
  await page.unrouteAll()
  await serveWith(page, '/learn/04', {
    drafts: false,
    lessons: { 7: { published: true } },
  })

  // Assert
  const card = await mapCard(page, 7)
  await expect(card.locator('a.btn')).toHaveAttribute('href', '/learn/07')
  const seven = await menuRow(page, 7)
  await expect(seven).toHaveAttribute('href', '/learn/07')
})

test("the Wrap's card on the lesson before shows a lesson held back as coming later", async ({
  page,
}) => {
  // Arrange
  await serveWith(page, '/learn/01', {
    drafts: true,
    lessons: { 2: { published: false } },
  })

  // Assert
  const card = nextCard(page)
  await expect(card).toHaveAttribute('href', '#explorer')
  await expect(card.locator('.tempo')).toHaveText('Coming later')
})

test('the next card and the map show the hook the console picked, and the default tease for an id it lacks', async ({
  page,
}) => {
  // Arrange: Lesson 3 opens on its figures, and Lesson 3's card follows
  // Lesson 2's Wrap; on Lesson 1's, Lesson 2's tease is asked for by an id
  // it does not have
  const figures = LESSON_COPY[3]?.hookAlts?.find(
    (v) => v.id === 'figures',
  )?.text
  expect(figures).toMatch(/1,105/)
  await serveWith(page, '/learn/02', {
    drafts: true,
    lessons: { 3: { hook: 'figures' } },
  })

  // Assert
  await expect(nextCard(page).locator('.q2')).toHaveText(figures ?? '')
  const card = await mapCard(page, 3)
  await expect(card.locator('.hookq')).toHaveText(figures ?? '')

  // Act: Lesson 1's page, Lesson 2's tease asked for by an unknown id
  await page.unrouteAll()
  await serveWith(page, '/learn/01', {
    drafts: true,
    lessons: { 2: { tease: 'gone' } },
  })

  // Assert
  await expect(nextCard(page).locator('.next-tease')).toHaveText(
    LESSON_COPY[2]?.tease ?? 'Lesson 2 has a tease',
  )
})

test("Lesson 8's recall is left out, wrapper and all, where Lesson 6 is held back, and the page raises no error", async ({
  page,
}) => {
  // Arrange
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  // Act
  await serveWith(page, '/learn/08', {
    drafts: true,
    lessons: { 6: { published: false } },
  })

  // Assert: the quiz below it still boots
  await expect(page.locator('#qs .q')).toHaveCount(4)
  await expect(page.locator('#recall')).toHaveCount(0)
  await expect(page.locator('[data-if-live="6"]')).toHaveCount(0)
  await expect(page.locator('a[href^="/learn/06"]')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('Lesson 8, a draft, is coming later where drafts are held back, and linked where they are shown', async ({
  page,
}) => {
  // Arrange: mercurypitch.com's default
  await serveWith(page, '/learn/01', { drafts: false, lessons: {} })

  // Assert
  const card = await mapCard(page, 8)
  await expect(card.locator('.chip')).toHaveText('Coming later')
  await expect(card.locator('a.btn')).toHaveCount(0)
  const held = await menuRow(page, 8)
  await expect(held).toHaveClass(/\blater\b/)
  await expect(page.locator('#lessonMenu a[href^="/learn/08"]')).toHaveCount(0)

  // Act: the dev deploy's default
  await page.unrouteAll()
  await serveWith(page, '/learn/01', { drafts: true, lessons: {} })

  // Assert
  const shown = await menuRow(page, 8)
  await expect(shown).toHaveAttribute('href', '/learn/08')
})
