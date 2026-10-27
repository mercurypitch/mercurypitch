// ============================================================
// The next-lesson card: every lesson's Wrap, drawn from the season
// ============================================================
//
// Each lesson's Wrap ends on a card for the lesson after it
// (kit/next-card.ts), in the words the explorer's card and the lesson menu
// use: "Start lesson" to its page while it is live, "Continue: step N" or
// "Read again" as the viewer stands with it, and for a lesson not written
// yet "Coming later" and a way to the map, never a link to a page. These
// are the lesson polish plan's checks for it (D2), with the prerequisite
// chip's 44 px target (A6). The e2e build shows drafts, as the dev deploy
// does, so Lessons 3 and 5 to 10 are live here; a page that holds them
// back is next-card.test.ts's, and one the site worker served with the
// console's state is learn-publish-state.spec.ts's. A lesson with a tease
// (kit/lesson-copy.ts) is set up by it on the card before, one line above
// its hook; the season's close, on a finale with no page yet, is
// next-card.test.ts's too. The card for a lesson coming later is found in
// the season, on the page before its first lesson with no page
// (`lessonWithNoPage`), so no new lesson page moves these tests.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'
import { LESSON_COPY } from '../features/lessons/kit/lesson-copy'
import { LESSONS } from '../features/lessons/kit/season'
import { lessonWithNoPage } from '../features/lessons/kit/season.test-fixtures'

/** The card at the foot of this page's Wrap. */
const card = (page: Page): Locator => page.locator('#wrap a.next-card')

/** A lesson's number as its address writes it: 9 is "09". */
const pad = (n: number): string => String(n).padStart(2, '0')

/** The season's first lesson with no page: the page before it ends on its card. */
const LATER = lessonWithNoPage()

// each page's card: [page, its eyebrow, where it goes, its way on]
const CARDS: readonly (readonly [string, string, string, string])[] = [
  [
    '/learn/01',
    'Next lesson 02 · Twelve notes Ready · 13 min',
    '/learn/02',
    'Start lesson',
  ],
  [
    '/learn/02',
    'Next lesson 03 · Match a note Ready · 16 min',
    '/learn/03',
    'Start lesson',
  ],
  [
    '/learn/03',
    'Next lesson 04 · The major scale and home Ready · 14 min',
    '/learn/04',
    'Start lesson',
  ],
  [
    '/learn/04',
    'Next lesson 05 · Breath and a steady note Ready · 18 min',
    '/learn/05',
    'Start lesson',
  ],
  [
    '/learn/05',
    'Next lesson 06 · Intervals: the distance between notes Ready · 17 min',
    '/learn/06',
    'Start lesson',
  ],
  [
    '/learn/06',
    'Next lesson 07 · Slides, sirens and your range Ready · 16 min',
    '/learn/07',
    'Start lesson',
  ],
  [
    '/learn/07',
    'Next lesson 08 · Beat, tempo and the backbeat Ready · 16 min',
    '/learn/08',
    'Start lesson',
  ],
  [
    '/learn/08',
    'Next lesson 09 · Landing a leap Ready · 16 min',
    '/learn/09',
    'Start lesson',
  ],
  [
    '/learn/09',
    'Next lesson 10 · Major and minor Ready · 17 min',
    '/learn/10',
    'Start lesson',
  ],
  [
    `/learn/${pad(LATER.n - 1)}`,
    `Next lesson ${pad(LATER.n)} · ${LATER.title} Coming later`,
    '#explorer',
    'See it on the map',
  ],
]

/** Seeds the viewer's progress before the page's scripts read it. */
async function seed(page: Page, key: string, value: unknown): Promise<void> {
  await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [
    key,
    JSON.stringify(value),
  ] as const)
}

for (const [path, eyebrow, href, way] of CARDS) {
  test(`${path}'s Wrap ends on the next lesson's card: ${way}`, async ({
    page,
  }) => {
    // Act
    await page.goto(path)

    // Assert
    const c = card(page)
    await expect(c.locator('.eyebrow')).toHaveText(eyebrow)
    await expect(c.locator('.q2')).toHaveText(/\?$/)
    await expect(c.locator('.chip')).toHaveText(way)
    await expect(c).toHaveAttribute('href', href)
  })
}

