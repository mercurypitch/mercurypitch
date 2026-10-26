// ============================================================
// The plan's typed lines above a phone's keyboard
// ============================================================
//
// Q3's "Something else" and Q4's "Another app" each open a line to type in,
// focused, so the phone's keyboard comes up. The keyboard shrinks the visual
// viewport and nothing else: First Light's fixed overlay and the questions'
// scroll region keep their full height, and the line stayed under the
// keyboard (owner, on a phone). At 390x844 with a 336 px keyboard the Q3
// line sat 264 px under it and the Q4 line 189 px, while the region could
// scroll 26 px and 0 px.
//
// Headless Chromium has no soft keyboard, so this stands in for one: the
// page gets a stand-in `window.visualViewport` whose height drops by a
// keyboard's height, with the `resize` a phone fires. The check is the one
// that matters on the phone: the focused line's box lies inside what is
// still visible, [offsetTop, offsetTop + height].
//
// One case forces the region's padding at its foot to 0, as Safari 26 leaves
// a flex column's block-axis padding out of its scroll range (WebKit bug
// 316902): room made of padding would not reach an iPhone running it, so the
// line must still come up with that padding gone. Chromium has no such bug,
// and this is the closest it can stand in.
//
// The questions are reached the way a Google sign-in comes back to them (the
// resume marker in storage), not through a sung note: the beat and its frame
// are the same either way (measured: the same boxes to the pixel on both
// routes), and this way no microphone deadline can fail the spec.
//
// The other keyboard, a hardware one, has a case here too: Tab on the plan
// meets the cards before the ways on, and Start here, the main button, first
// among them, with Not now last.

import { expect, test } from '@playwright/test'
import { FRESH_VISITOR_INIT } from './helpers/tone-wav'

/** An iPhone's portrait keyboard with its suggestion bar, in CSS px. */
const KEYBOARD = 336

/**
 * The questions' scroll region with no padding at its foot, whatever is set
 * inline: Safari 26 leaves that padding out of the scroll range anyway.
 */
const NO_FOOT_PADDING = `
  [data-beat='questions'] :has(> [aria-live]) {
    padding-bottom: 0 !important;
  }
`

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
})

/**
 * A visual viewport the spec can shrink: an EventTarget with the fields a
 * page reads, whose height is the window's less the keyboard's.
 */
function standInViewport(): void {
  let keyboard = 0
  const viewport = new EventTarget()
  const field = (name: string, read: () => number): void => {
    Object.defineProperty(viewport, name, { get: read, enumerable: true })
  }
  field('height', () => window.innerHeight - keyboard)
  field('width', () => window.innerWidth)
  field('offsetTop', () => 0)
  field('offsetLeft', () => 0)
  field('pageTop', () => window.scrollY)
  field('pageLeft', () => window.scrollX)
  field('scale', () => 1)
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    get: () => viewport,
  })
  Object.assign(window, {
    __keyboard: (height: number) => {
      keyboard = height
      viewport.dispatchEvent(new Event('resize'))
    },
  })
}

/** Open the plan on its questions, as a sign-in redirect does. */
function resumeOnTheQuestions(): void {
  try {
    if (sessionStorage.getItem('e2e.plan-keyboard') === '1') return
    sessionStorage.setItem('e2e.plan-keyboard', '1')
    localStorage.setItem('pitchperfect_onboarding_resume', 'questions')
  } catch {
    /* storage blocked: the flow opens from the top and the spec fails */
  }
}

type Page = import('@playwright/test').Page

const questions = (page: Page) => page.locator('[data-beat="questions"]')

async function toTheThirdQuestion(page: Page): Promise<void> {
  await page.goto('/')
  const q = questions(page)
  await expect(q.getByText('Question 1 of 4')).toBeVisible({ timeout: 15000 })
  await q.getByRole('button', { name: 'Skip', exact: true }).tap()
  await expect(q.getByText('Question 2 of 4')).toBeVisible()
  await q.getByRole('button', { name: 'Skip', exact: true }).tap()
  await expect(q.getByText('Question 3 of 4')).toBeVisible()
}

async function raiseTheKeyboard(page: Page): Promise<void> {
  await page.evaluate((height) => {
    ;(window as unknown as { __keyboard: (h: number) => void }).__keyboard(
      height,
    )
  }, KEYBOARD)
}

/**
 * How far the focused element's box lies outside what is visible: 0 when it
 * is all in view, else the px under the keyboard (or above the top).
 */
async function pxOutOfView(page: Page): Promise<number> {
  return page.evaluate(() => {
    const viewport = window.visualViewport!
    const box = document.activeElement!.getBoundingClientRect()
    const top = viewport.offsetTop
    const bottom = top + viewport.height
    return Math.max(0, box.bottom - bottom) + Math.max(0, top - box.top)
  })
}

/** The questions' scroll region: the root that holds Merc's line. */
async function regionScrollTop(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      document.querySelector('[data-beat="questions"] [aria-live]')!
        .parentElement!.scrollTop,
  )
}

/**
 * The furthest the region is scrolled over the next `ms`, a frame at a
 * time, so a glide still running from the last screen cannot pass unseen.
 */
