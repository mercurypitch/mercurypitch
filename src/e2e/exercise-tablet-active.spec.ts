// ============================================================
// A running exercise on a short, wide screen
// ============================================================
//
// The companion to exercise-tablet-landscape.spec.ts, split off because
// `launchOptions` is file-scoped in Playwright: a real run needs the fake
// microphone, and the idle tests must not pay for a browser relaunch.
//
// Idle and active fail differently. Idle overflows because the setup column
// has no height limit. Active is the opposite problem — the tracker and the
// exercise's own metrics are sized to the card, so when the card gets short
// they compete, and what loses is either the tracker (squeezed to an
// unreadable band) or the Stop button (pushed behind the fold). Being unable
// to END a run is worse than being unable to start one.
//
// Reachability alone is too weak a test here: Stop is absolutely positioned
// at the card's bottom edge, so it answers "visible" even when the card has
// clipped everything above it. These assert the frame invariant as well —
// content taller than the card must be scrollable, never clipped.

import { expect, test } from '@playwright/test'
import { dismissOverlays, openNavTab, waitForNav } from './helpers/ui'
import { fakeMicArgs, writeToneWav } from './helpers/tone-wav'

const TONE_WAV = writeToneWav()

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
})

const VIEWPORTS = [
  { name: 'tab-s9-landscape', width: 1280, height: 660 },
  { name: 'short-laptop', width: 1024, height: 560 },
] as const

test.describe('a running exercise fits a short, wide screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
      localStorage.setItem('pitchperfect_advanced_features', 'true')
    })
  })

  for (const vp of VIEWPORTS) {
    test(`Stop stays reachable at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/')
      await waitForNav(page)
      await dismissOverlays(page)

      await openNavTab(page, 'tab-exercises')
      await page
        .locator('.exercise-card', { hasText: 'Long Note' })
        .first()
        .click()

      const start = page.locator('.exercise-btn-primary:has-text("Start")')
      await expect(start).toBeVisible({ timeout: 10000 })
      await start.scrollIntoViewIfNeeded()
      await start.click()

      const stop = page.locator('.exercise-btn-stop')
      await expect(stop).toBeVisible({ timeout: 15000 })
      await stop.scrollIntoViewIfNeeded()
      await expect(stop).toBeInViewport()

      const frame = await page.evaluate(() => {
        const area = document.querySelector('.exercise-canvas-area')
        if (area === null) return null
        const style = getComputedStyle(area)
        return {
          scrollTop: area.scrollTop,
          scrollHeight: area.scrollHeight,
          clientHeight: area.clientHeight,
          overflowY: style.overflowY,
        }
      })
      expect(frame).not.toBeNull()

      // Whatever does not fit has to be reachable. A clipped card is how the
      // run became unusable in the first place.
      if (frame!.scrollHeight > frame!.clientHeight + 1) {
        expect(['auto', 'scroll']).toContain(frame!.overflowY)
      }

      // Fitting is not the same as being usable. The card also has to give the
      // exercise's own visuals room, which is what the short-viewport
      // treatment is for: a compact tracker with a floor (never squeezed to an
      // unreadable band, never the full 200px band either) and Stop moved out
      // of the centre so it stops landing on the metrics row underneath.
      const layout = await page.evaluate(() => {
        const tracker = document.querySelector('.exercise-pitch-tracker')
        const stop = document.querySelector('.exercise-btn-stop')
        return {
          trackerHeight:
            tracker === null ? null : tracker.getBoundingClientRect().height,
          stopCentreX:
            stop === null
              ? null
              : stop.getBoundingClientRect().left +
                stop.getBoundingClientRect().width / 2,
          viewportWidth: window.innerWidth,
        }
      })
      if (layout.trackerHeight !== null) {
        expect(layout.trackerHeight).toBeGreaterThanOrEqual(140)
        expect(layout.trackerHeight).toBeLessThanOrEqual(160)
      }
      expect(layout.stopCentreX).not.toBeNull()
      expect(layout.stopCentreX!).toBeGreaterThan(layout.viewportWidth * 0.6)

      await page.screenshot({
        path: `test-results/exercise-active-${vp.name}.png`,
      })
    })
  }
})

// A scroll container can never reach content overflowing its START edge, so
// anything a plain (unsafe) `center` pushes past the top is not merely
// clipped — it is unreachable by any amount of scrolling. The idle panel
// learned this (exercise-tablet-landscape.spec.ts) and got `safe center`;
// the running view's content column never did. Owner repro: a Tab S9+ in
// landscape, the guided warmup — the step name and instruction above the
// guide-mute toggle sat beyond the top of the screen with no way to scroll
// to them. Measured pre-fix: the step text starts leaving the screen at
// 740px of height and the step name itself is gone by 660.
//
// Two viewports on purpose: 740 is the Tab S9+'s landscape height once
// browser chrome is subtracted (still ABOVE the 720px line
// short-viewport.css keys on — the stacked path); 660 is the same device
// with more chrome, BELOW the line. The warmup rows reproduce the owner's
// report; the interval-trainer rows guard the tall-viz row layout against
// the same class of defect.
const REACHABILITY_VIEWPORTS = [
  { name: 'tab-s9-stacked', width: 1280, height: 740 },
  { name: 'tab-s9-short', width: 1280, height: 660 },
] as const

const REACHABILITY_DRILLS = ['Guided Warmup', 'Interval Trainer'] as const

test.describe('a running exercise keeps every element reachable', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
      localStorage.setItem('pitchperfect_advanced_features', 'true')
    })
  })

  for (const vp of REACHABILITY_VIEWPORTS)
    for (const drill of REACHABILITY_DRILLS) {
      test(`${drill} content stays reachable at ${vp.name}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        await page.goto('/')
        await waitForNav(page)
        await dismissOverlays(page)

        await openNavTab(page, 'tab-exercises')
        await page.locator('.exercise-card', { hasText: drill }).first().click()

        const start = page.locator('.exercise-btn-primary:has-text("Start")')
        await expect(start).toBeVisible({ timeout: 10000 })
        await start.scrollIntoViewIfNeeded()
        await start.click()

        const stop = page.locator('.exercise-btn-stop')
        await expect(stop).toBeVisible({ timeout: 15000 })

        // Let the run settle into its live layout before measuring.
        await page.waitForTimeout(1500)

        const reach = await page.evaluate(() => {
          const area = document.querySelector('.exercise-canvas-area')
          const stage = document.querySelector('.exercise-active-stage')
          const phase = document.querySelector('.exercise-active-phase')
          if (area === null || stage === null) return null
          // Scroll to the very start: whatever still sits above the stage's
          // top edge can never be scrolled into view.
          stage.scrollTop = 0
          const stageTop = stage.getBoundingClientRect().top
          const offenders: string[] = []
          for (const el of stage.querySelectorAll(':scope *')) {
            const r = el.getBoundingClientRect()
            if (r.height > 0 && r.width > 0 && r.top < stageTop - 1) {
              offenders.push(
                `${el.tagName}.${String(el.className).slice(0, 60)}@${Math.round(r.top)}`,
              )
            }
          }
          return {
            offenders,
            phaseTop: phase === null ? null : phase.getBoundingClientRect().top,
            areaTop: area.getBoundingClientRect().top,
          }
        })
        expect(reach).not.toBeNull()
        // Nothing inside the scroller may sit above its start edge.
        expect(reach!.offenders).toEqual([])
        // The instruction line lives outside the scroller by design, so it
        // has no second chance: it must simply be on screen.
        expect(reach!.phaseTop).not.toBeNull()
        expect(reach!.phaseTop!).toBeGreaterThanOrEqual(0)

        await page.screenshot({
          path: `test-results/exercise-reachable-${drill.replaceAll(' ', '-')}-${vp.name}.png`,
        })
      })
    }
})

