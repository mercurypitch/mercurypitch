// ============================================================
// Every drill's setup screen, on every screen
// ============================================================
//
// The idle panel used to spend a row on the drill's icon, one on its
// description, one naming the dial, one on the dial, and two more on the timer
// and Start — under a header that had already said which drill this was. On a
// landscape tablet that did not fit and Start went under the fold.
//
// The icon moved up beside the title and the launch controls moved beside the
// dial. What follows checks the outcome for ALL EIGHTEEN drills rather than
// the two or three that were reported, because the setups vary more than the
// runs do: some have a dial, some a scale picker, some a timer, and two hide
// theirs behind a bottom sheet on phones. A layout that fits Siren and Long
// Note tells you very little about Guided Warmup.
//
// One page load per viewport, walking the gallery — eighteen separate loads
// would be eighteen cold starts for the same question.

import { expect, test } from '@playwright/test'
import { dismissOverlays, openNavTab, waitForNav } from './helpers/ui'

/** Every drill in the gallery, by the title on its card. */
const DRILLS = [
  'Guided Warmup',
  'Long Note',
  'Vibrato',
  'Slide In/Out',
  'Pitch Pursuit',
  'Mirror the Melody',
  'Pitch Hold',
  'Interval Trainer',
  'Scale Runner',
  'Arpeggio Jumper',
  'Drone Intonation',
  'Siren / Range Explorer',
  'Call & Response',
  'Dynamic Swell',
  'Chord Stacker',
  'Staccato Precision',
  'Routine Runner',
  'Sight-Singing',
] as const

const VIEWPORTS = [
  // A desktop, where the panel has room and simply should not look broken.
  { name: 'desktop', width: 1440, height: 900, mustFit: true },
  // The device the report came from: a Tab S9+ in landscape is 1400x876 CSS
  // px, and about 806 of that survives the browser chrome. Note the height —
  // it is ABOVE the 720px line that short-viewport.css keys on, so none of
  // the short-screen rules reach it. Everything that fixes this one has to
  // be either unconditional or keyed on width.
  { name: 'tablet-landscape', width: 1400, height: 806, mustFit: true },
  // The same tablet with more chrome, or a half-height desktop window. Here
  // the short-viewport rules do apply.
  { name: 'short-laptop', width: 1024, height: 560, mustFit: true },
  // A phone in portrait. This one is allowed to scroll: `.exercise-idle-start`
  // is sticky to the bottom of the card on phones by design (mobile-polish.css),
  // so the panel scrolls under a Start button that never leaves. What must
  // hold here is that Start is on screen, which is checked for every viewport.
  { name: 'phone', width: 390, height: 780, mustFit: false },
] as const

interface IdleShape {
  startInView: boolean
  overflow: number
  headerIcon: boolean
  placeholderIcon: boolean
  dial: Box | null
  launch: Box | null
}

interface Box {
  top: number
  right: number
  bottom: number
  left: number
}

/** What the setup screen looks like right now, in numbers. */
async function idleShape(
  page: import('@playwright/test').Page,
): Promise<IdleShape> {
  return page.evaluate(() => {
    const el = (s: string) => document.querySelector(s)
    const card = el('.exercise-canvas-area')
    const start = el('.exercise-idle-start')
    const dial = el('.exercise-idle-setup')
    const launch = el('.exercise-idle-launch')
    const startBox = start?.getBoundingClientRect()
    const box = (e: Element | null) => {
      if (e === null) return null
      const b = e.getBoundingClientRect()
      return { top: b.top, right: b.right, bottom: b.bottom, left: b.left }
    }
    // Inside the window AND inside the card. The card clips its own
    // overflow, so a Start button 40px below the card's bottom edge is
    // invisible even when the window still has room for it.
    const cardBox = card?.getBoundingClientRect()
    return {
      startInView:
        startBox !== undefined &&
        cardBox !== undefined &&
        startBox.top >= 0 &&
        startBox.bottom <= window.innerHeight + 1 &&
        startBox.top >= cardBox.top - 1 &&
        startBox.bottom <= cardBox.bottom + 1,
      overflow: (card?.scrollHeight ?? 0) - (card?.clientHeight ?? 0),
      headerIcon: el('.exercise-title-icon') !== null,
      placeholderIcon: el('.exercise-idle-placeholder svg') !== null,
      dial: box(dial),
      launch: box(launch),
    }
  })
}

