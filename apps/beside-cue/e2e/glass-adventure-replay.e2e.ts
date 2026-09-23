// Replay selection in the real host — small-screen controls keep attempts and earlier ownership separate.
import { expect, test } from '@playwright/test'
import { MUSEUM_CAMPAIGN } from '../../../packages/glass-game/src/content/campaign'
import { replayProfilesForLevel } from '../../../packages/glass-game/src/content/replay-profiles'
import { readProgress } from '../../../packages/glass-game/src/core/progress'
import { resolveReplayProfile } from '../../../packages/glass-game/src/core/replay-profile'
import { beginReplayAttempt, readReplayProgress, saveReplayAttempt, } from '../../../packages/glass-game/src/core/replay-progress'

test.use({
  viewport: { width: 320, height: 740 },
  hasTouch: true,
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(120_000)

test('an input-driven exit awards the selected tier once and presents separate portrait rewards @smoke', async ({
  page,
}, testInfo) => {
  const level = MUSEUM_CAMPAIGN[1]!.level
  const profiles = replayProfilesForLevel(level).map((profile) =>
    resolveReplayProfile(level, profile),
  )
  const hard = profiles[2]!
  const completeIds = level.breakables
    .filter((item) => !item.optional)
    .map((item) => item.id)
  const legacy = {
    ...readProgress(level, null),
    completedBreakableIds: completeIds,
    finished: true,
  }
  const checkpoint = level.checkpoints.find((item) =>
    item.id.endsWith('/checkpoint/panorama'),
  )!
  expect(checkpoint).toBeDefined()
  let replay = beginReplayAttempt(
    readReplayProgress(level, profiles, null, legacy),
    hard,
    true,
  )
  replay = saveReplayAttempt(
    replay,
    hard,
    {
      ...readProgress(level, null),
      checkpointId: checkpoint.id,
      completedBreakableIds: completeIds,
      finished: false,
    },
    100,
  )
  await page.addInitScript(
    ({ legacy, replay }) => {
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
      localStorage.setItem('beside-cue:glass-adventure:tutorial', 'seen')
      localStorage.setItem(
        `beside-cue:glass-adventure:progress:${legacy.levelId}`,
        JSON.stringify(legacy),
      )
      localStorage.setItem(
        `beside-cue:glass-adventure:replays:v1:${legacy.levelId}`,
        JSON.stringify(replay),
      )
    },
    { legacy, replay },
  )
  await page.goto('/glass-game/?campaign=1')
  await page
    .getByRole('button', { name: 'Replay Glassworks Journey', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Three-star challenge', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Continue this challenge', exact: true })
    .click()
  const game = page.getByTestId('glass-adventure')
  await expect(game).toHaveAttribute('data-ready', 'true', { timeout: 60_000 })
  await expect(game).toContainText('Three-star challenge')
  await page.keyboard.down('KeyW')
  try {
    await expect(page.getByTestId('level-star-summary')).toBeVisible({
      timeout: 20_000,
    })
  } finally {
    await page.keyboard.up('KeyW')
  }
  await expect(page.getByTestId('level-star-summary')).toContainText('3 stars')
  await expect(page.getByTestId('singing-quality-summary')).toContainText(
    'Not graded',
  )
  await expect(page.getByTestId('portrait-summary')).toContainText(
    level.rewards!.portrait!.title,
  )
  for (const width of [320, 1024]) {
    await page.setViewportSize({ width, height: 820 })
    const summary = page.getByRole('dialog', {
      name: /sing|beautiful|museum|resonat/i,
    })
    await page.screenshot({
      path: testInfo.outputPath(`replay-complete-${width}.png`),
    })
    expect(
      await summary.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true)
  }
  await page
    .getByRole('button', { name: 'Leave with a little sparkle' })
    .click()
  const saved = await page.evaluate(
    (id) =>
      JSON.parse(
        localStorage.getItem(`beside-cue:glass-adventure:replays:v1:${id}`)!,
      ),
    level.id,
  )
  expect(saved.clears).toHaveLength(1)
  expect(saved.clears[0].tier).toBe(3)
  await page.getByRole('button', { name: 'Open museum collection' }).click()
  await expect(page.getByLabel('3 of 3 gallery challenge stars')).toBeVisible()
})

test('replay goals fit phone/tablet/desktop and resume only the selected tier @smoke', async ({
  page,
}, testInfo) => {
  const level = MUSEUM_CAMPAIGN[1]!.level
  const profiles = replayProfilesForLevel(level).map((profile) =>
    resolveReplayProfile(level, profile),
  )
  const legacy = {
    ...readProgress(level, null),
    finished: true,
    completedBreakableIds: level.breakables.map((item) => item.id),
  }
  const hard = profiles[2]!
  let replay = beginReplayAttempt(
    readReplayProgress(level, profiles, null, legacy),
    hard,
    true,
  )
  const entrance = level.breakables.find(
    (item) => !item.optional && !item.requiresCompleted?.length,
  )!
  replay = saveReplayAttempt(
    replay,
    hard,
    { ...readProgress(level, null), completedBreakableIds: [entrance.id] },
    100,
  )
  const storagePrefix = 'beside-cue:glass-adventure'
  await page.addInitScript(
    ({ levelId, legacy, replay, storagePrefix }) => {
      // Scene behavior is exercised here; this screenshot proof concerns the HTML dialog.
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
      localStorage.setItem(`${storagePrefix}:tutorial`, 'seen')
      localStorage.setItem(
        `${storagePrefix}:progress:${levelId}`,
        JSON.stringify(legacy),
      )
      localStorage.setItem(
        `${storagePrefix}:replays:v1:${levelId}`,
        JSON.stringify(replay),
      )
    },
    { levelId: level.id, legacy, replay, storagePrefix },
  )
  await page.goto('/glass-game/?campaign=1')
  await page
    .getByRole('button', { name: 'Replay Glassworks Journey', exact: true })
    .tap()
  const dialog = page.getByRole('dialog', {
    name: 'Glassworks Journey',
    exact: true,
  })
  await expect(dialog).toBeVisible()
  for (const viewport of [
    { width: 320, height: 740 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    const hardGoal = dialog.getByRole('button', {
      name: 'Three-star challenge',
      exact: true,
    })
    await hardGoal.tap()
    await expect(hardGoal).toHaveAttribute('aria-pressed', 'true')
    await expect(
      dialog.getByRole('button', {
        name: 'Continue this challenge',
        exact: true,
      }),
    ).toBeVisible()
    const layout = await dialog.evaluate((element) => ({
      width: element.clientWidth,
      scrollWidth: element.scrollWidth,
      controls: [...element.querySelectorAll('button')].map((button) => ({
        height: button.getBoundingClientRect().height,
        background: getComputedStyle(button).backgroundColor,
      })),
    }))
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width)
    expect(layout.controls.every((control) => control.height >= 42)).toBe(true)
    expect(
      layout.controls.some(
        (control) => control.background === 'rgb(36, 73, 67)',
      ),
    ).toBe(true)
    await page.screenshot({
      path: testInfo.outputPath(`replay-dialog-${viewport.width}.png`),
    })
  }
  await page.setViewportSize({ width: 320, height: 740 })
  await dialog.getByRole('button', { name: 'First visit', exact: true }).tap()
  await expect(
    dialog.getByRole('button', { name: 'Begin this challenge', exact: true }),
  ).toBeVisible()
  await dialog
    .getByRole('button', { name: 'Three-star challenge', exact: true })
    .tap()
  await dialog
    .getByRole('button', { name: 'Continue this challenge', exact: true })
    .tap()
  const game = page.getByTestId('glass-adventure')
  await expect(game).toHaveAttribute('data-ready', 'true', { timeout: 60_000 })
  await expect(game).toHaveAttribute('data-completed', '1')
  await page.getByRole('button', { name: 'Leave museum', exact: true }).tap()
  await page
    .getByRole('button', { name: 'Replay Glassworks Journey', exact: true })
    .tap()
  await dialog
    .getByRole('button', { name: 'Three-star challenge', exact: true })
    .tap()
  await dialog
    .getByRole('button', { name: 'Start this challenge again', exact: true })
    .tap()
  await expect(game).toHaveAttribute('data-ready', 'true', { timeout: 60_000 })
  await expect(game).toHaveAttribute('data-completed', '0')
  const saved = await page.evaluate(
    (key) =>
      JSON.parse(localStorage.getItem(key) ?? 'null') as { finished?: boolean },
    `${storagePrefix}:progress:${level.id}`,
  )
  expect(saved.finished).toBe(true)
})
