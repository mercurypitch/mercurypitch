// ============================================================
// A lesson tapped in the explorer brings its card's main button into view
// ============================================================
//
// The explorer's card opens under the map on a wide screen and under its
// row on a phone's list. On a tablet held sideways, and on a phone, the
// card's main button ("Start lesson", "Continue: step N", "Read again")
// landed below the screen while the page stood still, so a tap seemed to do
// nothing. The page now scrolls by the least that shows that button whole,
// under the masthead, and with reduced motion it gets there at once. A
// next-lesson card's link to the explorer shows the card the same way once
// its own jump has landed; a lesson coming later has no button, and its
// question stands in. At 1024 px wide the map's labels keep apart.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

/** The open card's main button, by its class: its words follow the viewer's progress. */
const MAIN = '.ex-actions .btn.primary'

/** Landscape tablets less their browser's bars, and a laptop's window. */
const LANDSCAPE = [
  { width: 1024, height: 672, touch: true, name: 'an iPad in Safari' },
  {
    width: 1024,
    height: 640,
    touch: true,
    name: 'an iPad in Safari, tab bar shown',
  },
  { width: 1080, height: 697, touch: true, name: 'a 10.2-inch iPad in Safari' },
  { width: 1133, height: 631, touch: true, name: 'an iPad mini in Safari' },
  {
    width: 1280,
    height: 680,
    touch: true,
    name: 'an Android tablet in Chrome',
  },
  {
    width: 1366,
    height: 657,
    touch: false,
    name: "a 1366 x 768 laptop's window",
  },
] as const

/** Where the element `sel` finds sits against the masthead and the screen's foot, px. */
function placeOf(
  page: Page,
  sel: string,
): Promise<{ top: number; bottom: number; mast: number; foot: number }> {
  return page.evaluate((sel) => {
    const r = document.querySelector(sel)?.getBoundingClientRect()
    return {
      top: r?.top ?? Number.NaN,
      bottom: r?.bottom ?? Number.NaN,
      mast:
        document.querySelector('#mast')?.getBoundingClientRect().bottom ?? 0,
      foot: window.visualViewport?.height ?? window.innerHeight,
    }
  }, sel)
}

/** The element `sel` finds is wholly on screen, below the masthead, within `timeout` ms. */
async function expectInView(
  page: Page,
  sel: string,
  timeout?: number,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const b = await placeOf(page, sel)
        return b.top >= b.mast && b.bottom <= b.foot
      },
      timeout === undefined ? {} : { timeout },
    )
    .toBe(true)
}

/** The open card's main button is wholly on screen, below the masthead, within `timeout` ms. */
async function expectMainInView(page: Page, timeout?: number): Promise<void> {
  await expectInView(page, `#explorer ${MAIN}`, timeout)
}

/** Scrolls the page, at once, so the map's top sits just under the masthead. */
async function mapUnderMast(page: Page): Promise<void> {
  await page.evaluate(() => {
    const mast =
      document.querySelector('#mast')?.getBoundingClientRect().bottom ?? 0
    const top = document.querySelector('#graph')?.getBoundingClientRect().top
    if (top === undefined) throw new Error('no map')
    window.scrollTo({
      top: window.scrollY + top - mast - 8,
      behavior: 'instant',
    })
  })
}

/** Scrolls the page, at once, so lesson `n`'s row sits at the foot of the screen, 20 px above it. */
async function rowLow(page: Page, n: number): Promise<void> {
  await page.evaluate((n) => {
    const r = document
      .querySelector(`#exList [data-n="${n}"]`)
      ?.getBoundingClientRect()
    if (r === undefined) throw new Error(`no row for lesson ${n}`)
    window.scrollTo({
      top: window.scrollY + r.bottom - window.innerHeight + 20,
      behavior: 'instant',
    })
  }, n)
}