test.describe('the setup screen fits, for every drill', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
      localStorage.setItem('pitchperfect_advanced_features', 'true')
    })
  })

  for (const vp of VIEWPORTS) {
    test(`all eighteen at ${vp.name}`, async ({ page }) => {
      test.slow()
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/')
      await waitForNav(page)
      await dismissOverlays(page)
      await openNavTab(page, 'tab-exercises')

      const problems: string[] = []

      for (const drill of DRILLS) {
        await page.locator('.exercise-card', { hasText: drill }).first().click()
        await expect(page.locator('.exercise-idle-start')).toBeVisible({
          timeout: 10000,
        })
        const shape = await idleShape(page)

        // The one that was actually reported: Start below the fold. Where
        // the panel is allowed to scroll, scrolling to the end has to bring
        // it back — a button you cannot reach at all is the failure, on any
        // screen.
        if (!shape.startInView) {
          if (vp.mustFit) {
            problems.push(`${drill}: Start off screen`)
          } else {
            await page.evaluate(() => {
              const card = document.querySelector('.exercise-canvas-area')
              card?.scrollTo({ top: card.scrollHeight })
            })
            const scrolled = await idleShape(page)
            if (!scrolled.startInView) {
              problems.push(`${drill}: Start unreachable even scrolled`)
            }
          }
        }

        // Fitting is the point everywhere there is a second axis to trade
        // into. A couple of pixels of rounding is not a scrollbar; forty is
        // the panel not fitting.
        if (vp.mustFit && shape.overflow > 2) {
          problems.push(`${drill}: card overflows by ${shape.overflow}px`)
        }

        // The icon belongs to the header now, and only to the header. A drill
        // that kept its 48px copy is spending the row this reclaimed.
        if (!shape.headerIcon) problems.push(`${drill}: no icon in the header`)
        if (shape.placeholderIcon) {
          problems.push(`${drill}: icon still in the idle panel`)
        }

        // Whichever way the two groups are arranged — beside on a wide
        // screen, stacked on a phone — they may not share pixels. Overlap is
        // the failure; either arrangement is fine.
        if (
          shape.dial !== null &&
          shape.launch !== null &&
          shape.dial.left < shape.launch.right - 1 &&
          shape.launch.left < shape.dial.right - 1 &&
          shape.dial.top < shape.launch.bottom - 1 &&
          shape.launch.top < shape.dial.bottom - 1
        ) {
          problems.push(`${drill}: setup and launch overlap`)
        }

        await page.locator('.back-btn').click()
        await expect(page.locator('.exercise-card').first()).toBeVisible({
          timeout: 10000,
        })
      }

      expect(problems, problems.join('\n')).toEqual([])
    })
  }
})

// ============================================================
// The controls under the dial
// ============================================================
//
// Five drills put something under their dial — a scale select, a style
// switch, a routine picker — and the setup column had no `gap` at all, so
// they arrived touching the dial and each other. The segmented controls had
// the matching problem on the other axis: a joined bar with hairline
// separators wraps as soon as its column is narrower than its labels, and a
// wrapped joined bar has its rounded ends in the middle of a row. That is
// what "Custom overflowing to another row, it looks really awful" was.
//
// So: nothing in the setup touches anything else, and every segmented choice
// renders as a grid of equal chips rather than a bar that broke.

/** Every drill whose setup is more than a dial. */
const RICH_SETUPS = [
  'Guided Warmup',
  'Vibrato',
  'Scale Runner',
  'Arpeggio Jumper',
] as const

interface ControlShape {
  /** Smallest gap between any two setup controls, in px. */
  tightest: number
  /** Distinct rendered widths of the timer chips, rounded. */
  segmentWidths: number[]
  /** Distinct rendered heights of the timer chips, rounded. */
  segmentHeights: number[]
}

async function controlShape(
  page: import('@playwright/test').Page,
): Promise<ControlShape> {
  return page.evaluate(() => {
    const setup = document.querySelector('.exercise-idle-setup')
    const kids = Array.from(setup?.children ?? []).map((el) =>
      el.getBoundingClientRect(),
    )
    let tightest = Number.POSITIVE_INFINITY
    for (let i = 0; i < kids.length; i++) {
      for (let j = i + 1; j < kids.length; j++) {
        const a = kids[i]
        const b = kids[j]
        // Distance on whichever axis actually separates them. Two boxes side
        // by side are separated horizontally even when they overlap
        // vertically, and the other way round.
        const dx = Math.max(a.left - b.right, b.left - a.right)
        const dy = Math.max(a.top - b.bottom, b.top - a.bottom)
        tightest = Math.min(tightest, Math.max(dx, dy))
      }
    }
    const segs = Array.from(
      document.querySelectorAll(
        '.exercise-idle-launch .exercise-timer-segment',
      ),
    ).map((el) => el.getBoundingClientRect())
    return {
      tightest: kids.length < 2 ? Number.POSITIVE_INFINITY : tightest,
      segmentWidths: [...new Set(segs.map((b) => Math.round(b.width)))],
      segmentHeights: [...new Set(segs.map((b) => Math.round(b.height)))],
    }
  })
}

