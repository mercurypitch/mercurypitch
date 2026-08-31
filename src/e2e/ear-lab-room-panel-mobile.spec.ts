// ============================================================
// The room panel's gallery keeps its own space on a phone
// ============================================================
//
// The embedded background picker shares a stylesheet with the phone drawer
// the same component renders when it is NOT embedded. That drawer's
// `@media (max-width: 768px)` block matched `.panel` unconditionally and
// sits after `.panelEmbedded`, so at equal specificity it handed the
// embedded gallery the drawer's `max-height` back — a clamp its content did
// not fit inside, while `.panelEmbedded`'s `overflow: visible` still
// applied. The overflow spilled out of the box rather than scrolling and
// painted on top of the next control in the flow: "Room visibility" printed
// over the end of the gallery.
//
// Geometry, not a screenshot: the bug is two boxes occupying the same
// pixels. And the clamp is asserted separately from the overlap, because a
// panel that scrolled its overflow away would clear the overlap check while
// hiding the bottom of the gallery instead — the same bug wearing a hat.

import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'

test.use({ viewport: { width: 375, height: 812 } })

test('keeps the room gallery from painting over the controls under it @smoke', async ({
  page,
}) => {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
  })
  await page.goto('/ear-lab')
  await dismissOverlays(page)

  await page.getByRole('button', { name: /^Room: .*Choose the room$/ }).click()

  const glassLabel = page.getByText('Room visibility', { exact: true })
  await expect(glassLabel).toBeVisible()

  const geometry = await page.evaluate(() => {
    const label = [...document.querySelectorAll('span')].find(
      (element) => (element.textContent ?? '').trim() === 'Room visibility',
    )
    // The picker sits immediately before the glass control in the room
    // panel's flow; its only child is the embedded gallery panel. Walking
    // the DOM rather than matching a class because the module class names
    // are hashed at build time.
    const control = label?.closest('label') ?? null
    const picker = control?.previousElementSibling ?? null
    const panel = picker?.firstElementChild ?? null
    if (label === undefined || control === null || panel === null) return null
    return {
      panelBottom: panel.getBoundingClientRect().bottom,
      panelHeight: panel.getBoundingClientRect().height,
      panelScrollHeight: panel.scrollHeight,
      panelMaxHeight: getComputedStyle(panel).maxHeight,
      labelTop: label.getBoundingClientRect().top,
      cardCount: panel.querySelectorAll('img').length,
    }
  })

  expect(geometry, 'could not locate the embedded gallery panel').not.toBe(null)
  if (geometry === null) return

  // Guards the walk above: an empty panel would satisfy every assertion
  // below without ever having rendered the gallery this test is about.
  expect(geometry.cardCount, 'the gallery rendered no rooms').toBeGreaterThan(0)

  // The clamp itself, which is the bug. The overlap only appears once the
  // content is taller than the clamp -- with every edition unlocked, as in
  // E2E mode, the gallery happens to fit and the page looks fine while the
  // drawer rule is still in force. Asserting the rule and not only today's
  // rendering is what makes this fail on the unfixed CSS (633.36px there).
  expect(
    geometry.panelMaxHeight,
    'the embedded gallery still has the phone drawer max-height; content taller than it will spill over the controls below',
  ).toBe('none')

  // And the rendering that follows from it: the gallery ends before the
  // next control starts, and ends because it is as tall as its content
  // rather than because it was clipped.
  expect(
    geometry.labelTop,
    '"Room visibility" is drawn on top of the room gallery',
  ).toBeGreaterThanOrEqual(geometry.panelBottom)
  expect(
    geometry.panelHeight,
    'the embedded gallery is clamped shorter than its content',
  ).toBeGreaterThanOrEqual(geometry.panelScrollHeight - 1)
})
