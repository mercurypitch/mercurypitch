// ============================================================
// The tall well and the tracker, on a screen with no height to spare
// ============================================================
//
// Eleven drills draw a tall, narrow well — a 72px column with the target line
// across the middle and a dot riding it. Stacked under the pitch tracker it
// asks for a compact tracker, a phase line, a row of round progress dots, the
// well itself, and a strip at the bottom for Stop. On a tablet in landscape
// that is more height than there is.
//
// What the singer saw: the card scrolled, and the Stop button — absolutely
// positioned against a scrolling card, so anchored to the bottom of the
// SCROLLED CONTENT rather than the bottom of the visible card — drifted up
// over the well and the tracker. Two things fighting for the same pixels
// while a run was going on.
//
// The well is narrow and a short screen is a wide one, so below 720px of
// height the two visuals sit beside each other instead of on top of one
// another. This asserts that as geometry: no overlap, side by side where the
// height ran out, still stacked where it did not, and a stage that does not
// need scrolling to show a run.

import { expect, test } from '@playwright/test'
import { dismissOverlays, openNavTab, waitForNav } from './helpers/ui'
import { fakeMicArgs, writeToneWav } from './helpers/tone-wav'

const TONE_WAV = writeToneWav()

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
})

interface Box {
  top: number
  right: number
  bottom: number
  left: number
  width: number
  height: number
}

interface Stage {
  tracker: Box | null
  well: Box | null
  stop: Box | null
  stageScrollHeight: number
  stageClientHeight: number
}

/** Start Siren and hand back the geometry of the three boxes that collided. */
async function runSiren(
  page: import('@playwright/test').Page,
  width: number,
  height: number,
): Promise<Stage> {
  await page.setViewportSize({ width, height })
  await page.goto('/')
  await waitForNav(page)
  await dismissOverlays(page)

  await openNavTab(page, 'tab-exercises')
  await page
    .locator('.exercise-card', { hasText: 'Siren / Range Explorer' })
    .first()
    .click()

  const start = page.locator('.exercise-btn-primary:has-text("Start")')
  await expect(start).toBeVisible({ timeout: 10000 })
  await start.scrollIntoViewIfNeeded()
  await start.click()

  // The well only exists once the run is active.
  await expect(page.locator('.mirror-melody-viz')).toBeVisible({
    timeout: 15000,
  })

  return page.evaluate(() => {
    const box = (selector: string): Box | null => {
      const el = document.querySelector(selector)
      if (el === null) return null
      const r = el.getBoundingClientRect()
      return {
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        left: r.left,
        width: r.width,
        height: r.height,
      }
    }
    const stage = document.querySelector('.exercise-active-stage')
    return {
      tracker: box('.exercise-pitch-tracker'),
      well: box('.mirror-melody-viz'),
      stop: box('.exercise-btn-stop'),
      stageScrollHeight: stage?.scrollHeight ?? 0,
      stageClientHeight: stage?.clientHeight ?? 0,
    }
  })
}

/** Do two rectangles share any pixel? */
function overlaps(a: Box, b: Box): boolean {
  return (
    a.left < b.right - 1 &&
    b.left < a.right - 1 &&
    a.top < b.bottom - 1 &&
    b.top < a.bottom - 1
  )
}