test.describe('nothing in the setup is glued to anything else', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
      localStorage.setItem('pitchperfect_advanced_features', 'true')
    })
  })

  for (const vp of VIEWPORTS) {
    test(`spacing and chips at ${vp.name}`, async ({ page }) => {
      test.slow()
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/')
      await waitForNav(page)
      await dismissOverlays(page)
      await openNavTab(page, 'tab-exercises')

      const problems: string[] = []

      for (const drill of RICH_SETUPS) {
        await page.locator('.exercise-card', { hasText: drill }).first().click()
        await expect(page.locator('.exercise-idle-start')).toBeVisible({
          timeout: 10000,
        })
        const shape = await controlShape(page)

        // 6px is the smallest deliberate spacing in the panel (the grid's
        // 6px item margin). Anything under it is two controls touching.
        if (shape.tightest < 5) {
          problems.push(
            `${drill}: two setup controls are ${Math.round(shape.tightest)}px apart`,
          )
        }

        // One width and one height across every chip: that is the difference
        // between a grid and a bar that wrapped. A wrapped joined bar leaves
        // a short last row of wider segments.
        if (shape.segmentWidths.length > 1) {
          problems.push(
            `${drill}: timer chips have ${shape.segmentWidths.length} different widths (${shape.segmentWidths.join(', ')})`,
          )
        }
        if (shape.segmentHeights.length > 1) {
          problems.push(
            `${drill}: timer chips have ${shape.segmentHeights.length} different heights`,
          )
        }

        await page.locator('.back-btn').click()
        await expect(page.locator('.exercise-card').first()).toBeVisible({
          timeout: 10000,
        })
      }

      expect(problems, problems.join('\n')).toEqual([])
    })
  }
})

// ============================================================
// The gallery header
// ============================================================
//
// The Zen entry was a full-width banner ABOVE the gallery, so the first
// thing on the exercises tab was a card for somewhere else and the page's
// own title started a hundred pixels down. It is a chip in the header row
// now: the title is the first thing, and the chip is beside it.

test.describe('the gallery header', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
      localStorage.setItem('pitchperfect_advanced_features', 'true')
    })
  })

  for (const vp of VIEWPORTS) {
    test(`title leads at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/')
      await waitForNav(page)
      await dismissOverlays(page)
      await openNavTab(page, 'tab-exercises')

      const title = page.locator('.exercises-header h2')
      await expect(title).toBeVisible({ timeout: 10000 })

      const shape = await page.evaluate(() => {
        const box = (s: string) => {
          const el = document.querySelector(s)
          return el === null ? null : el.getBoundingClientRect()
        }
        const panel = box('.exercises-panel')
        const title = box('.exercises-header h2')
        const chip = document.querySelector(
          '.exercises-header button',
        ) as HTMLElement | null
        return {
          panelTop: panel?.top ?? 0,
          titleTop: title?.top ?? 0,
          titleRight: title?.right ?? 0,
          chip:
            chip === null
              ? null
              : {
                  top: chip.getBoundingClientRect().top,
                  left: chip.getBoundingClientRect().left,
                  bottom: chip.getBoundingClientRect().bottom,
                  height: chip.getBoundingClientRect().height,
                },
        }
      })

      // Nothing above the title but the panel's own padding.
      expect(shape.titleTop - shape.panelTop).toBeLessThan(40)

      if (shape.chip !== null) {
        // A chip, not a banner.
        expect(shape.chip.height).toBeLessThan(46)
        // Beside the title on anything wider than a phone, under it below
        // that — never above it either way.
        expect(shape.chip.bottom).toBeGreaterThan(shape.titleTop)
        if (vp.width > 768) {
          expect(shape.chip.left).toBeGreaterThan(shape.titleRight)
        }
      }
    })
  }
})

// ============================================================
// Choosing a style must not re-lay-out the styles
// ============================================================
//
// The vibrato style row is a label, three chips and a hint. The hint's text
// changes with the style you pick, and the row was shrink-to-fit, so its
// width came from whichever hint was showing — "Natural" has a shorter one
// than "Slow & Wide". A narrower row meant a narrower chip grid, and the
// chips went from three across to one per line. Picking a style moved the
// control you picked it with.

test.describe('the vibrato style row holds still', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
      localStorage.setItem('pitchperfect_advanced_features', 'true')
    })
  })

  for (const vp of VIEWPORTS) {
    test(`every style gives the same layout at ${vp.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/')
      await waitForNav(page)
      await dismissOverlays(page)
      await openNavTab(page, 'tab-exercises')
      await page
        .locator('.exercise-card', { hasText: 'Vibrato' })
        .first()
        .click()
      await expect(page.locator('.exercise-idle-start')).toBeVisible({
        timeout: 10000,
      })

      const chips = page.locator('.vibrato-style-row .exercise-timer-segment')
      const count = await chips.count()
      expect(count).toBe(3)

      /** The grid's shape: its box, and how many rows the chips sit on. */
      const shape = async () =>
        page.evaluate(() => {
          const row = document.querySelector('.vibrato-style-row')
          const grid = row?.querySelector('.exercise-timer-toggle')
          const box = grid?.getBoundingClientRect()
          const tops = new Set(
            [...(grid?.children ?? [])].map((c) =>
              Math.round(c.getBoundingClientRect().top),
            ),
          )
          return {
            width: Math.round(box?.width ?? 0),
            height: Math.round(box?.height ?? 0),
            rows: tops.size,
          }
        })

      const shapes: Array<Awaited<ReturnType<typeof shape>>> = []
      for (let i = 0; i < count; i++) {
        await chips.nth(i).click()
        shapes.push(await shape())
      }

      // Identical for every selection — not "close enough". A width that
      // moves at all is the hint driving the layout again.
      for (const s of shapes.slice(1)) {
        expect(s, JSON.stringify(shapes)).toEqual(shapes[0])
      }
    })
  }
})
