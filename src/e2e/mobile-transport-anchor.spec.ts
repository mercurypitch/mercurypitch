// ============================================================
// The count-in badge belongs above the transport, not off the screen.
// ============================================================
//
// Reported from an iPhone: the count-in number rendered as a circle pinned to
// the top centre of the viewport, half of it above the app header, so the
// digit was clipped and barely legible.
//
// The badge is `position: absolute; top: -10px; left: 50%` and was authored to
// sit just above the transport row. `TransportBar` had no `position`, so the
// badge resolved against a positioned ancestor near the top of the page
// instead — which is exactly where it appeared. This measures the containing
// block, which is the defect; the badge itself only exists during a count-in.

import { expect, test } from '@playwright/test'
import { dismissOverlays, switchTab, waitForNav } from './helpers/ui'

test.use({
  viewport: { width: 390, height: 844 },
})

test('anchors stage overlays to the transport row they sit on @smoke', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForNav(page)
  await dismissOverlays(page)
  await switchTab(page, 'singing')

  const bar = page.getByTestId('mobile-transport-bar').first()
  await expect(bar).toBeVisible()

  const anchor = await bar.evaluate((element) => {
    const barBox = element.getBoundingClientRect()
    // Where the badge would land: the browser's own answer for this element's
    // containing block, read through a probe placed exactly as the badge is.
    const probe = document.createElement('span')
    probe.style.position = 'absolute'
    probe.style.top = '-10px'
    probe.style.left = '50%'
    probe.style.width = '20px'
    probe.style.height = '20px'
    element.append(probe)
    const probeBox = probe.getBoundingClientRect()
    probe.remove()
    return {
      position: getComputedStyle(element).position,
      barTop: barBox.top,
      probeTop: probeBox.top,
      viewportHeight: window.innerHeight,
    }
  })

  // A static bar hands the badge to some ancestor near the top of the page.
  expect(anchor.position).not.toBe('static')
  // Ten pixels above the row it belongs to, and on screen.
  expect(anchor.probeTop).toBeCloseTo(anchor.barTop - 10, 0)
  expect(anchor.probeTop).toBeGreaterThan(0)
  expect(anchor.probeTop).toBeLessThan(anchor.viewportHeight)
})
