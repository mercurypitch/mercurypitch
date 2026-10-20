// ============================================================
// Every step's stage fits a short screen: no control out of reach
// ============================================================
//
// Beside the text the figure stage is sticky under the masthead. On a
// landscape tablet in its browser, or in a laptop's window, it was taller
// than the room the screen leaves, and while a step showed, its lowest
// controls could not be reached at all: scrolling on picked the next step.
// The kit now caps the figure at the room its toy leaves (kit/stage-fit.ts,
// kit/lesson-stage.css), and a stage still over budget scrolls inside
// itself. Every lesson the e2e bundle carries is held to it, so a new lesson
// joins on its first build:
//
// - at four short landscape sizes, once the stage is stuck, every control of
//   every step is on screen, or gets there with the stage's own scroll, which
//   may be at most 60 px (more is a toy over budget, to fix in the toy);
// - on a phone held sideways, the deck's figure and its toy's first control
//   share the screen;
// - every control is at least 44 px each way, and nothing scrolls sideways.
//
// Reduced motion keeps every scroll instant. It is also the taller stage:
// Lesson 3's chase lists its readings under the figure instead of moving.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { builtLessons, lessonPath } from '../../tools/draft-lessons'

const REPO = fileURLToPath(new URL('../..', import.meta.url))

/** Every lesson page the e2e bundle carries (`build:e2e` shows the drafts). */
const LESSONS = builtLessons(REPO, true)

/** Short landscape screens: tablets less their browser's bars, and a laptop's window. */
const SHORT = [
  {
    width: 1024,
    height: 640,
    touch: true,
    name: 'an iPad in Safari, tab bar shown',
  },
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

/** The stage's own scroll a toy may need, px. */
const STAGE_SCROLL_BUDGET = 60

interface StuckFit {
  step: string
  sticky: boolean
  small: string[]
  unreachable: string[]
  stageScroll: number
  sideways: number
}

interface SharedScreen {
  deck: boolean
  figure: boolean
  firstControl: string
  firstControlOnScreen: boolean
  small: string[]
  sideways: number
}

/**
 * Opens step `n` from the address, as a recall link does, and waits for the
 * deck's scroll to the step to come to rest (five frames without moving),
 * so the stage's fit has landed and no scroll of the test's own cuts it short.
 */
async function openStep(page: Page, n: number): Promise<void> {
  await page.evaluate((s) => {
    window.location.hash = `#step-${s}`
  }, n)
  await expect(page.locator('#stepNow')).toHaveText(String(n))
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        let last = Number.NaN
        let still = 0
        const frame = (): void => {
          still = window.scrollY === last ? still + 1 : 0
          last = window.scrollY
          if (still >= 5) done()
          else requestAnimationFrame(frame)
        }
        requestAnimationFrame(frame)
      }),
  )
}

/**
 * Scrolls the page until the stage sticks, then reads the active toy's
 * controls at the stage's own scroll top and at its foot: those under 44 px,
 * and those on screen at neither. Leaves the stage's scroll at its top.
 */
function stuckStageFit(): StuckFit {
  const stage = document.querySelector<HTMLElement>('#stepsStage')
  const card = stage?.querySelector<HTMLElement>('.stage-card')
  const mast = document.querySelector('#mast')?.getBoundingClientRect().bottom
  if (!stage || !card || mast === undefined) throw new Error('no stage')
  const stickAt = parseFloat(getComputedStyle(stage).top)
  window.scrollBy({
    top: stage.getBoundingClientRect().top - stickAt,
    behavior: 'instant',
  })
  const controls = Array.from(
    stage.querySelectorAll<HTMLElement>(
      '.toy.is-active :is(button, input, [role="slider"])',
    ),
  ).filter((el) => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && getComputedStyle(el).visibility !== 'hidden'
  })
  const name = (el: HTMLElement): string =>
    (el.getAttribute('aria-label') || el.textContent?.trim() || `#${el.id}`)
      .replace(/\s+/g, ' ')
      .slice(0, 40)
  const onScreen = (el: HTMLElement): boolean => {
    const r = el.getBoundingClientRect()
    const c = card.getBoundingClientRect()
    return (
      r.top >= Math.max(mast, c.top) - 0.5 &&
      r.bottom <= Math.min(window.innerHeight, c.bottom) + 0.5
    )
  }
  card.scrollTop = 0
  const atHead = controls.filter(onScreen)
  card.scrollTop = card.scrollHeight
  const atFoot = controls.filter(onScreen)
  card.scrollTop = 0
  const root = document.documentElement
  return {
    step: document.querySelector('#stepNow')?.textContent ?? '',
    sticky: getComputedStyle(stage).position === 'sticky',
    small: controls
      .filter((el) => {
        const r = el.getBoundingClientRect()
        return r.width < 44 || r.height < 44
      })
      .map(name),
    unreachable: controls
      .filter((el) => !atHead.includes(el) && !atFoot.includes(el))
      .map(name),
    stageScroll: card.scrollHeight - card.clientHeight,
    sideways: root.scrollWidth - root.clientWidth,
  }
}

