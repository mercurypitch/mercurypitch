// C01 acceptance — actual Crystal Current rendering, accessible scale tuning and unchanged pickup rules.
import { expect, test } from '@playwright/test'
import { collectibleCourse, collectiblePickup, collectibleScaleKey, collectibleSettings, collectibleTimeAtDistance, openCollectibleCourse, steerToCollectible, touchCollectibleScale, waitForCollectibleTime, } from './helpers/runner-collectible-host'
import { expectCollectibleHostScale } from './helpers/runner-collectible-observation'
import { openCollectibleRenderer } from './helpers/runner-collectible-renderer'
import { restoreHostRaster } from './helpers/host-raster-checkpoints'

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })
test.setTimeout(180_000)

test.afterEach(async ({ page }, info) => {
  if (page.isClosed()) return
  try {
    const proof = await page.evaluate(() => {
      if (!window.hostRasterCheckpoints) return null
      const canvas = document.querySelector<HTMLCanvasElement>(
        '[data-testid="song-runner-scene"] canvas',
      )
      const gl = canvas?.getContext('webgl2')
      const debug = gl?.getExtension('WEBGL_debug_renderer_info')
      return {
        raster: window.hostRasterCheckpoints.read(),
        renderer: debug
          ? gl?.getParameter(debug.UNMASKED_RENDERER_WEBGL)
          : null,
      }
    })
    if (proof)
      await info.attach('collectible-raster-proof', {
        body: JSON.stringify(proof),
        contentType: 'application/json',
      })
  } finally {
    try {
      await page.evaluate(async () => {
        window.collectibleHostObservation?.dispose()
        await window.runnerVoiceFixture?.dispose()
      })
    } finally {
      await restoreHostRaster(page)
    }
  }
})

test('C01 scale is accessible, persists and fits both themes on phones and tablet @smoke', async ({
  page,
}, info) => {
  const { errors } = await openCollectibleCourse(page)
  let { settings, range } = await collectibleSettings(page)
  await expect(range).toHaveValue('120')
  await expect(range).toHaveAttribute('aria-valuetext', '120 percent')
  await range.focus()
  await page.keyboard.press('End')
  await page.keyboard.press('ArrowLeft')
  await expect(range).toHaveValue('159')
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      collectibleScaleKey,
    ),
  ).toBe('1.59')
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Start course', exact: true }),
  ).toBeEnabled({ timeout: 90_000 })
  ;({ settings, range } = await collectibleSettings(page))
  await expect(range).toHaveValue('159')
  await settings
    .getByRole('button', { name: 'Reset to 120%', exact: true })
    .click()
  await expect(range).toHaveValue('120')
  for (const theme of ['Crystal', 'Celadon']) {
    await settings.getByRole('tab', { name: 'Display', exact: true }).click()
    await settings.getByRole('button', { name: theme, exact: true }).click()
    await settings.getByRole('tab', { name: 'Advanced', exact: true }).click()
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
      { width: 768, height: 1024 },
    ]) {
      await page.setViewportSize(viewport)
      await range.scrollIntoViewIfNeeded()
      const bounds = await settings.evaluate((node) => {
        const box = node.getBoundingClientRect()
        return {
          left: box.left,
          right: box.right,
          top: box.top,
          bottom: box.bottom,
          overflow: document.documentElement.scrollWidth > window.innerWidth,
        }
      })
      expect(bounds.overflow).toBe(false)
      expect(bounds.left).toBeGreaterThanOrEqual(0)
      expect(bounds.right).toBeLessThanOrEqual(viewport.width)
      expect(bounds.top).toBeGreaterThanOrEqual(0)
      expect(bounds.bottom).toBeLessThanOrEqual(viewport.height)
      await expect(range).toHaveValue('120')
      await expect(range).toBeInViewport()
      await page.screenshot({
        path: info.outputPath(`c01-settings-${theme}-${viewport.width}.png`),
      })
    }
  }
  expect(errors).toEqual([])
  await page.evaluate(async () => {
    window.collectibleHostObservation.dispose()
    await window.runnerVoiceFixture.dispose()
  })
})