// The other half of the owner's Tab S9+ report: at ~800px of height (the
// device's landscape viewport once browser chrome is subtracted) the warmup's
// breath step SCROLLED — the bulky labelled Stop pill reserved a rail at the
// bottom while the four-row instruction pushed the canvas past the fold, so
// the "Sssss" cue at the canvas bottom sat behind a scroll. With the corner
// icon Stop and the two-row instruction the whole step must simply fit.
test.describe('the warmup breath step fits the fold', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
      localStorage.setItem('pitchperfect_advanced_features', 'true')
    })
  })

  test('no scroll at 1280x800, Stop is a compact corner icon', async ({
    page,
  }) => {
    await page.goto('/')
    await waitForNav(page)
    await dismissOverlays(page)

    await openNavTab(page, 'tab-exercises')
    await page.locator('.exercise-card', { hasText: 'Guided Warmup' }).first().click() // prettier-ignore

    const start = page.locator('.exercise-btn-primary:has-text("Start")')
    await expect(start).toBeVisible({ timeout: 10000 })
    await start.scrollIntoViewIfNeeded()
    await start.click()

    const stop = page.locator('.exercise-btn-stop')
    await expect(stop).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1500)

    const fit = await page.evaluate(() => {
      const area = document.querySelector('.exercise-canvas-area')
      const instruction = document.querySelector('.warmup-step-instruction')
      const canvas = document.querySelector('.warmup-canvas')
      const stopBtn = document.querySelector('.exercise-btn-stop')
      if (area === null || instruction === null || canvas === null || stopBtn === null) return null // prettier-ignore
      area.scrollTop = 0
      const areaRect = area.getBoundingClientRect()
      const stopRect = stopBtn.getBoundingClientRect()
      return {
        overflow: area.scrollHeight - area.clientHeight,
        instructionHeight: instruction.getBoundingClientRect().height,
        canvasBottom: canvas.getBoundingClientRect().bottom,
        areaBottom: areaRect.bottom,
        stopWidth: stopRect.width,
        stopHeight: stopRect.height,
      }
    })
    expect(fit).not.toBeNull()

    // The step must fit whole — a scrollbar here IS the bug.
    expect(fit!.overflow).toBeLessThanOrEqual(1)
    // The canvas (whose bottom carries the "Sssss" cue) ends on screen.
    expect(fit!.canvasBottom).toBeLessThanOrEqual(fit!.areaBottom + 1)
    // The widened instruction wraps to at most two rows of ~20px.
    expect(fit!.instructionHeight).toBeLessThanOrEqual(46)
    // Stop is the compact icon button, not a labelled pill or a 54px FAB.
    expect(fit!.stopWidth).toBeGreaterThanOrEqual(40)
    expect(fit!.stopWidth).toBeLessThanOrEqual(56)
    expect(Math.abs(fit!.stopWidth - fit!.stopHeight)).toBeLessThanOrEqual(1)

    await page.screenshot({
      path: 'test-results/warmup-breath-fold-1280x800.png',
    })
  })
})