test.describe('the vertical well shares a row with the tracker when height runs out', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
      localStorage.setItem('pitchperfect_advanced_features', 'true')
    })
  })

  // Samsung Tab S9+ in landscape, minus browser chrome — the reported case.
  test('side by side at 1280x660, and nothing sits on Stop', async ({
    page,
  }) => {
    const stage = await runSiren(page, 1280, 660)

    expect(stage.tracker).not.toBeNull()
    expect(stage.well).not.toBeNull()
    expect(stage.stop).not.toBeNull()

    // Beside, not below: the tracker ends before the well begins, and the two
    // share horizontal band rather than stacking.
    expect(stage.tracker!.right).toBeLessThanOrEqual(stage.well!.left + 1)
    expect(stage.tracker!.top).toBeLessThan(stage.well!.bottom)
    expect(stage.well!.top).toBeLessThan(stage.tracker!.bottom)

    // The reported symptom, stated directly.
    expect(
      overlaps(stage.stop!, stage.well!),
      'Stop overlaps the pitch well',
    ).toBe(false)
    expect(
      overlaps(stage.stop!, stage.tracker!),
      'Stop overlaps the pitch tracker',
    ).toBe(false)

    // And a run should be watchable without scrolling to see it.
    expect(stage.stageScrollHeight).toBeLessThanOrEqual(
      stage.stageClientHeight + 2,
    )

    await page.screenshot({
      path: 'test-results/exercise-well-1280x660.png',
    })
  })

  // A meaner one: the same tablet with more chrome, or a small netbook.
  test('side by side at 1024x560', async ({ page }) => {
    const stage = await runSiren(page, 1024, 560)

    expect(stage.tracker!.right).toBeLessThanOrEqual(stage.well!.left + 1)
    expect(
      overlaps(stage.stop!, stage.well!),
      'Stop overlaps the pitch well',
    ).toBe(false)

    // The tracker keeps a readable band whatever else happens — it is the
    // thing the singer is reading.
    expect(stage.tracker!.height).toBeGreaterThanOrEqual(120)

    await page.screenshot({
      path: 'test-results/exercise-well-1024x560.png',
    })
  })

  // The control. A screen with height to spare keeps the layout it had, so
  // this is a treatment for the case that needed it and not a redesign of the
  // one that did not.
  test('still stacked at 1280x900, where there is height for it', async ({
    page,
  }) => {
    const stage = await runSiren(page, 1280, 900)

    expect(stage.tracker!.bottom).toBeLessThanOrEqual(stage.well!.top + 1)
    expect(
      overlaps(stage.stop!, stage.well!),
      'Stop overlaps the pitch well',
    ).toBe(false)
  })

  // A phone in portrait is short but has no width to spend, so it keeps the
  // stack — and is therefore the case that still scrolls. It is the one that
  // proves the OTHER half of the fix: Stop is positioned against the card, and
  // the card no longer scrolls, so scrolling the run cannot carry Stop up onto
  // it. Before, Stop was pinned to the bottom of the scrolled content and rode
  // it — which is how it came to sit on top of the well mid-run.
  test('scrolling a stacked run does not drag Stop onto it (390x520)', async ({
    page,
  }) => {
    // 520 rather than 660 deliberately: at 660 the stack still fits, so there
    // is nothing to scroll and the test would pass without proving anything.
    await runSiren(page, 390, 520)

    const after = await page.evaluate(() => {
      const stage = document.querySelector('.exercise-active-stage')
      if (stage !== null) stage.scrollTop = stage.scrollHeight
      const box = (selector: string) => {
        const el = document.querySelector(selector)
        if (el === null) return null
        const r = el.getBoundingClientRect()
        return { top: r.top, right: r.right, bottom: r.bottom, left: r.left }
      }
      return {
        stop: box('.exercise-btn-stop'),
        well: box('.mirror-melody-viz'),
        tracker: box('.exercise-pitch-tracker'),
        viewportHeight: window.innerHeight,
        scrolled: stage?.scrollTop ?? 0,
        overflow: (stage?.scrollHeight ?? 0) - (stage?.clientHeight ?? 0),
      }
    })

    expect(after.stop).not.toBeNull()
    // The premise: there was something to scroll. Without this the rest of the
    // test passes on a stage that never moved.
    expect(after.overflow).toBeGreaterThan(0)
    expect(after.scrolled).toBeGreaterThan(0)
    // Still on screen after the scroll — this is the button that ends a run.
    expect(after.stop!.bottom).toBeLessThanOrEqual(after.viewportHeight + 1)
    expect(after.stop!.top).toBeGreaterThan(0)

    for (const [name, target] of [
      ['well', after.well],
      ['tracker', after.tracker],
    ] as const) {
      if (target === null) continue
      const collides =
        after.stop!.left < target.right - 1 &&
        target.left < after.stop!.right - 1 &&
        after.stop!.top < target.bottom - 1 &&
        target.top < after.stop!.bottom - 1
      expect(collides, `Stop overlaps the ${name} after scrolling`).toBe(false)
    }
  })
})