test("Lesson 1's card sets up Lesson 2 with its tease, one line above its hook", async ({
  page,
}) => {
  // Act
  await page.goto('/learn/01')

  // Assert
  const c = card(page)
  await expect(c.locator('.next-tease')).toHaveText(
    LESSON_COPY[2]?.tease ?? 'Lesson 2 has a tease',
  )
  await expect(c.locator('.next-tease')).toBeVisible()
  expect(
    await c
      .locator('.next-words > *')
      .evaluateAll((els) => els.map((e) => e.className)),
  ).toEqual(['eyebrow', 'next-tease', 'q2', 'chip'])
})

test("Lesson 8's card sets up Lesson 9 with its tease, one line above its hook, and its figure after the words holds no button", async ({
  page,
}) => {
  // Act
  await page.goto('/learn/08')

  // Assert
  const c = card(page)
  await expect(c.locator('.next-tease')).toHaveText(
    LESSON_COPY[9]?.tease ?? 'Lesson 9 has a tease',
  )
  await expect(c.locator('.next-tease')).toBeVisible()
  expect(
    await c
      .locator('.next-words > *')
      .evaluateAll((els) => els.map((e) => e.className)),
  ).toEqual(['eyebrow', 'next-tease', 'q2', 'chip'])
  // the page's tease figure, kept after the words
  expect(
    await c.evaluate((a) =>
      Array.from(a.children, (k) => k.classList[0] ?? k.tagName),
    ),
  ).toEqual(['next-words', 'l08-tease'])
  await expect(c.locator('button')).toHaveCount(0)
})

test("Lesson 9's card names Lesson 10, ready, sets it up with its tease above the hook and its figure after the words, and leads to its page", async ({
  page,
}) => {
  // Arrange
  await page.goto('/learn/09')
  const c = card(page)
  await expect(c.locator('.eyebrow')).toHaveText(
    'Next lesson 10 · Major and minor Ready · 17 min',
  )
  await expect(c.locator('.next-tease')).toHaveText(
    LESSON_COPY[10]?.tease ?? 'Lesson 10 has a tease',
  )
  await expect(c.locator('.next-tease')).toBeVisible()
  const words = await c
    .locator('.next-words > *')
    .evaluateAll((els) => els.map((e) => e.className))
  // the page's tease figure, kept after the words
  const children = await c.evaluate((a) =>
    Array.from(a.children, (k) => k.classList[0] ?? k.tagName),
  )
  // read before the click, which leaves this page for Lesson 10's
  await expect(c.locator('button')).toHaveCount(0)
  await expect(c.locator('.chip')).toHaveText('Start lesson')

  // Act
  await c.click()

  // Assert
  expect(words).toEqual(['eyebrow', 'next-tease', 'q2', 'chip'])
  expect(children).toEqual(['next-words', 'l09-tease'])
  await expect(page).toHaveURL(/\/learn\/10$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    LESSONS[10].hook,
  )
})