for (const { width, height, touch, name } of LANDSCAPE) {
  test.describe(`on ${name}, ${width} x ${height}`, () => {
    test.use({ viewport: { width, height }, hasTouch: touch })

    test(`a tapped node scrolls its card in, as far as its main button${width === 1024 && height === 672 ? ' @smoke' : ''}`, async ({
      page,
    }) => {
      // Arrange: the map just under the masthead, its card below the screen
      await page.goto('/learn/01')
      await mapUnderMast(page)
      const node = page.locator('#graph button.node[aria-label^="Lesson 2:"]')

      // Act
      if (touch) await node.tap()
      else await node.click()

      // Assert
      await expectMainInView(page)
      await expect(page.locator('#exStatus')).toHaveText(
        'Lesson 2, Twelve notes: card below',
      )
    })
  })
}

test.describe('on an iPad in Safari, 1024 x 672', () => {
  test.use({ viewport: { width: 1024, height: 672 }, hasTouch: true })

  test("a next-lesson card's link opens the explorer on a lesson coming later, its card in view as far as its question", async ({
    page,
  }) => {
    // Arrange: Lesson 6's card leads to Lesson 7, coming later, whose card has no button
    await page.goto('/learn/06')
    const next = page.locator('#wrap [data-select-lesson]')
    // at once: Playwright's own scroll into view races the page's smooth one
    await next.evaluate((el) =>
      el.scrollIntoView({ block: 'center', behavior: 'instant' }),
    )

    // Act
    await next.tap()

    // Assert: its question stands in for the button
    await expect(page.locator('#exCardHost h3')).toHaveText(
      'Slides, sirens and your range',
    )
    await expectInView(page, '#exCardHost .hookq')
  })
})

for (const [width, height, name] of [
  [390, 844, 'a phone'],
  [844, 390, 'a phone held sideways'],
] as const) {
  test.describe(`on ${name}, ${width} x ${height}`, () => {
    test.use({ viewport: { width, height }, hasTouch: true, isMobile: true })

    test('a row tapped at the foot of the screen opens its card and scrolls it in, as far as its main button', async ({
      page,
    }) => {
      // Arrange
      await page.goto('/learn/01')
      await rowLow(page, 2)

      // Act
      await page.locator('#exList [data-n="2"] button.it').tap()

      // Assert
      await expect(page.locator('#exList .ex-detail .ex-card')).toBeVisible()
      await expectMainInView(page)
    })
  })
}

test.describe('with reduced motion, 1024 x 672', () => {
  test.use({ viewport: { width: 1024, height: 672 }, hasTouch: true })

  test('the main button is in view within 200 ms: the page jumps, it does not glide', async ({
    page,
  }) => {
    // Arrange
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/learn/01')
    await mapUnderMast(page)

    // Act
    await page.locator('#graph button.node[aria-label^="Lesson 2:"]').tap()

    // Assert
    await expectMainInView(page, 200)
  })
})

test.describe('the map at 1024 x 768', () => {
  test.use({ viewport: { width: 1024, height: 768 } })

  test('keeps 4 px between any two lesson labels on a line', async ({
    page,
  }) => {
    // Arrange
    await page.goto('/learn/01')
    await page.locator('#graph').scrollIntoViewIfNeeded()
    await page.evaluate(() => document.fonts.ready)

    // Act: every label's lines of text, as boxes
    const touching = await page.evaluate(() => {
      const lines = Array.from(document.querySelectorAll('#graph .nlabel')).map(
        (el) => {
          const range = document.createRange()
          range.selectNodeContents(el)
          return {
            text: el.textContent ?? '',
            boxes: Array.from(range.getClientRects()),
          }
        },
      )
      const pairs: string[] = []
      for (let i = 0; i < lines.length; i++)
        for (let j = i + 1; j < lines.length; j++)
          for (const a of lines[i].boxes)
            for (const b of lines[j].boxes) {
              const across =
                Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
              const apart = Math.max(b.left - a.right, a.left - b.right)
              if (across > 2 && apart < 4)
                pairs.push(`${lines[i].text} / ${lines[j].text}`)
            }
      return pairs
    })

    // Assert
    expect(touching).toEqual([])
  })
})