test('C01 keeps real pickup timing while paused mouse and touch scaling redraws the same visit @smoke', async ({
  page,
  context,
}, info) => {
  const { runner, errors } = await openCollectibleCourse(page)
  const canvas = page.getByTestId('song-runner-scene').locator('canvas')
  const retainedCanvas = await canvas.elementHandle()
  await page.getByRole('button', { name: 'Start course', exact: true }).click()
  await expect(runner).toHaveAttribute('data-phase', 'running', {
    timeout: 30_000,
  })
  expect(
    await page.evaluate(() => window.runnerVoiceFixture.requests),
  ).toBeGreaterThan(0)
  await steerToCollectible(page)
  const jump = collectibleCourse.obstacles
    .find((item) => item.id === 'first-jump')!
    .certifiedActions.find((action) => action.kind === 'jump')!
  await waitForCollectibleTime(
    page,
    (jump.launchOpenCourseSeconds + jump.launchCloseCourseSeconds) / 2,
  )
  await page.keyboard.press('Space')
  await expect(runner).toHaveAttribute('data-player-grounded', 'false')
  await waitForCollectibleTime(
    page,
    collectibleTimeAtDistance(collectiblePickup.courseDistanceMeters - 8),
  )
  await expect(runner).toHaveAttribute('data-collected-rewards', '')
  await expect
    .poll(async () => Number(await runner.getAttribute('data-hit-targets')))
    .toBeGreaterThan(0)
  // Settings stops capture; its reset control redraws the paused scene on demand.
  const drawsBeforePause = await page.evaluate(
    () => window.collectibleHostObservation.read().draws,
  )
  const { settings, range } = await collectibleSettings(page)
  await expect(runner).toHaveAttribute('data-phase', 'paused')
  await settings
    .getByRole('button', { name: 'Reset to 120%', exact: true })
    .click()
  let drawn = await expectCollectibleHostScale(
    page,
    collectiblePickup.id,
    1.2,
    drawsBeforePause,
  )
  await page.screenshot({ path: info.outputPath('c01-real-approach.png') })
  const pausedAt = await runner.getAttribute('data-course-seconds')
  const requests = await page.evaluate(() => window.runnerVoiceFixture.requests)
  const box = (await range.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, {
    steps: 5,
  })
  await page.mouse.up()
  await expect(range).toHaveValue('160')
  drawn = await expectCollectibleHostScale(
    page,
    collectiblePickup.id,
    1.6,
    drawn.draws,
  )
  const cdp = await context.newCDPSession(page)
  try {
    await touchCollectibleScale(cdp, range, 0)
    await expect(range).toHaveValue('80')
    drawn = await expectCollectibleHostScale(
      page,
      collectiblePickup.id,
      0.8,
      drawn.draws,
    )
    await touchCollectibleScale(cdp, range, 1)
    await expect(range).toHaveValue('160')
    drawn = await expectCollectibleHostScale(
      page,
      collectiblePickup.id,
      1.6,
      drawn.draws,
    )
  } finally {
    await cdp.detach()
  }
  await settings
    .getByRole('button', { name: 'Reset to 120%', exact: true })
    .click()
  await expect(range).toHaveValue('120')
  await expectCollectibleHostScale(page, collectiblePickup.id, 1.2, drawn.draws)
  await expect(runner).toHaveAttribute('data-course-seconds', pausedAt!)
  await expect(runner).toHaveAttribute('data-phase', 'paused')
  expect(await page.evaluate(() => window.runnerVoiceFixture.requests)).toBe(
    requests,
  )
  expect(await retainedCanvas!.evaluate((node) => node.isConnected)).toBe(true)
  await page.screenshot({ path: info.outputPath('c01-paused-scale-reset.png') })
  const checkpoint = collectibleCourse.checkpoints
    .filter((item) => item.courseSeconds <= Number(pausedAt))
    .at(-1)!
  expect(checkpoint.courseSeconds).toBeLessThan(Number(pausedAt))
  await settings.getByRole('button', { name: 'Resume', exact: true }).click()
  // Resume deliberately restores the last checkpoint before readiness/count-in.
  await expect(runner).toHaveAttribute(
    'data-course-seconds',
    checkpoint.courseSeconds.toFixed(3),
  )
  await expect(runner).toHaveAttribute(
    'data-lateral-x',
    collectibleCourse.laneCenters[checkpoint.respawnLane]!.toFixed(3),
  )
  await expect(runner).toHaveAttribute('data-collected-rewards', '')
  await expect(runner).toHaveAttribute('data-phase', 'running', {
    timeout: 30_000,
  })
  await steerToCollectible(page)
  await waitForCollectibleTime(
    page,
    (jump.launchOpenCourseSeconds + jump.launchCloseCourseSeconds) / 2,
  )
  await page.keyboard.press('Space')
  await expect(runner).toHaveAttribute('data-player-grounded', 'false')
  await waitForCollectibleTime(
    page,
    collectibleTimeAtDistance(collectiblePickup.courseDistanceMeters - 8),
  )
  await expect(runner).toHaveAttribute('data-collected-rewards', '')
  await expect
    .poll(async () => Number(await runner.getAttribute('data-hit-targets')))
    .toBeGreaterThan(0)
  await waitForCollectibleTime(
    page,
    collectibleTimeAtDistance(collectiblePickup.courseDistanceMeters + 0.8),
  )
  await expect(runner).toHaveAttribute(
    'data-collected-rewards',
    collectiblePickup.id,
  )
  await waitForCollectibleTime(
    page,
    collectibleTimeAtDistance(collectiblePickup.courseDistanceMeters + 2),
  )
  await expect(runner).toHaveAttribute(
    'data-collected-rewards',
    collectiblePickup.id,
  )
  await expect(runner).toHaveAttribute('data-player-grounded', 'true')
  const framesBeforePause = await page.evaluate(
    () => window.hostRasterCheckpoints.read().forwardedDraws,
  )
  const collectedSettings = await collectibleSettings(page)
  await expect(runner).toHaveAttribute('data-phase', 'paused')
  await collectedSettings.settings
    .getByRole('button', { name: 'Reset to 120%', exact: true })
    .click()
  await expect
    .poll(() =>
      page.evaluate(() => window.hostRasterCheckpoints.read().forwardedDraws),
    )
    .toBeGreaterThan(framesBeforePause)
  await page.screenshot({ path: info.outputPath('c01-real-collected.png') })
  expect(errors).toEqual([])
  await page.evaluate(async () => {
    window.collectibleHostObservation.dispose()
    await window.runnerVoiceFixture.dispose()
  })
})

