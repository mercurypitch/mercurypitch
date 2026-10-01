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
  await expect(
    page.getByRole('button', { name: /Earn [23] stars:/ }),
  ).toHaveCount(0)
  const result = page.getByTestId('completion-results')
  for (const viewport of [
    { label: 'small-phone', width: 320, height: 740 },
    { label: 'phone', width: 390, height: 844 },
    { label: 'tablet', width: 820, height: 1180 },
    { label: 'desktop', width: 1280, height: 800 },
    { label: 'phone-landscape', width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport)
    await page.screenshot({
      path: testInfo.outputPath(`results-${viewport.label}.png`),
    })
    const layout = await result.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      controls: [...element.querySelectorAll('button, summary')]
        .map((control) => control.getBoundingClientRect())
        .filter((bounds) => bounds.width > 0 && bounds.height > 0)
        .map((bounds) => bounds.height),
    }))
    const scoreLayout = await result.evaluate((element) => {
      const badge = element.querySelector('[data-testid="discovery-summary"]')!
      const portrait = element.querySelector(
        '[data-testid="portrait-summary"]',
      )!
      return {
        badgeRight: badge.getBoundingClientRect().right,
        portraitLeft: portrait.getBoundingClientRect().left,
        badgeFontSize: Number.parseFloat(getComputedStyle(badge).fontSize),
        medalSize: Math.min(
          badge.querySelector('img')!.getBoundingClientRect().width,
          badge.querySelector('img')!.getBoundingClientRect().height,
        ),
        badgeWidth: badge.getBoundingClientRect().width,
        portraitSize: portrait.querySelector('img')!.getBoundingClientRect()
          .width,
      }
    })
    expect(scoreLayout.badgeRight).toBeLessThanOrEqual(scoreLayout.portraitLeft)
    expect(scoreLayout.badgeFontSize).toBeGreaterThanOrEqual(12)
    if (viewport.width < 500)
      expect(
        scoreLayout.medalSize / scoreLayout.badgeWidth,
      ).toBeGreaterThanOrEqual(0.8)
    else
      expect(scoreLayout.medalSize).toBeGreaterThanOrEqual(
        (viewport.height <= 520 ? 48 : 72) * 1.1,
      )
    expect(scoreLayout.portraitSize).toBeGreaterThanOrEqual(60)
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth)
    expect(layout.controls.every((height) => height >= 44)).toBe(true)
    if (viewport.width <= 390 || viewport.height <= 390)
      expect(layout.scrollHeight).toBeLessThanOrEqual(layout.clientHeight)
  }
  const accuracy = page.getByTestId('singing-quality-summary')
  await accuracy.focus()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('region', { name: 'Accuracy explanation' }),
  ).toBeVisible()
  await expect(accuracy).toHaveCSS('background-color', 'rgb(224, 238, 229)')
  await accuracy.click()
  await page.getByTestId('discovery-summary').tap()
  await expect(
    page.getByRole('region', { name: 'Discovery explanation' }),
  ).toContainText('one-time discovery tokens')
  await page
    .getByRole('button', {
      name: `View ${level.rewards!.portrait!.title} portrait`,
    })
    .click()
  await expect(page.getByText('From the museum collection')).toBeVisible()
  await page.getByRole('button', { name: 'Back to the gallery' }).click()
  await page.getByLabel('More result actions').click()
  await expect(
    page.getByRole('button', { name: 'Replay same difficulty' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', {
      name: `Next level: ${MUSEUM_CAMPAIGN[2]!.level.title}`,
    }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Back to museum' }).click()
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

test('results advance to the next unearned difficulty with a fresh exact profile @smoke', async ({
  page,
}, testInfo) => {
  const level = MUSEUM_CAMPAIGN[1]!.level
  const profiles = replayProfilesForLevel(level).map((profile) =>
    resolveReplayProfile(level, profile),
  )
  const medium = profiles[1]!
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
  let replay = beginReplayAttempt(
    readReplayProgress(level, profiles, null, legacy),
    medium,
    true,
  )
  replay = saveReplayAttempt(
    replay,
    medium,
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
    .getByRole('button', { name: 'Two-star challenge', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Continue this challenge', exact: true })
    .click()
  const game = page.getByTestId('glass-adventure')
  await expect(game).toHaveAttribute('data-ready', 'true', { timeout: 60_000 })
  await page.keyboard.down('KeyW')
  try {
    await expect(
      page.getByRole('button', {
        name: 'Earn 3 stars: Three-star challenge',
      }),
    ).toBeVisible({ timeout: 20_000 })
  } finally {
    await page.keyboard.up('KeyW')
  }
  await expect(page.getByTestId('level-star-summary')).toContainText(
    '2 stars earned',
  )
  const result = page.getByTestId('completion-results')
  const compact = await result.evaluate((element) => ({
    width: element.clientWidth,
    contentWidth: element.scrollWidth,
    height: element.clientHeight,
    contentHeight: element.scrollHeight,
  }))
  expect(compact.contentWidth).toBeLessThanOrEqual(compact.width)
  expect(compact.contentHeight).toBeLessThanOrEqual(compact.height)
  await page.screenshot({
    path: testInfo.outputPath('results-two-actions-320.png'),
  })
  await page
    .getByRole('button', { name: 'Earn 3 stars: Three-star challenge' })
    .click()
  await expect(game).toHaveAttribute('data-ready', 'true', { timeout: 60_000 })
  await expect(game).toContainText('Three-star challenge')
  await expect(game).toHaveAttribute('data-completed', '0')
  const saved = await page.evaluate(
    (id) =>
      JSON.parse(
        localStorage.getItem(`beside-cue:glass-adventure:replays:v1:${id}`)!,
      ),
    level.id,
  )
  expect(saved.clears).toHaveLength(1)
  expect(saved.clears[0].tier).toBe(2)
  expect(saved.attempts.at(-1).identity.profileId).toBe('three-star')
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

test.describe('completion portrait interaction', () => {
  test.use({ hasTouch: false, viewport: { width: 1280, height: 800 } })

  test('portrait responds to a real mouse, keyboard and reduced motion @smoke', async ({
    page,
  }, testInfo) => {
    const level = MUSEUM_CAMPAIGN[1]!.level
    const complete = {
      ...readProgress(level, null),
      completedBreakableIds: level.breakables.map((item) => item.id),
      finished: true,
      rewards: {
        version: 1,
        discoveredEncounterIds: level.rewards!.discoveries.map(
          (item) => item.encounterId,
        ),
        collectedCoinIds: level.rewards!.discoveries.flatMap(
          (item) => item.coinIds,
        ),
        collectedPortraitIds: [level.rewards!.portrait!.portraitId],
        qualityResults: [],
      },
    }
    const profiles = replayProfilesForLevel(level).map((profile) =>
      resolveReplayProfile(level, profile),
    )
    const firstVisit = profiles[0]!
    const replay = saveReplayAttempt(
      beginReplayAttempt(
        readReplayProgress(level, profiles, null, complete),
        firstVisit,
        true,
      ),
      firstVisit,
      {
        ...complete,
        checkpointId: level.checkpoints.find((item) =>
          item.id.endsWith('/checkpoint/panorama'),
        )!.id,
        finished: false,
      },
      100,
    )
    await page.addInitScript(
      ({ complete, replay }) => {
        // Actual host/DOM interaction is under test; separate raster proofs own the world.
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
          `beside-cue:glass-adventure:progress:${complete.levelId}`,
          JSON.stringify(complete),
        )
        localStorage.setItem(
          `beside-cue:glass-adventure:replays:v1:${complete.levelId}`,
          JSON.stringify(replay),
        )
      },
      { complete, replay },
    )
    await page.goto('/glass-game/?campaign=1')
    await page
      .getByRole('button', { name: 'Replay Glassworks Journey', exact: true })
      .click()
    await page.getByRole('button', { name: 'First visit', exact: true }).click()
    await page
      .getByRole('button', { name: 'Continue this challenge', exact: true })
      .click()
    await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
      'data-ready',
      'true',
      { timeout: 60_000 },
    )
    await page.keyboard.down('KeyW')
    try {
      await expect(page.getByTestId('completion-results')).toBeVisible({
        timeout: 20_000,
      })
    } finally {
      await page.keyboard.up('KeyW')
    }
    const result = page.getByTestId('completion-results')
    await expect(result).toBeVisible({ timeout: 60_000 })
    const portrait = result.getByTestId('portrait-summary')
    const picture = portrait.locator('img')
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(result.getByTestId('level-star-summary')).toContainText(
      '1 star earned',
    )
    await expect(
      result.getByRole('button', { name: 'Earn 2 stars: Two-star challenge' }),
    ).toBeVisible()
    await result.getByTestId('singing-quality-summary').click()
    await expect(
      result.getByRole('region', { name: 'Accuracy explanation' }),
    ).toBeVisible()
    const expanded = await result.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }))
    expect(expanded.scrollWidth).toBeLessThanOrEqual(expanded.clientWidth)
    await page.screenshot({
      path: testInfo.outputPath('results-first-visit-390-expanded.png'),
    })
    await result.getByTestId('singing-quality-summary').click()
    await portrait.click()
    await expect(page.getByText('From the museum collection')).toBeVisible()
    await page.screenshot({
      path: testInfo.outputPath('results-first-visit-390-portrait.png'),
    })
    await page.getByRole('button', { name: 'Back to the gallery' }).click()
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.mouse.move(0, 0)
    await result.getByTestId('discovery-summary').focus()
    await expect(picture).toHaveCSS('transform', 'none')
    await portrait.hover()
    await expect(picture).not.toHaveCSS('transform', 'none')
    await page.screenshot({
      path: testInfo.outputPath('results-portrait-hover.png'),
    })
    await portrait.click()
    await expect(page.getByText('From the museum collection')).toBeVisible()
    await page.getByRole('button', { name: 'Back to the gallery' }).click()
    await expect(portrait).toBeFocused()
    await page.mouse.move(0, 0)
    // A keyboard focus ring and lift provide the same invitation as mouse hover.
    await result.getByTestId('discovery-summary').focus()
    await page.keyboard.press('Tab')
    await expect(portrait).toBeFocused()
    await expect(picture).not.toHaveCSS('transform', 'none')
    await page.keyboard.press('Enter')
    await expect(page.getByText('From the museum collection')).toBeVisible()
    await page.getByRole('button', { name: 'Back to the gallery' }).click()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await portrait.hover()
    await expect(picture).toHaveCSS('transform', 'none')
    await expect(picture).toHaveCSS('transition-duration', '0s')
    await expect(portrait).toHaveCSS('outline-style', 'solid')
  })
})
