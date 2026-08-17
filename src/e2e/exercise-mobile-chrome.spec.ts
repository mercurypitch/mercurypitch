// ============================================================
// The exercise chrome on a phone: one header row, a button, a staff
// ============================================================
//
// Reported from an iPhone 13 Pro on the dev domain, with screenshots:
//
//  1. The drill's name pushed the mic button and the level readout onto a
//     SECOND header row. The owner's words: "the right corner mic must be
//     there, instead of overflowing to second row". Short names were fine,
//     long ones were not — the tell of a wrapping flex row whose title
//     cannot shrink.
//  2. "The 'start' button stretches way too much" — edge to edge, and squat,
//     because a safe-area inset was being paid as padding inside the button.
//  3. Sight-Singing's staff scrolled vertically, so "the notes are not that
//     visible initially".
//
// All three are geometry, so they are checked in numbers rather than by
// asserting a class is present: a rule can be renamed, moved between files,
// or lose to a later selector, and only the measurement notices.

import { expect, test } from '@playwright/test'
import { fakeMicArgs, writeToneWav } from './helpers/tone-wav'
import { dismissOverlays, openNavTab, waitForNav } from './helpers/ui'

// Written at module load: Chromium needs the file before it launches. Without
// a synthetic mic the drill never leaves idle ("Microphone access denied"),
// so the active run that draws the staff never happens.
const TONE_WAV = writeToneWav()

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
})

// iPhone 13 Pro portrait, the reporting device.
const PHONE = { width: 390, height: 844 }

// The long names are the whole point — short ones never wrapped. "Staccato
// Precision" is the longest in the gallery, and Long Note and Sight-Singing
// are the two the owner photographed.
const DRILLS = [
  'Staccato Precision',
  'Long Note',
  'Sight-Singing',
  'Mirror the Melody',
] as const

interface HeaderShape {
  /** Header rows, inferred from height against the tallest control. */
  headerHeight: number
  titleTop: number
  titleBottom: number
  titleRight: number
  rightTop: number
  rightLeft: number
  rightBottom: number
  /** True when the h2 is actually truncating rather than overflowing. */
  titleClipped: boolean
  startWidth: number
  startHeight: number
}

async function headerShape(
  page: import('@playwright/test').Page,
): Promise<HeaderShape | null> {
  return page.evaluate(() => {
    const header = document.querySelector('.exercise-runner-header')
    const title = document.querySelector('.exercise-title')
    const right = document.querySelector('.exercise-header-right')
    const start = document.querySelector('.exercise-idle-start')
    if (header === null || title === null || right === null) return null
    const t = title.getBoundingClientRect()
    const r = right.getBoundingClientRect()
    const s = start?.getBoundingClientRect()
    return {
      headerHeight: header.getBoundingClientRect().height,
      titleTop: t.top,
      titleBottom: t.bottom,
      titleRight: t.right,
      rightTop: r.top,
      rightLeft: r.left,
      rightBottom: r.bottom,
      titleClipped: title.scrollWidth > title.clientWidth,
      startWidth: s?.width ?? 0,
      startHeight: s?.height ?? 0,
    }
  })
}

test.describe('the exercise chrome on a phone', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
      localStorage.setItem('pitchperfect_advanced_features', 'true')
    })
    await page.setViewportSize(PHONE)
  })

  test('keeps the mic in the top-right corner, never on a second row', async ({
    page,
  }) => {
    test.slow()
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
      const shape = await headerShape(page)
      if (shape === null) {
        problems.push(`${drill}: no header`)
        continue
      }

      // The reported defect, stated directly: the controls sit BESIDE the
      // title, not under it. Vertical overlap proves one row; the left edge
      // proves which side.
      if (shape.rightTop >= shape.titleBottom) {
        problems.push(
          `${drill}: controls dropped to a second row ` +
            `(title ends ${shape.titleBottom}, controls start ${shape.rightTop})`,
        )
      }
      if (shape.rightLeft < shape.titleRight - 1) {
        problems.push(`${drill}: title overruns the controls`)
      }

      // A wrapped header is two rows of ~34px plus the row gap. One row of
      // controls is comfortably under 56px on this viewport.
      if (shape.headerHeight > 56) {
        problems.push(`${drill}: header is ${shape.headerHeight}px tall`)
      }

      // Start: wide enough to hit, not a banner, and not inflated by the
      // home-indicator inset it used to carry as padding.
      if (shape.startWidth > 261) {
        problems.push(`${drill}: Start is ${shape.startWidth}px wide`)
      }
      if (shape.startHeight > 64) {
        problems.push(`${drill}: Start is ${shape.startHeight}px tall`)
      }

      await page.locator('.back-btn').first().click()
      await expect(page.locator('.exercise-card').first()).toBeVisible({
        timeout: 10000,
      })
    }

    expect(problems, problems.join('\n')).toEqual([])
  })

  test('fits the Sight-Singing staff without a vertical scroll', async ({
    page,
  }) => {
    test.slow()
    await page.goto('/')
    await waitForNav(page)
    await dismissOverlays(page)
    await openNavTab(page, 'tab-exercises')

    await page
      .locator('.exercise-card', { hasText: 'Sight-Singing' })
      .first()
      .click()
    const start = page.locator('.exercise-btn-primary:has-text("Start")')
    await expect(start).toBeVisible({ timeout: 10000 })
    await start.scrollIntoViewIfNeeded()
    await start.click()

    // Prove the run actually armed before measuring what it draws.
    await expect(page.locator('.exercise-btn-stop')).toBeVisible({
      timeout: 15000,
    })

    const staff = page.locator('.sight-singing-staff')
    await expect(staff).toBeVisible({ timeout: 15000 })

    const fit = await page.evaluate(() => {
      const svg = document.querySelector('.sight-singing-staff')
      const container = document.querySelector('.sight-singing-staff-container')
      if (svg === null || container === null) return null
      const box = svg.getBoundingClientRect()
      return {
        staffHeight: box.height,
        staffWidth: box.width,
        containerWidth: container.getBoundingClientRect().width,
        // The staff's own box must not need a vertical scrollbar.
        containerVerticalOverflow:
          container.scrollHeight - container.clientHeight,
      }
    })

    expect(fit).not.toBeNull()
    if (fit === null) return

    // The unscaled SVG was a flat 180px tall; the clamp tops out at 132.
    expect(fit.staffHeight).toBeLessThanOrEqual(133)
    // Scaled uniformly from the viewBox, so it must keep its proportions
    // rather than squash: 180 tall by at least 320 wide.
    expect(fit.staffWidth).toBeGreaterThan(fit.staffHeight)
    // Horizontal scroll is allowed — the owner asked for it when there are
    // more notes than fit. Vertical is what was wrong.
    expect(fit.containerVerticalOverflow).toBeLessThanOrEqual(1)
  })
})
