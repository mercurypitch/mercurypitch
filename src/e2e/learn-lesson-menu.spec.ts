// ============================================================
// The lesson menu: the season, opened from every lesson page's masthead
// ============================================================
//
// The masthead's "Season 1 · Lesson 02" is a button that opens the season in
// a native modal dialog (kit/lesson-menu.ts): a dropdown under the button on
// a desktop or a tablet, a sheet under the masthead on a phone, where it also
// carries the page's sections. These are the checks the lesson polish plan
// sets for it: focus goes to this lesson's row and comes back to the button
// however the panel closes; Tab stays inside it; every row and step is a
// 44 px target and a lesson coming later is no link; reduced motion opens it
// without its fade; and its links land, on this page or on another lesson's.
// Lessons 6, 7 and 8, pages with no film, are checked on their own as well:
// the button's name, a tapped step, and the phone sheet's three sections.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'

/** The masthead's button that opens the season. */
const trigger = (page: Page): Locator =>
  page.getByRole('button', { name: / All \d+ lessons$/ })

const menu = (page: Page): Locator => page.locator('#lessonMenu')

/** This lesson's row, where the panel puts focus. */
const hereRow = (page: Page): Locator =>
  menu(page).locator('.lm-row[aria-current="page"]')

/**
 * Where focus is: in the panel, out of the document (the browser's own
 * controls, which a native modal dialog lets Tab reach past its last link),
 * or on the page behind, by its markup.
 */
const focusAt = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const el = document.activeElement
    if (el === null || el === document.body) return 'the browser'
    if (el.closest('#lessonMenu') !== null) return 'the panel'
    return el.outerHTML.slice(0, 120)
  })

/** Waits out the panel's opening fade, so a box is measured at rest. */
const settled = (page: Page): Promise<void> =>
  menu(page).evaluate(async (d) => {
    await Promise.all(d.getAnimations({ subtree: true }).map((a) => a.finished))
  })

test.describe('on a tablet in landscape, 1024 x 672 with touch', () => {
  test.use({ viewport: { width: 1024, height: 672 }, hasTouch: true })

  test("a tap opens the season on this lesson's row; Escape closes it and focus is back on the button @smoke", async ({
    page,
  }) => {
    // Arrange
    await page.goto('/learn/02')
    const btn = trigger(page)
    await expect(btn).toHaveAccessibleName(
      'Season 1 · Lesson 02, Twelve notes. All 14 lessons',
    )

    // Act
    await btn.tap()

    // Assert
    await expect(menu(page)).toBeVisible()
    await expect(btn).toHaveAttribute('aria-expanded', 'true')
    await expect(hereRow(page)).toBeFocused()
    await expect(hereRow(page)).toHaveAttribute('href', '#top')

    // Act
    await page.keyboard.press('Escape')

    // Assert
    await expect(menu(page)).toBeHidden()
    await expect(btn).toHaveAttribute('aria-expanded', 'false')
    await expect(btn).toBeFocused()
  })

  test('the close button and a tap beside the panel each close it, focus back on the button @smoke', async ({
    page,
  }) => {
    // Arrange
    await page.goto('/learn/02')
    await trigger(page).tap()
    await expect(hereRow(page)).toBeFocused()

    // Act
    await menu(page).getByRole('button', { name: 'Close' }).tap()

    // Assert
    await expect(menu(page)).toBeHidden()
    await expect(trigger(page)).toBeFocused()

    // Arrange
    await trigger(page).tap()
    await expect(hereRow(page)).toBeFocused()
    const box = await menu(page).boundingBox()
    if (box === null) throw new Error('the panel has no box')

    // Act: on the dimmed page, right of the panel and below the masthead
    await page.touchscreen.tap(box.x + box.width + 60, box.y + 160)

    // Assert
    await expect(menu(page)).toBeHidden()
    await expect(trigger(page)).toHaveAttribute('aria-expanded', 'false')
    await expect(trigger(page)).toBeFocused()
  })

  test('a tapped step shows that step beside the stage, the menu closed @smoke', async ({
    page,
  }) => {
    // Arrange: every move lands at once
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/learn/02')
    await trigger(page).tap()
    await expect(hereRow(page)).toBeFocused()

    // Act
    await menu(page)
      .getByRole('link', { name: /^Step 4: / })
      .tap()

    // Assert
    await expect(menu(page)).toBeHidden()
    await expect(page.locator('#stepNow')).toHaveText('4')
    const step = page.locator('#lesson .step[data-step="4"]')
    await expect(step).toHaveClass(/\bis-active\b/)
    await expect(step).toBeInViewport()
  })
})