async function furthestScrollOver(page: Page, ms: number): Promise<number> {
  return page.evaluate(
    (span) =>
      new Promise<number>((resolve) => {
        const region = document.querySelector(
          '[data-beat="questions"] [aria-live]',
        )!.parentElement!
        const until = performance.now() + span
        let furthest = region.scrollTop
        const look = (): void => {
          furthest = Math.max(furthest, region.scrollTop)
          if (performance.now() < until) requestAnimationFrame(look)
          else resolve(furthest)
        }
        requestAnimationFrame(look)
      }),
    ms,
  )
}

test.describe('the plan on a phone with its keyboard up', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(FRESH_VISITOR_INIT)
    await page.addInitScript(resumeOnTheQuestions)
    await page.addInitScript(standInViewport)
  })

  test('lifts the "Something else" line on Q3 above the keyboard', async ({
    page,
  }) => {
    // Arrange: Q3, with its typed line open and focused
    await toTheThirdQuestion(page)
    await questions(page).getByRole('button', { name: 'Something else' }).tap()
    await expect(
      page.getByRole('textbox', { name: 'Something else, in a few words' }),
    ).toBeFocused()

    // Act
    await raiseTheKeyboard(page)

    // Assert
    await expect.poll(() => pxOutOfView(page)).toBe(0)
  })

  test("lifts the Q3 line with the region's foot padding out of its scroll range", async ({
    page,
  }) => {
    // Arrange: Q3's line open and focused, the region's foot padding gone
    await toTheThirdQuestion(page)
    await page.addStyleTag({ content: NO_FOOT_PADDING })
    await questions(page).getByRole('button', { name: 'Something else' }).tap()
    await expect(
      page.getByRole('textbox', { name: 'Something else, in a few words' }),
    ).toBeFocused()

    // Act
    await raiseTheKeyboard(page)

    // Assert
    await expect.poll(() => pxOutOfView(page)).toBe(0)
  })

  test('lifts the "Another app" line on Q4 above the keyboard', async ({
    page,
  }) => {
    // Arrange: Q4, with its typed line open and focused
    await toTheThirdQuestion(page)
    await questions(page).getByRole('button', { name: 'Skip this one' }).tap()
    await expect(questions(page).getByText('Question 4 of 4')).toBeVisible()
    await questions(page).getByRole('button', { name: 'Another app' }).tap()
    await expect(
      page.getByRole('textbox', { name: 'Which app?' }),
    ).toBeFocused()

    // Act
    await raiseTheKeyboard(page)

    // Assert
    await expect.poll(() => pxOutOfView(page)).toBe(0)
  })

  test('still opens Q4 at its top when Next is tapped with the keyboard up', async ({
    page,
  }) => {
    // Arrange: Q3's line lifting above the keyboard, so the region scrolls
    await toTheThirdQuestion(page)
    await questions(page).getByRole('button', { name: 'Something else' }).tap()
    await raiseTheKeyboard(page)
    await expect.poll(() => regionScrollTop(page)).toBeGreaterThan(0)

    // Act
    await questions(page).getByRole('button', { name: 'Next' }).tap()

    // Assert
    await expect(questions(page).getByText('Question 4 of 4')).toBeVisible()
    expect(await furthestScrollOver(page, 600)).toBe(0)
  })
})

/**
 * What each Tab stop is, in the order Tab meets them: a card by its kind, the
 * menu switch, or a button by its words.
 */
function tabStopName(): string {
  const el = document.activeElement as HTMLElement | null
  if (el === null) return ''
  if (el.dataset.kind !== undefined) return `card:${el.dataset.kind}`
  if (el.getAttribute('role') === 'switch') return 'switch'
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim()
}

test.describe('the plan from the keyboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(FRESH_VISITOR_INIT)
    await page.addInitScript(resumeOnTheQuestions)
  })

  test('Tab meets the plan before the ways on, and Start here first among them', async ({
    page,
  }) => {
    // Arrange: past the four questions, on the plan, its heading focused
    await toTheThirdQuestion(page)
    await questions(page).getByRole('button', { name: 'Skip this one' }).tap()
    await expect(questions(page).getByText('Question 4 of 4')).toBeVisible()
    await questions(page).getByRole('button', { name: 'Skip to my plan' }).tap()
    await expect(
      questions(page).getByRole('heading', { level: 1 }),
    ).toBeFocused()
    const plan = await questions(page).evaluate((root) =>
      [
        ...root.querySelectorAll<HTMLElement>('[data-kind], [role="switch"]'),
      ].map((el) =>
        el.dataset.kind !== undefined ? `card:${el.dataset.kind}` : 'switch',
      ),
    )

    // Act: Tab from the heading until the way out
    const met: string[] = []
    while (met.at(-1) !== 'Not now' && met.length < 20) {
      await page.keyboard.press('Tab')
      met.push(await page.evaluate(tabStopName))
    }

    // Assert
    expect(met).toEqual([
      ...plan,
      'Start here',
      'Show me around',
      'See every room',
      'Not now',
    ])
  })
})