test('C01 preserves its alpha silhouette, depth visibility and owned texture lifetime in real WebGL @smoke', async ({
  page,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await openCollectibleRenderer(page)
  const stages = []
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 768, height: 1024 },
  ]) {
    await page.setViewportSize(viewport)
    for (const distance of [82, 89.2]) {
      const stage = await page.evaluate(
        (distance) => window.collectibleRendererProof.stage(distance),
        distance,
      )
      expect(stage.glError).toBe(0)
      expect(stage.contextLosses).toBe(0)
      expect(stage.artwork.texture).toMatchObject({
        colorSpace: 'srgb',
        width: 768,
        height: 768,
      })
      expect(stage.artwork.material).toMatchObject({
        toneMapped: false,
        depthTest: true,
      })
      stages.push({ viewport, ...stage })
      await page.screenshot({
        path: info.outputPath(
          `c01-controlled-${viewport.width}-${distance}.png`,
        ),
      })
    }
  }
  const smaller = await page.evaluate(() =>
    window.collectibleRendererProof.stage(89.2, 0.8),
  )
  const larger = await page.evaluate(() =>
    window.collectibleRendererProof.stage(89.2, 1.6),
  )
  expect(larger.artwork.box[0]! / smaller.artwork.box[0]!).toBeCloseTo(2, 5)
  const opaque = await page.evaluate(() =>
    window.collectibleRendererProof.depth('opaque'),
  )
  expect(opaque.changedPixels).toBe(0)
  const transmissive = await page.evaluate(() =>
    window.collectibleRendererProof.depth('transmissive'),
  )
  expect(transmissive.changedPixels).toBeGreaterThan(50)
  expect(transmissive.glError).toBe(0)
  const disposed = await page.evaluate(() =>
    window.collectibleRendererProof.dispose(),
  )
  expect(disposed).toEqual({
    textureDisposals: 1,
    secondDisposeTextureDisposals: 1,
    canvasConnected: false,
    postDisposeRender: false,
    contextLosses: 0,
  })
  expect(errors).toEqual([])
  await info.attach('controlled-rendering-evidence', {
    body: JSON.stringify(
      { stages, opaque, transmissive, disposed, errors },
      null,
      2,
    ),
    contentType: 'application/json',
  })
})
