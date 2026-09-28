// Campaign entry proof — previews are open, while the real journey advances one completed gallery at a time.
import { expect, test } from '@playwright/test'
import { MUSEUM_CAMPAIGN } from '../../../packages/glass-game/src/content/campaign'

test.use({ viewport: { width: 390, height: 844 } })

// Unlocks are host/DOM behavior. No scene is needed to decide or display access.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = (() =>
      null) as typeof HTMLCanvasElement.prototype.getContext
  })
})

test('development opens every gallery and trial without fabricating progress @smoke', async ({
  page,
}) => {
  await page.goto('/glass-game/?campaign=1')
  await expect(page.getByTestId('development-gallery-access')).toBeVisible()
  for (const chapter of MUSEUM_CAMPAIGN)
    await expect(
      page.getByRole('button', {
        name: `Enter ${chapter.level.title}`,
        exact: true,
      }),
    ).toBeEnabled()
  const trials = page.locator('[data-trial-id]')
  expect(await trials.count()).toBeGreaterThan(0)
  for (const trial of await trials.all())
    await expect(trial).toHaveAttribute('data-unlocked', 'true')
  const earned = await page.evaluate(() =>
    Object.keys(localStorage).filter(
      (key) => key.includes(':progress:') || key.includes(':replays:'),
    ),
  )
  expect(earned).toEqual([])
})

test('earned progression starts at the prologue and opens only the next gallery @smoke', async ({
  page,
}) => {
  await page.goto('/glass-game/?campaign=1&progression=earned')
  await expect(page.getByTestId('development-gallery-access')).toHaveCount(0)
  await expect(
    page.getByRole('button', {
      name: `Enter ${MUSEUM_CAMPAIGN[0]!.level.title}`,
      exact: true,
    }),
  ).toBeEnabled()
  for (const chapter of MUSEUM_CAMPAIGN.slice(1))
    await expect(
      page.getByRole('button', {
        name: `Locked: ${chapter.level.title}`,
        exact: true,
      }),
    ).toBeDisabled()
  for (const trial of await page.locator('[data-trial-id]').all())
    await expect(trial).toHaveAttribute('data-unlocked', 'false')
  const level = MUSEUM_CAMPAIGN[0]!.level
  await page.evaluate(
    (level) =>
      localStorage.setItem(
        `beside-cue:glass-adventure:progress:${level.id}`,
        JSON.stringify({
          version: 2,
          levelId: level.id,
          checkpointId: level.spawn.checkpointId,
          completedBreakableIds: level.breakables.map((item) => item.id),
          finished: true,
        }),
      ),
    level,
  )
  await page.reload()
  await expect(
    page.getByRole('button', {
      name: `Enter ${MUSEUM_CAMPAIGN[1]!.level.title}`,
      exact: true,
    }),
  ).toBeEnabled()
  for (const chapter of MUSEUM_CAMPAIGN.slice(2))
    await expect(
      page.getByRole('button', {
        name: `Locked: ${chapter.level.title}`,
        exact: true,
      }),
    ).toBeDisabled()
  // Selecting a later island is a preview only; its entry stays disabled.
  await page
    .getByRole('region', { name: 'The museum catalogue' })
    .getByRole('button', {
      name: `Select ${MUSEUM_CAMPAIGN[3]!.level.title} on the museum map`,
      exact: true,
    })
    .click()
  await expect(
    page.getByRole('button', {
      name: `Open selected gallery: ${MUSEUM_CAMPAIGN[3]!.level.title}`,
      exact: true,
    }),
  ).toBeDisabled()
})
