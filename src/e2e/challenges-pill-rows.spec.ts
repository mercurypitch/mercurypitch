// The category pill row is capped at two rows so an unbounded wrap cannot
// push the first challenge card half a screen down. The cap is a pixel
// sum, and a pixel sum written against a guessed pill height is exactly
// the kind of thing that silently goes a few pixels short and slices the
// underside off the second row — which is what it did.
//
// So this measures rather than eyeballs: every pill's painted box must
// sit inside the scroll container's client box.

import { expect, test } from '@playwright/test'
import { dismissOverlays, switchTab, waitForTabs } from './helpers/ui'

test.describe('Challenges category pills', () => {
  test('no pill is clipped by the two-row cap', async ({ page }) => {
    await page.goto('/')
    await waitForTabs(page)
    await dismissOverlays(page)
    await switchTab(page, 'challenges')

    const tabs = page.locator('.challenges-main .category-tabs')
    await expect(tabs).toBeVisible()
    await expect(tabs.locator('.category-tab').first()).toBeVisible()

    const measured = await tabs.evaluate((el) => {
      const box = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      const padBottom = parseFloat(style.paddingBottom)
      // What is actually on screen: the client box less the bottom
      // padding. Rows past the cap live below this and are reachable by
      // scrolling — that is the design, not the bug.
      const visibleBottom = box.top + el.clientHeight - padBottom
      const pills = Array.from(el.querySelectorAll('.category-tab'))

      // Group into rows by top offset within the scrolled content, so
      // the grouping survives the container being scrolled.
      const rows = new Map<number, number>()
      for (const pill of pills) {
        const r = pill.getBoundingClientRect()
        const key = Math.round(r.top - box.top + el.scrollTop)
        rows.set(key, Math.max(rows.get(key) ?? r.bottom, r.bottom))
      }
      const tops = [...rows.keys()].sort((a, b) => a - b)

      return {
        pillCount: pills.length,
        rowCount: tops.length,
        // How far the first two rows spill past what is visible. The cap
        // promises two whole rows; anything more may scroll.
        firstTwoRowsOverflow: Math.max(
          ...tops.slice(0, 2).map((t) => (rows.get(t) ?? 0) - visibleBottom),
        ),
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
        pillHeight: pills[0]?.getBoundingClientRect().height ?? 0,
      }
    })

    // Guards on the guard: one row, or one pill, and the test would pass
    // while proving nothing about a second row being sliced.
    expect(measured.pillCount).toBeGreaterThan(1)
    expect(measured.rowCount).toBeGreaterThan(1)

    // The actual assertion. Sub-pixel layout rounding is real, so half a
    // pixel is tolerated; the bug was several pixels.
    expect(measured.firstTwoRowsOverflow).toBeLessThanOrEqual(0.5)

    // And whatever does not fit must be reachable, not lost: `overflow-y:
    // hidden` is what turned a short cap into a silent cut.
    if (measured.scrollHeight > measured.clientHeight) {
      const scrollable = await tabs.evaluate(
        (el) => getComputedStyle(el).overflowY,
      )
      expect(scrollable).toBe('auto')
    }
  })
})