test("Lesson 10's card sets up Lesson 11 with its tease, one line above its hook, and its still after the words holds no button, no words and no red", async ({
  page,
}) => {
  // Act
  await page.goto('/learn/10')

  // Assert
  const c = card(page)
  await expect(c.locator('.next-tease')).toHaveText(
    LESSON_COPY[11]?.tease ?? 'Lesson 11 has a tease',
  )
  await expect(c.locator('.next-tease')).toBeVisible()
  expect(
    await c
      .locator('.next-words > *')
      .evaluateAll((els) => els.map((e) => e.className)),
  ).toEqual(['eyebrow', 'next-tease', 'q2', 'chip'])
  // the page's tease still, kept after the words
  expect(
    await c.evaluate((a) =>
      Array.from(a.children, (k) => k.classList[0] ?? k.tagName),
    ),
  ).toEqual(['next-words', 'l10-tease'])
  await expect(c.locator('button')).toHaveCount(0)
  const still = c.locator('svg.l10-tease')
  await expect(still).toBeVisible()
  await expect(still).toHaveAttribute('aria-hidden', 'true')
  // a picture: no words or notes on it, nothing red, and nothing moving
  expect(
    await still.evaluate((svg) => ({
      words: (svg.textContent ?? '').trim(),
      red: Array.from(svg.querySelectorAll('*')).flatMap((el) => {
        const s = getComputedStyle(el)
        return [s.fill, s.stroke].filter((paint) => {
          const m = /^rgba?\((\d+), (\d+), (\d+)/.exec(paint)
          if (m === null) return false
          const [r, g, b] = m.slice(1).map(Number)
          return r > 150 && g < 110 && b < 110
        })
      }),
      moving: svg.getAnimations({ subtree: true }).length,
    })),
  ).toEqual({ words: '', red: [], moving: 0 })
})

test("Lesson 2's card, its two figures kept, leads to Lesson 3's page @smoke", async ({
  page,
}) => {
  // Arrange
  await page.goto('/learn/02')
  const c = card(page)
  await expect(c.locator('.tease')).toContainText('1,105')

  // Act
  await c.click()

  // Assert
  await expect(page).toHaveURL(/\/learn\/03$/)
  await expect(
    page.getByRole('button', { name: / All \d+ lessons$/ }),
  ).toHaveAccessibleName('Season 1 · Lesson 03, Match a note. All 14 lessons')
})

test('continues the next lesson at the step the viewer reached', async ({
  page,
}) => {
  // Arrange: Lesson 2 left at step 3 of 6
  await seed(page, 'fyp-pos', { 2: { step: 3, of: 6 } })

  // Act
  await page.goto('/learn/01')

  // Assert
  const c = card(page)
  await expect(c.locator('.tempo')).toHaveText('Step 3 of 6')
  await expect(c.locator('.chip')).toHaveText('Continue: step 3')
  await expect(c).toHaveAttribute('href', '/learn/02#step-3')
})

test('reads the next lesson again once it is done', async ({ page }) => {
  // Arrange
  await seed(page, 'fyp-done', [1, 2])

  // Act
  await page.goto('/learn/01')

  // Assert
  const c = card(page)
  await expect(c.locator('.tempo')).toHaveText('Done · 13 min')
  await expect(c.locator('.chip')).toHaveText('Read again')
  await expect(c).toHaveAttribute('href', '/learn/02')
})

test('a lesson coming later opens the map on its card @smoke', async ({
  page,
}) => {
  // Arrange
  await page.goto(`/learn/${pad(LATER.n - 1)}`)

  // Act
  await card(page).click()

  // Assert
  await expect(page).toHaveURL(/#explorer$/)
  await expect(page.locator('#exCardHost h3')).toHaveText(LATER.title)
})

/**
 * Each prerequisite chip's link and the height of the box a tap lands in,
 * found as app-check's `hitBox` finds it: `elementFromPoint` in 1 px steps
 * up and down from the link's centre, so its `::after` counts and anything
 * laid over it does not. `at20` is whether points 20 px above and below the
 * centre both land on the link.
 */
const chipTargets = (
  page: Page,
): Promise<{ href: string | null; at20: boolean; tall: number }[]> =>
  page.locator('ul.meta a').evaluateAll((links) =>
    links.map((a) => {
      a.scrollIntoView({ block: 'center', behavior: 'instant' })
      const r = a.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const on = (y: number): boolean => {
        const t = document.elementFromPoint(cx, y)
        return t !== null && a.contains(t)
      }
      let up = 0
      while (up < 60 && on(cy - up - 1)) up++
      let down = 0
      while (down < 60 && on(cy + down + 1)) down++
      return {
        href: a.getAttribute('href'),
        at20: on(cy - 20) && on(cy + 20),
        tall: up + down + 1,
      }
    }),
  )

for (const [width, height, name] of [
  [1280, 720, 'a laptop'],
  [390, 844, 'a phone'],
] as const) {
  test.describe(`on ${name}, ${width} x ${height}`, () => {
    test.use({ viewport: { width, height } })

    for (const path of [
      '/learn/02',
      '/learn/03',
      '/learn/04',
      '/learn/05',
      '/learn/06',
      '/learn/07',
      '/learn/08',
      '/learn/09',
    ]) {
      test(`${path}: every prerequisite chip is a 44 px target`, async ({
        page,
      }) => {
        // Arrange
        await page.goto(path)
        await expect(page.locator('ul.meta a').first()).toBeVisible()

        // Act
        const targets = await chipTargets(page)

        // Assert
        expect(targets.filter((t) => !t.at20 || t.tall < 44)).toEqual([])
      })
    }
  })
}