test('by keyboard: Tab reaches the button, Enter opens it, and Tab stays inside @smoke', async ({
  page,
}) => {
  // Arrange
  await page.goto('/learn/02')
  await expect(trigger(page)).toBeVisible()
  await page.locator('#mast .brand').focus()

  // Act
  await page.keyboard.press('Tab')
  await expect(trigger(page)).toBeFocused()
  await page.keyboard.press('Enter')

  // Assert: open on this lesson's row; thirty Tabs, round the panel and past
  // its end, never reach the page behind it, and come round to its start
  await expect(hereRow(page)).toBeFocused()
  const close = menu(page).getByRole('button', { name: 'Close' })
  const behind: string[] = []
  let round = false
  for (let i = 1; i <= 30; i += 1) {
    await page.keyboard.press('Tab')
    const at = await focusAt(page)
    if (at !== 'the panel' && at !== 'the browser') behind.push(at)
    round ||= await close.evaluate((b) => b === document.activeElement)
  }
  expect(behind).toEqual([])
  expect(round).toBe(true)
  expect(await focusAt(page)).toBe('the panel')
})

test.describe('on a phone, 390 x 844', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })

  test("the sheet carries the page's sections, and a tapped one closes it and scrolls there @smoke", async ({
    page,
  }) => {
    // Arrange: every move lands at once
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/learn/02')
    await expect(page.locator('#mastNav')).toBeHidden()
    const sections = await page.locator('#mastNav a').evaluateAll((links) =>
      links
        .filter((a) => {
          const to = document.querySelector(a.getAttribute('href') ?? '')
          return (
            a.closest('[hidden]') === null &&
            to !== null &&
            to.closest('[hidden]') === null
          )
        })
        .map((a) => a.getAttribute('href')),
    )
    await trigger(page).tap()
    const onPage = menu(page).getByRole('navigation', { name: 'On this page' })
    const chips = onPage.getByRole('link')

    // Assert: the masthead's sections, in its order
    await expect(onPage).toBeVisible()
    expect(
      await chips.evaluateAll((links) =>
        links.map((a) => a.getAttribute('href')),
      ),
    ).toEqual(sections)

    // Act
    await onPage.locator('a[href="#explorer"]').tap()

    // Assert: closed, focus back on the button, and the map's section just
    // under the masthead (58 px, and the page's 12 px of scroll padding)
    await expect(menu(page)).toBeHidden()
    await expect(trigger(page)).toBeFocused()
    const top = await page
      .locator('#explorer')
      .evaluate((el) => Math.round(el.getBoundingClientRect().top))
    expect(top).toBe(70)
  })
})

test.describe('on a phone, 390 x 844, with a section hidden', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })

  const HIDDEN = [
    { how: 'with its masthead link until its film can play', link: true },
    { how: 'while its masthead link still shows', link: false },
  ] as const

  for (const h of HIDDEN) {
    test(`Watch, hidden ${h.how}, is not offered @smoke`, async ({ page }) => {
      // Arrange: Lesson 2 with its Watch section hidden
      await page.goto('/learn/02')
      await expect(trigger(page)).toBeVisible()
      await page
        .locator('#watch')
        .evaluate((section) => section.setAttribute('hidden', ''))
      await page
        .locator('#mastNav a[href="#watch"]')
        .evaluate((a, hide) => a.toggleAttribute('hidden', hide), h.link)

      // Act
      await trigger(page).tap()

      // Assert
      const onPage = menu(page).getByRole('navigation', {
        name: 'On this page',
      })
      await expect(onPage.getByRole('link')).toHaveText(['Lesson', 'Explorer'])
    })
  }
})

// the pages with no film, each its name in the menu's button
const NO_FILM = [
  { n: 6, title: 'Intervals: the distance between notes' },
  { n: 7, title: 'Slides, sirens and your range' },
  { n: 8, title: 'Beat, tempo and the backbeat' },
] as const

for (const { n, title } of NO_FILM) {
  const path = `/learn/${String(n).padStart(2, '0')}`

  test.describe(`on Lesson ${n}, a page with no film`, () => {
    test.describe('on a tablet in landscape, 1024 x 672 with touch', () => {
      test.use({ viewport: { width: 1024, height: 672 }, hasTouch: true })

      test(`the button names Lesson ${n}, and a tapped step shows that step beside the stage @smoke`, async ({
        page,
      }) => {
        // Arrange: every move lands at once
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.goto(path)
        await expect(trigger(page)).toHaveAccessibleName(
          `Season 1 · Lesson ${String(n).padStart(2, '0')}, ${title}. All 14 lessons`,
        )
        await trigger(page).tap()
        await expect(hereRow(page)).toBeFocused()
        // the page's five steps, each its own link
        await expect(
          menu(page).getByRole('link', { name: /^Step \d: / }),
        ).toHaveCount(5)

        // Act
        await menu(page)
          .getByRole('link', { name: /^Step 4: / })
          .tap()

        // Assert
        await expect(menu(page)).toBeHidden()
        await expect(page.locator('#stepNow')).toHaveText('4')
        const step = page.locator('#lesson .step[data-step="4"]')
        await expect(step).toHaveClass(/\bis-active\b/)
        await expect(step).toBeInViewport()
      })
    })

    test.describe('on a phone, 390 x 844', () => {
      test.use({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      })

      test("the sheet offers the page's three sections, and no Watch @smoke", async ({
        page,
      }) => {
        // Arrange
        await page.goto(path)
        await expect(trigger(page)).toBeVisible()

        // Act
        await trigger(page).tap()

        // Assert
        const onPage = menu(page).getByRole('navigation', {
          name: 'On this page',
        })
        await expect(onPage.getByRole('link')).toHaveText([
          'Lesson',
          'Sing',
          'Explorer',
        ])
      })
    })
  })
}

