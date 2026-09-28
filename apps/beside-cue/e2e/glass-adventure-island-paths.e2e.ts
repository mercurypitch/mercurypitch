// Island path host checks — new routes retain independent locks, real handoff and usable small-screen navigation.
import { expect, test } from '@playwright/test'
import { MUSEUM_CAMPAIGN } from '../../../packages/glass-game/src/content/campaign'
import { MUSEUM_TRIALS } from '../../../packages/glass-game/src/content/campaign-trials'
import { readProgress } from '../../../packages/glass-game/src/core/progress'

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(120_000)

test('island paths preserve earned routes and fit phone, tablet and desktop @smoke', async ({
  page,
}, testInfo) => {
  const chapter = MUSEUM_CAMPAIGN.find((item) => item.id === 'twin-galleries')!
  const level = chapter.level
  const saved = {
    ...readProgress(level, null),
    completedBreakableIds: level.breakables.map((item) => item.id),
    finished: true,
    rewards: {
      version: 1,
      discoveredEncounterIds: [],
      collectedCoinIds: [],
      collectedPortraitIds: [],
      qualityResults: (level.rewards?.grading ?? []).map((policy) => ({
        encounterId: policy.encounterId,
        grade: 3,
        challengeRevision: policy.challengeRevision,
        policyRevision: policy.policyRevision,
        contentRevision: level.authored?.contentRevision ?? 1,
        evidenceVersion: 'pitch-accuracy-v1',
        reliableSeconds: 3,
        meanAbsoluteCents: 5,
      })),
    },
  }
  const earlierVisits = MUSEUM_CAMPAIGN.slice(
    0,
    MUSEUM_CAMPAIGN.indexOf(chapter),
  ).map(({ level }) => ({
    ...readProgress(level, null),
    completedBreakableIds: level.breakables.map((item) => item.id),
    finished: true,
  }))
  await page.addInitScript(
    ({ saved, earlierVisits }) => {
      // These assertions cover host/UI/save behavior. Separate asset proofs inspect actual rendered pixels.
      for (const method of [
        'clear',
        'drawArrays',
        'drawArraysInstanced',
        'drawElements',
        'drawElementsInstanced',
      ])
        Object.defineProperty(WebGL2RenderingContext.prototype, method, {
          configurable: true,
          value: () => undefined,
        })
      for (const visit of [...earlierVisits, saved])
        localStorage.setItem(
          `beside-cue:glass-adventure:progress:${visit.levelId}`,
          JSON.stringify(visit),
        )
      localStorage.setItem('beside-cue:glass-adventure:tutorial', 'seen')
    },
    { saved, earlierVisits },
  )
  await page.goto('/glass-game/?campaign=1&progression=earned')
  const navigation = page.getByRole('navigation', { name: 'Island paths' })
  await expect(navigation.getByRole('link')).toHaveCount(3)
  const twin = page.locator('[data-trial-id="twin-island-promenade"]')
  await expect(twin).toHaveAttribute('data-unlocked', 'true')
  await expect(
    page.locator('[data-trial-id="first-island-cloudway"]'),
  ).toHaveAttribute('data-unlocked', 'false')
  await expect(
    page.locator('[data-trial-id="conservatory-thawing-song"]'),
  ).toHaveAttribute('data-unlocked', 'false')
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await navigation.scrollIntoViewIfNeeded()
    expect(
      await navigation.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true)
    await navigation.screenshot({
      path: testInfo.outputPath(`island-paths-${width}.png`),
    })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  const link = navigation.getByRole('link', { name: /Twin Galleries Island/ })
  await link.scrollIntoViewIfNeeded()
  await link.tap()
  await expect(link).toHaveAttribute('aria-current', 'location')
  await expect(page.getByTestId('glass-adventure')).toHaveCount(0)
  const before = await page.evaluate(
    (id) => localStorage.getItem(`beside-cue:glass-adventure:progress:${id}`),
    level.id,
  )
  await twin.getByRole('button', { name: /^Play trial:/ }).tap()
  const game = page.getByTestId('glass-adventure')
  await expect(game).toHaveAttribute(
    'data-level-id',
    MUSEUM_TRIALS[1]!.chapter.level.id,
  )
  await expect(game).toHaveAttribute('data-ready', 'true', { timeout: 60_000 })
  await page.getByRole('button', { name: 'Leave museum', exact: true }).tap()
  await expect(twin).toHaveAttribute('data-unlocked', 'true')
  expect(
    await page.evaluate(
      (id) => localStorage.getItem(`beside-cue:glass-adventure:progress:${id}`),
      level.id,
    ),
  ).toBe(before)
})

test('creator studies remain readable and selectable at phone and tablet widths @smoke', async ({
  page,
}, testInfo) => {
  await page.goto('/glass-game/?lab=creator-gallery')
  await expect(
    page.getByRole('heading', { name: 'Little discoveries' }),
  ).toBeVisible()
  await expect(
    page.getByRole('region', { name: 'Art studies' }).getByRole('button'),
  ).toHaveCount(6)
  await expect(
    page.getByRole('button', { name: /The living pearl/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: /The living amber/ }),
  ).toBeVisible()
  for (const width of [320, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: testInfo.outputPath(`creator-gallery-${width}.png`),
      fullPage: true,
    })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: /Frost roots/ }).tap()
  const game = page.getByTestId('glass-adventure')
  await expect(game).toHaveAttribute(
    'data-level-id',
    'cloudway-crystal-interior-frost-roots',
  )
  // Wait for the actual renderer and assets; a mounted host alone is not a playable study.
  await expect(game).toHaveAttribute('data-ready', 'true', { timeout: 60_000 })
  await page.getByRole('button', { name: 'Skip tutorial', exact: true }).tap()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Leave museum', exact: true }).tap()
  await expect(
    page.getByRole('heading', { name: 'Little discoveries' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Back to games' }).tap()
  await expect(page).toHaveURL(/campaign=1/)
})
