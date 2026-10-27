// Studio tour target checks — real desktop/tablet/phone controls and non-mutating tour launch.
import { expect, type Page, test } from '@playwright/test'
import { importStudioAudio, readStudioProject, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { dismissOverlays, waitForNav } from './helpers/ui'

async function assertVisibleTargets(
  page: Page,
  hooks: readonly string[],
): Promise<void> {
  for (const hook of hooks) {
    const target = page.locator(`[data-tour="studio.${hook}"]`).first()
    await expect(target, hook).toBeVisible()
    const box = await target.boundingBox()
    expect(box?.width, hook).toBeGreaterThan(0)
    expect(box?.height, hook).toBeGreaterThan(0)
  }
}

async function openTour(page: Page, title: string): Promise<void> {
  const launcher = page.getByTitle('Take a guided tour of this page')
  const box = await launcher.boundingBox()
  const viewport = page.viewportSize()!
  const onScreen =
    box !== null && box.x >= 0 && box.x + box.width <= viewport.width
  if (!onScreen) {
    const menu = page.locator('.sidebar-toggle-btn')
    if (await menu.isVisible()) await menu.click()
    else
      await page
        .getByRole('button', {
          name: 'Expand sidebar',
          exact: true,
        })
        .click()
  }
  await expect(launcher).toBeInViewport()
  await launcher.click()
  await expect(page.locator('[class*="walkthroughStepTitle"]')).toHaveText(
    title,
  )
  await expect(page.locator('[class*="walkthroughHighlight"]')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('[class*="walkthroughStepTitle"]')).toHaveCount(0)
}

for (const [name, width, phone] of [
  ['desktop', 1360, false],
  ['tablet', 900, false],
  ['phone', 390, true],
] as const) {
  test(`Studio tour targets match the ${name} library and arrangement @smoke`, async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() => {
      ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
      localStorage.setItem('pitchperfect_page_tour_offered_studio', 'true')
    })
    await page.goto('/studio-night')
    await waitForNav(page, 30_000)
    await dismissOverlays(page)
    await assertVisibleTargets(page, [
      'library',
      'new-song',
      'open-backup',
      'local-note',
    ])
    await openTour(page, 'Your songs')
    await studioRegion(page)
      .getByRole('button', { name: 'Create project', exact: true })
      .click()
    await importStudioAudio(page)
    const before = await readStudioProject(page)
    const common = [
      'song-options',
      'add-takes',
      'mix',
      'history',
      'transport',
      'sound',
      'export',
    ]
    const arranging = ['view-controls', 'snap', 'timeline', 'track-controls']
    const overview = ['timeline-overview']
    await assertVisibleTargets(page, [
      ...common,
      ...(phone ? overview : arranging),
    ])
    for (const hook of phone ? arranging : overview)
      await expect(page.locator(`[data-tour="studio.${hook}"]`)).toHaveCount(0)
    await openTour(page, 'Song options')
    expect(await readStudioProject(page)).toEqual(before)
  })
}
