// Thawing Song browser proof — saved lesson identity and real microphone PCM judge the portrait.

import { expect, test } from '@playwright/test'
import { CLOUDWAY_THAWING_SONG } from '../../../packages/glass-game/src/content/cloudway-thawing-song'
import { createGlassGame } from '../../../packages/glass-game/src/core/game'
import { resolveMelodyAttempt } from '../../../packages/glass-game/src/core/melody-attempt'
import { installThawingInput, singCompiledPhrase, } from './helpers/thawing-song-input'

const level = CLOUDWAY_THAWING_SONG
const progressKey = `beside-cue:glass-adventure:progress:${level.id}`
const configuration = {
  attemptId: 'thawing-browser-portrait-v1',
  comfortableMidi: 60,
  pace: 1.25,
  transposeSemitones: 0,
}
const resolved = resolveMelodyAttempt(level, configuration)
const prepared = createGlassGame(level)
prepared.configureMelodyAttempt(configuration)
const finaleSave = {
  ...prepared.saveProgress(),
  checkpointId: 'thaw-portrait-save',
  completedBreakableIds: level.melodyLesson!.stations.map((s) => s.encounterId),
}

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(150_000)

test('first station configures one saved key, rejects the wrong pitch and restores its note @smoke', async ({
  page,
}, testInfo) => {
  await installThawingInput(page)
  await page.goto('/glass-game/?layout=thawing-song')
  const game = page.getByTestId('glass-adventure')
  await expect(game).toHaveAttribute('data-ready', 'true', { timeout: 60_000 })
  await page.getByTestId('glass-sing-action').tap()
  const panel = page.getByRole('region', {
    name: 'Melody challenge',
    exact: true,
  })
  await expect(panel).toBeVisible()
  expect(await page.evaluate(() => window.thawingInput.streams.length)).toBe(0)
  await expect(
    panel.getByRole('radio', { name: 'Spacious', exact: true }),
  ).toBeChecked()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390)
  await page.screenshot({
    path: testInfo.outputPath('thawing-key-setup-phone.png'),
  })
  await panel.getByRole('button', { name: 'Start singing', exact: true }).tap()
  await expect(panel).toHaveAttribute('data-voice-mode', 'singing', {
    timeout: 20_000,
  })
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    progressKey,
  )
  expect(saved.version).toBe(3)
  expect(saved.melodyAttempt).toMatchObject({
    comfortableMidi: 60,
    rootMidi: 58,
    pace: 1.25,
  })
  expect(saved.completedBreakableIds).toEqual([])
  await page.evaluate(() => window.thawingInput.tone(60))
  await page.waitForTimeout(1800)
  await expect(game).toHaveAttribute('data-completed', '0')
  await page.evaluate(() => window.thawingInput.tone(58))
  await expect(game).toHaveAttribute('data-completed', '1', { timeout: 10_000 })
  await page.evaluate(() => window.thawingInput.silent())
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.thawingInput.streams.every((s) =>
          s.getAudioTracks().every((t) => t.readyState === 'ended'),
        ),
      ),
    )
    .toBe(true)
  await page.reload()
  await expect(game).toHaveAttribute('data-ready', 'true', { timeout: 60_000 })
  await expect(game).toHaveAttribute('data-completed', '1')
  const restored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    progressKey,
  )
  expect(restored.melodyAttempt).toEqual(saved.melodyAttempt)
})

