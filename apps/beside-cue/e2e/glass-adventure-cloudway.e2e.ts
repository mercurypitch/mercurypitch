// Cloudway entry — real host touch/keyboard routing respects earned island access.
import { expect, test, type Page } from '@playwright/test'
import { MUSEUM_CAMPAIGN } from '../../../packages/glass-game/src/content/campaign'
import { CLOUDWAY_CURRENT_TRIAL } from '../../../packages/glass-game/src/content/cloudway-layouts'
import { CLOUDWAY_GLASS_RIBBON } from '../../../packages/glass-game/src/content/cloudway-trial'

test.use({
  viewport: { width: 320, height: 740 },
  hasTouch: true,
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(120_000)

const progressKey = (levelId: string) =>
  `beside-cue:glass-adventure:progress:${levelId}`

function islandSaves(stars: 2 | 3) {
  return MUSEUM_CAMPAIGN.slice(0, 2).map(({ level }) => ({
    key: progressKey(level.id),
    value: JSON.stringify({
      version: 2,
      levelId: level.id,
      checkpointId: level.spawn.checkpointId,
      completedBreakableIds: level.breakables.map((item) => item.id),
      finished: true,
      rewards: {
        version: 1,
        discoveredEncounterIds: [],
        collectedCoinIds: [],
        collectedPortraitIds: [],
        qualityResults: (level.rewards?.grading ?? []).map((policy) => ({
          encounterId: policy.encounterId,
          grade: stars,
          challengeRevision: policy.challengeRevision,
          policyRevision: policy.policyRevision,
          contentRevision: level.authored?.contentRevision ?? 1,
          evidenceVersion: 'pitch-accuracy-v1',
          reliableSeconds: 3,
          meanAbsoluteCents: stars === 3 ? 5 : 45,
        })),
      },
    }),
  }))
}

function routeSave(levelId: string, checkpointId: string) {
  return {
    key: progressKey(levelId),
    value: JSON.stringify({
      version: 2,
      levelId,
      checkpointId,
      completedBreakableIds: [],
      finished: false,
    }),
  }
}

async function prepare(
  page: Page,
  stars: 2 | 3,
  additionalSaves: readonly { key: string; value: string }[] = [],
) {
  await page.addInitScript(
    ({ saves, realRendering }) => {
      // Real resource/scene/input lifetimes; pixels are inspected in the compiled proof.
      for (const method of realRendering
        ? []
        : [
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
      for (const save of saves) localStorage.setItem(save.key, save.value)
    },
    {
      saves: [...islandSaves(stars), ...additionalSaves],
      realRendering: process.env.GLASS_RENDER_PROOF === '1',
    },
  )
}

test('trial requirements fit phone/tablet/desktop without converting old accuracy into difficulty stars @smoke', async ({
  page,
}, testInfo) => {
  await prepare(page, 2)
  await page.goto('/glass-game/?campaign=1')
  const trial = page.locator('[data-trial-id="first-island-cloudway"]')
  await expect(trial).toHaveAttribute('data-unlocked', 'false')
  await expect(trial.getByText('0/3 stars', { exact: true })).toBeVisible()
  const button = trial.getByRole('button', {
    name: `Trial locked: ${CLOUDWAY_CURRENT_TRIAL.title}`,
  })
  await expect(button).toBeDisabled()
  for (const viewport of [
    { width: 320, height: 740 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    await trial.scrollIntoViewIfNeeded()
    const metrics = await trial.evaluate((element) => {
      const action = element.querySelector('button')!
      const rect = action.getBoundingClientRect()
      return {
        width: element.clientWidth,
        content: element.scrollWidth,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        viewport: document.documentElement.clientWidth,
        background: getComputedStyle(action).backgroundColor,
      }
    })
    expect(metrics.content).toBeLessThanOrEqual(metrics.width)
    expect(metrics.height).toBeGreaterThanOrEqual(44)
    expect(metrics.left).toBeGreaterThanOrEqual(0)
    expect(metrics.right).toBeLessThanOrEqual(metrics.viewport)
    expect(metrics.background).toBe('rgb(231, 231, 217)')
    if (process.env.GLASS_RENDER_PROOF === '1') {
      await trial.locator('img').evaluate((image) => image.decode())
      await trial.screenshot({
        path: testInfo.outputPath(`trial-card-${viewport.width}.png`),
      })
    }
  }
})

test('earned access opens the selected route and leaving preserves isolated saves @smoke', async ({
  page,
}, testInfo) => {
  const currentSave = routeSave(
    CLOUDWAY_CURRENT_TRIAL.id,
    'cloudway-checkpoint-frost-catch',
  )
  const legacySave = routeSave(
    CLOUDWAY_GLASS_RIBBON.id,
    'cloudway-checkpoint-glide-east',
  )
  await prepare(page, 3, [currentSave, legacySave])
  await page.goto('/glass-game/?campaign=1')
  const trial = page.locator('[data-trial-id="first-island-cloudway"]')
  await expect(trial).toHaveAttribute('data-unlocked', 'true')
  const play = trial.getByRole('button', {
    name: `Play trial: ${CLOUDWAY_CURRENT_TRIAL.title}`,
  })
  await play.scrollIntoViewIfNeeded()
  await play.focus()
  await expect(play).toBeFocused()
  expect(
    await play.evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe('rgb(34, 73, 67)')
  await play.tap()
  const game = page.getByTestId('glass-adventure')
  await expect(game).toHaveAttribute('data-level-id', CLOUDWAY_CURRENT_TRIAL.id)
  await expect(game).toHaveAttribute('data-ready', 'true', { timeout: 60_000 })
  await expect(game).toHaveAttribute(
    'data-checkpoint',
    'cloudway-checkpoint-frost-catch',
  )
  const skip = page.getByRole('button', { name: 'Skip tutorial' })
  if (await skip.isVisible()) await skip.tap()
  if (process.env.GLASS_RENDER_PROOF === '1') {
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.screenshot({
      path: testInfo.outputPath('cloudway-current-tablet.png'),
    })
  }
  await page.getByRole('button', { name: 'Leave museum', exact: true }).tap()
  await expect(trial).toHaveAttribute('data-unlocked', 'true')
  const gallerySaves = islandSaves(3)
  const saved = await page.evaluate(
    (keys) => keys.map((key) => localStorage.getItem(key)),
    [...gallerySaves, currentSave, legacySave].map((item) => item.key),
  )
  expect(saved.slice(0, gallerySaves.length)).toEqual(
    gallerySaves.map((item) => item.value),
  )
  expect(JSON.parse(saved[2]!)).toMatchObject({
    levelId: CLOUDWAY_CURRENT_TRIAL.id,
    checkpointId: 'cloudway-checkpoint-frost-catch',
  })
  expect(JSON.parse(saved[3]!)).toMatchObject({
    levelId: CLOUDWAY_GLASS_RIBBON.id,
    checkpointId: 'cloudway-checkpoint-glide-east',
  })
})

test('a declined trial handoff refreshes the lock and leaves other galleries usable @smoke', async ({
  page,
}) => {
  await prepare(page, 3)
  await page.goto('/glass-game/?campaign=1')
  const trial = page.locator('[data-trial-id="first-island-cloudway"]')
  await expect(trial).toHaveAttribute('data-unlocked', 'true')
  // Save state can change after the card was rendered, before its route-boundary check.
  await page.evaluate(
    (key) => localStorage.removeItem(key),
    islandSaves(3)[1]!.key,
  )
  const play = trial.getByRole('button', {
    name: `Play trial: ${CLOUDWAY_CURRENT_TRIAL.title}`,
  })
  await play.scrollIntoViewIfNeeded()
  await play.tap()
  await expect(trial).toHaveAttribute('data-unlocked', 'false')
  await expect(page.getByText('Opening trial…', { exact: true })).toHaveCount(0)
  await expect(page.getByTestId('glass-adventure')).toHaveCount(0)
  await expect(
    page.getByRole('button', {
      name: `Replay ${MUSEUM_CAMPAIGN[0]!.level.title}`,
      exact: true,
    }),
  ).toBeEnabled()
})
