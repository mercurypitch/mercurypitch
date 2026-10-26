// ============================================================
// Karaoke Night's top bar takes a full press on a phone
// ============================================================
// At 390 px the bar's controls took a press only as big as they drew,
// smaller than a thumb: the logo 22x22, App 31 px tall, Sign in 29, and the
// rail's Hide panel under the bar 28. Each takes one at least 44 px each way
// now, from invisible boxes, while the bar keeps its 63 px and every control
// still owns its own drawn box. The account chip clips its own overflow, so
// its box is placed outside it; the test is what says that worked.
// Measured by hit-testing (helpers/hit-area.ts).

import { expect, test } from '@playwright/test'
import { hitArea, sharePress } from './helpers/hit-area'
import type { HitArea } from './helpers/hit-area'

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
})

test('gives the top bar and Hide panel a 44 px press on a phone', async ({
  page,
}) => {
  // Arrange: this server only; the demo song's lyrics live on another host.
  await page.route(
    (url) => url.hostname !== '127.0.0.1' && url.hostname !== 'localhost',
    (route) => route.abort(),
  )
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
  })
  await page.goto('/karaoke-night')
  const bar = page.locator('header.kn-topbar')
  const named = {
    logo: bar.getByRole('link', { name: 'MercuryPitch', exact: true }),
    app: bar.getByRole('link', { name: 'Open the full MercuryPitch app' }),
    signIn: bar.getByRole('button', { name: 'Sign in' }),
    hidePanel: page.getByRole('button', { name: 'Hide panel' }),
  }
  for (const control of Object.values(named))
    await expect(control).toBeVisible()

  // Act
  const areas: Record<string, HitArea> = {}
  for (const [name, control] of Object.entries(named))
    areas[name] = await hitArea(control)
  const neighbours: HitArea[] = []
  for (const control of await bar.locator('button:visible, a:visible').all())
    neighbours.push(await hitArea(control))
  neighbours.push(areas.hidePanel)
  const barHeight = await bar.evaluate(
    (element) => element.getBoundingClientRect().height,
  )

  // Assert
  for (const [name, area] of Object.entries(areas)) {
    expect(
      area.hit[0],
      `${name} takes a press 44 px wide`,
    ).toBeGreaterThanOrEqual(44)
    expect(
      area.hit[1],
      `${name} takes a press 44 px tall`,
    ).toBeGreaterThanOrEqual(44)
  }
  for (const area of neighbours) expect(area.ownsItsBox).toBe(true)
  for (let i = 0; i < neighbours.length; i++)
    for (let j = i + 1; j < neighbours.length; j++)
      expect(sharePress(neighbours[i].rect, neighbours[j].rect)).toBe(false)
  expect(barHeight).toBeLessThanOrEqual(63.5)
})