const LAYOUTS = [
  { name: 'a desktop', width: 1440, height: 900 },
  { name: 'a tablet in landscape', width: 1024, height: 672 },
  { name: 'a phone', width: 390, height: 844 },
  { name: 'a phone in landscape', width: 844, height: 390 },
] as const

for (const l of LAYOUTS) {
  test(`on ${l.name} (${l.width} x ${l.height}) every row and step is a 44 px target, and a lesson coming later is no link @smoke`, async ({
    page,
  }) => {
    // Arrange
    await page.setViewportSize({ width: l.width, height: l.height })
    await page.goto('/learn/02')
    await expect(trigger(page)).toBeVisible()

    // Act
    await trigger(page).click()

    // Assert: open on this lesson's row, scrolled into the panel's view
    await expect(hereRow(page)).toBeFocused()
    await expect(hereRow(page)).toBeInViewport()
    await settled(page)
    const small = await page
      .locator(
        '.lm-btn, #lessonMenu :is(.lm-row, .lm-steps a, .lm-onpage a, .lm-here, .lm-foot a, .lm-x)',
      )
      .evaluateAll((els) =>
        els
          .filter((el) => el.getClientRects().length > 0)
          .map((el) => {
            const r = el.getBoundingClientRect()
            return {
              what: el.textContent?.trim() ?? '',
              w: r.width,
              h: r.height,
            }
          })
          .filter((s) => s.w < 44 || s.h < 44),
      )
    expect(small).toEqual([])
    // a lesson coming later is a plain list item: no link and no tab stop
    const later = await menu(page)
      .locator('.lm-row.later')
      .evaluateAll((rows) =>
        rows.map((r) =>
          r.matches('div:not([tabindex])') && r.closest('a') === null
            ? 'plain'
            : r.outerHTML,
        ),
      )
    expect(later).not.toEqual([])
    expect(later.filter((r) => r !== 'plain')).toEqual([])
    const leap = menu(page)
      .getByRole('listitem')
      .filter({ hasText: 'Lesson 9, Landing a leap, coming later' })
    await expect(leap).toHaveCount(1)
    await expect(leap.getByRole('link')).toHaveCount(0)
  })
}

test('under reduced motion the panel opens without its fade @smoke', async ({
  page,
}) => {
  // Arrange: the panel's motion, in seconds, on the dialog and its backdrop
  const motion = (): Promise<string[]> =>
    menu(page).evaluate((d) =>
      [getComputedStyle(d), getComputedStyle(d, '::backdrop')].map(
        (s) => `${s.animationName} ${s.animationDuration}`,
      ),
    )
  await page.goto('/learn/02')
  await trigger(page).click()
  await expect(hereRow(page)).toBeFocused()
  expect(await motion()).toEqual(['lm-in 0.16s', 'lm-fade 0.16s'])
  await page.keyboard.press('Escape')
  await expect(menu(page)).toBeHidden()

  // Act
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await trigger(page).click()
  await expect(hereRow(page)).toBeFocused()

  // Assert: no animation at all, and no time for one
  const [dialog, backdrop] = await motion()
  expect(backdrop).toBe('none 0s')
  const time = /^none ([\d.e-]+)(m?s)$/.exec(dialog)
  expect(time).not.toBeNull()
  const seconds = Number(time?.[1]) / (time?.[2] === 'ms' ? 1000 : 1)
  expect(seconds).toBeLessThan(0.001)
})

test("a ready lesson's row loads its page @smoke", async ({ page }) => {
  // Arrange: a first visit, nothing done yet
  await page.goto('/learn/01')
  await trigger(page).click()
  const row = menu(page).getByRole('link', {
    name: 'Lesson 4, The major scale and home, ready, 14 minutes',
  })
  await expect(row).toHaveAttribute('href', '/learn/04')

  // Act
  await row.click()

  // Assert
  await expect(page).toHaveURL(/\/learn\/04$/)
  await expect(trigger(page)).toHaveAccessibleName(
    'Season 1 · Lesson 04, The major scale and home. All 14 lessons',
  )
})