/**
 * Scrolls the active toy's figure and its first control (in reading order)
 * up under the masthead together, and says whether both are then on screen.
 */
function figureAndFirstControl(): SharedScreen {
  const toy = document.querySelector('#stepsStage .toy.is-active')
  const mast = document.querySelector('#mast')?.getBoundingClientRect().bottom
  if (!toy || mast === undefined) throw new Error('no toy')
  const controls = Array.from(
    toy.querySelectorAll<HTMLElement>('button, input, [role="slider"]'),
  ).filter((el) => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && getComputedStyle(el).visibility !== 'hidden'
  })
  const first = controls[0]
  // the figure on show: a toy with two views (Lesson 5's breath gauge and
  // breath figure) keeps the other one's figure in its markup, hidden
  const figure =
    Array.from(toy.querySelectorAll('.viz')).find(
      (el) => el.getClientRects().length > 0,
    ) ?? first
  const top = Math.min(
    figure.getBoundingClientRect().top,
    first.getBoundingClientRect().top,
  )
  window.scrollBy({ top: top - mast, behavior: 'instant' })
  const onScreen = (el: Element): boolean => {
    const r = el.getBoundingClientRect()
    return r.top >= mast - 0.5 && r.bottom <= window.innerHeight + 0.5
  }
  const root = document.documentElement
  return {
    deck:
      document.querySelector('#lesson')?.classList.contains('is-deck') ?? false,
    figure: onScreen(figure),
    firstControl: (
      first.getAttribute('aria-label') ||
      first.textContent?.trim() ||
      `#${first.id}`
    )
      .replace(/\s+/g, ' ')
      .slice(0, 40),
    firstControlOnScreen: onScreen(first),
    small: controls
      .filter((el) => {
        const r = el.getBoundingClientRect()
        return r.width < 44 || r.height < 44
      })
      .map((el) => el.textContent?.trim() || `#${el.id}`),
    sideways: root.scrollWidth - root.clientWidth,
  }
}

test('the spec walks every lesson page, the drafts among them', () => {
  // later lessons join on their own; the first three are on main
  expect(LESSONS.slice(0, 3)).toEqual([1, 2, 3])
})

for (const size of SHORT) {
  test.describe(`at ${size.width} x ${size.height}, ${size.name}`, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      hasTouch: size.touch,
      isMobile: size.touch,
      contextOptions: { reducedMotion: 'reduce' },
    })

    for (const n of LESSONS) {
      test(`Lesson ${n}: every control of every step is in reach while its step shows`, async ({
        page,
      }) => {
        await page.goto(lessonPath(n))
        const count = await page.locator('#lesson .step').count()
        expect(count).toBeGreaterThan(0)
        for (let step = 1; step <= count; step++) {
          await openStep(page, step)
          await expect
            .poll(
              async () => (await page.evaluate(stuckStageFit)).unreachable,
              { message: `Lesson ${n}, step ${step}: controls out of reach` },
            )
            .toEqual([])
          const fit = await page.evaluate(stuckStageFit)
          expect(fit.step, `Lesson ${n}, step ${step}`).toBe(String(step))
          expect(fit.sticky, `Lesson ${n}, step ${step}`).toBe(true)
          expect(fit.small, `Lesson ${n}, step ${step}`).toEqual([])
          expect(
            fit.stageScroll,
            `Lesson ${n}, step ${step}: the stage's own scroll`,
          ).toBeLessThanOrEqual(STAGE_SCROLL_BUDGET)
          expect(fit.sideways, `Lesson ${n}, step ${step}`).toBe(0)
        }
      })
    }
  })
}

test.describe('at 844 x 390, a phone held sideways', () => {
  test.use({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    contextOptions: { reducedMotion: 'reduce' },
  })

  for (const n of LESSONS) {
    test(`Lesson ${n}: each step's figure and its first control share the screen`, async ({
      page,
    }) => {
      await page.goto(lessonPath(n))
      const count = await page.locator('#lesson .step').count()
      expect(count).toBeGreaterThan(0)
      for (let step = 1; step <= count; step++) {
        await openStep(page, step)
        const shared = await page.evaluate(figureAndFirstControl)
        expect(shared, `Lesson ${n}, step ${step}`).toEqual({
          deck: true,
          figure: true,
          firstControl: shared.firstControl,
          firstControlOnScreen: true,
          small: [],
          sideways: 0,
        })
      }
    })
  }
})

test.describe('at 1280 x 540, a window too short for a stuck stage', () => {
  test.use({
    viewport: { width: 1280, height: 540 },
    contextOptions: { reducedMotion: 'reduce' },
  })

  test('the one-card deck takes over, and its Next moves the step', async ({
    page,
  }) => {
    await page.goto(lessonPath(LESSONS[0]))

    await expect(page.locator('#lesson')).toHaveClass(/\bis-deck\b/)
    await expect(page.locator('#stepsStage')).toHaveCSS('position', 'relative')
    await page.locator('#deckNav [data-step-go="1"]').click()
    await expect(page.locator('#stepNow')).toHaveText('2')
  })
})