test('the complete sung curve shatters the portrait and opens the exit without mixing old note evidence @smoke', async ({
  page,
}, testInfo) => {
  await installThawingInput(page, { progress: finaleSave })
  const voiceRequests: string[] = []
  page.on('request', (r) => {
    if (r.url().includes('/adventure-voice-v6/'))
      voiceRequests.push(new URL(r.url()).pathname)
  })
  await page.goto('/glass-game/?layout=thawing-song')
  const game = page.getByTestId('glass-adventure')
  await expect(game).toHaveAttribute('data-ready', 'true', { timeout: 60_000 })
  await expect(game).toHaveAttribute('data-completed', '5')
  await page.getByTestId('glass-sing-action').tap()
  const panel = page.getByRole('region', {
    name: 'Melody challenge',
    exact: true,
  })
  await expect(panel).toHaveAttribute('data-voice-mode', 'singing', {
    timeout: 25_000,
  })
  expect(voiceRequests).toContain(
    '/games/adventure-voice-v6/sunlit-steps/r58-p125.mp3',
  )
  await expect(game).toHaveAttribute('data-completed', '5')
  await page.evaluate(() => window.thawingInput.tone(58))
  await page.waitForTimeout(2200)
  await expect(game).toHaveAttribute('data-completed', '5')
  const ribbon = panel.getByRole('img', { name: /Melody ribbon/u })
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width)
    expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    )
    const [panelBox, ribbonBox] = await Promise.all([
      panel.boundingBox(),
      ribbon.boundingBox(),
    ])
    expect(panelBox).not.toBeNull()
    expect(ribbonBox).not.toBeNull()
    expect(ribbonBox!.width).toBeGreaterThan(panelBox!.width * 0.8)
    await page.screenshot({
      path: testInfo.outputPath(`thawing-finale-${width}.png`),
    })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => window.thawingInput.silent())
  await panel.getByRole('button', { name: 'Try again', exact: true }).tap()
  await expect(panel).toHaveAttribute('data-voice-mode', 'reference')
  await expect(panel).toHaveAttribute('data-voice-mode', 'singing', {
    timeout: 25_000,
  })
  await singCompiledPhrase(page, resolved.melody)
  await expect(game).toHaveAttribute('data-completed', '6', { timeout: 20_000 })
  await page.evaluate(() => window.thawingInput.silent())
  await expect(panel).not.toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.thawingInput.streams.every((s) =>
          s.getAudioTracks().every((t) => t.readyState === 'ended'),
        ),
      ),
    )
    .toBe(true)
  // All five prior stations survive the failed attempt and the portrait is newly earned.
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    progressKey,
  )
  expect(saved.completedBreakableIds).toEqual(level.breakables.map((b) => b.id))
  expect(saved.melodyAttempt).toEqual(resolved.identity)
  await page.reload()
  await expect(game).toHaveAttribute('data-ready', 'true', { timeout: 60_000 })
  await expect(game).toHaveAttribute('data-completed', '6')
  // From the actual safe portrait checkpoint, walk through the newly open golden threshold.
  // First-person yaw belongs to the player; recenter onto this restored court.
  await page.waitForTimeout(1000)
  await page.getByRole('button', { name: 'Recenter camera', exact: true }).tap()
  await expect
    .poll(async () =>
      Math.abs(Number(await game.getAttribute('data-camera-yaw'))),
    )
    .toBeLessThan(0.01)
  await page.getByLabel('Glass museum; drag to look around').focus()
  const coordinate = async (axis: string) =>
    Number(await game.getAttribute(`data-player-${axis}`))
  await page.keyboard.down('KeyD')
  await expect
    .poll(() => coordinate('x'), { intervals: [50] })
    .toBeGreaterThan(9.8)
  await page.keyboard.up('KeyD')
  await page.keyboard.down('KeyW')
  await expect
    .poll(() => coordinate('z'), { intervals: [50] })
    .toBeLessThan(-9.7)
  await page.keyboard.up('KeyW')
  await page.keyboard.down('KeyA')
  await expect
    .poll(() => coordinate('x'), { intervals: [50] })
    .toBeLessThan(9.2)
  await page.keyboard.up('KeyA')
  await page.keyboard.down('KeyW')
  await expect(
    page.getByRole('heading', {
      name: 'A whole garden, awakened by your song.',
      exact: true,
    }),
  ).toBeVisible({ timeout: 8000 })
  await page.keyboard.up('KeyW')
})

test('games-enabled phone entry opens the same melody preview and returns to the list @smoke', async ({
  page,
}) => {
  await installThawingInput(page)
  await page.goto('/?devSeed')
  await page.getByRole('button', { name: /B-side games/u }).tap()
  const entry = page.getByRole('button', { name: /The Thawing Song/u })
  await expect(entry).toBeVisible()
  await entry.tap()
  const game = page.getByTestId('glass-adventure')
  await expect(game).toHaveAttribute('data-level-id', level.id)
  await expect(game).toHaveAttribute('data-ready', 'true', { timeout: 60_000 })
  await page.getByRole('button', { name: 'Leave museum', exact: true }).tap()
  await expect(entry).toBeVisible()
  await expect(game).toHaveCount(0)
})
